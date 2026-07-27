import { supabase } from "./supabase";
import {
  getStateDocumentConfig,
  normalizePropertyState,
} from "../config/stateDocumentConfig";

export interface LoanForDocumentGeneration {
  id: string | number;
  user_id?: string | null;
  state?: string | null;
  property_state?: string | null;
  full_name?: string | null;
  business_name?: string | null;
  property_address?: string | null;
  county?: string | null;
  apn?: string | null;
  APN?: string | null;
  acreage?: number | string | null;
  land_value?: number | string | null;
  loan_amount?: number | string | null;
  repayment_term_months?: number | null;
  borrower_interest_rate?: number | null;
  investor_interest_rate?: number | null;
  loan_number?: number | string | null;
}

type GeneratedDocumentSeed = {
  document_type: string;
  title: string;
  file_name: string;
  status: "ready_for_review";
  terms_snapshot: Record<string, unknown>;
  document_state: string;
  template_version: string;
  generated_at: string;
};

function safeFilePart(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function buildTermsSnapshot(
  loan: LoanForDocumentGeneration,
  stateCode: string,
  stateName: string,
  templateVersion: string,
): Record<string, unknown> {
  return {
    loan_number: loan.loan_number ?? null,
    borrower_name: loan.full_name ?? null,
    business_name: loan.business_name ?? null,
    property_address: loan.property_address ?? null,
    county: loan.county ?? null,
    property_state: stateCode,
    property_state_name: stateName,
    apn: loan.apn ?? loan.APN ?? null,
    acreage: loan.acreage ?? null,
    land_value: loan.land_value ?? null,
    loan_amount: loan.loan_amount ?? null,
    repayment_term_months: loan.repayment_term_months ?? null,
    borrower_interest_rate: loan.borrower_interest_rate ?? null,
    investor_interest_rate: loan.investor_interest_rate ?? null,
    template_version: templateVersion,
    attorney_review_required: true,
  };
}

export function buildStateAwareDocumentSeeds(
  loan: LoanForDocumentGeneration,
): GeneratedDocumentSeed[] {
  // The collateral property's state is the source of truth.
  // Do not use the borrower's mailing address or a hard-coded default.
  const rawState = loan.property_state ?? loan.state;
  const stateCode = normalizePropertyState(rawState);
  const config = getStateDocumentConfig(stateCode);
  const now = new Date().toISOString();
  const loanPart = safeFilePart(String(loan.loan_number ?? loan.id));

  const snapshot = buildTermsSnapshot(
    loan,
    config.code,
    config.name,
    config.templateVersion,
  );

  const common = {
    status: "ready_for_review" as const,
    document_state: config.code,
    template_version: config.templateVersion,
    generated_at: now,
  };

  return [
    {
      document_type: "promissory_note",
      title: `${config.name} Promissory Note — Attorney Review Required`,
      file_name: `${loanPart}-${config.code}-promissory-note.pdf`,
      terms_snapshot: {
        ...snapshot,
        document_type: "promissory_note",
      },
      ...common,
    },
    {
      document_type: config.securityInstrumentType,
      title: `${config.securityInstrumentTitle} — Attorney Review Required`,
      file_name: `${loanPart}-${config.code}-${config.securityInstrumentType}.pdf`,
      terms_snapshot: {
        ...snapshot,
        document_type: config.securityInstrumentType,
        security_instrument_title: config.securityInstrumentTitle,
      },
      ...common,
    },
    {
      document_type: "payment_schedule",
      title: `${config.name} Loan Payment Schedule`,
      file_name: `${loanPart}-${config.code}-payment-schedule.pdf`,
      terms_snapshot: {
        ...snapshot,
        document_type: "payment_schedule",
      },
      ...common,
    },
    {
      document_type: "borrower_certification",
      title: `${config.name} Borrower Certification — Attorney Review Required`,
      file_name: `${loanPart}-${config.code}-borrower-certification.pdf`,
      terms_snapshot: {
        ...snapshot,
        document_type: "borrower_certification",
      },
      ...common,
    },
    {
      document_type: "esign_consent",
      title: "Electronic Records and Signature Consent",
      file_name: `${loanPart}-${config.code}-esign-consent.pdf`,
      terms_snapshot: {
        ...snapshot,
        document_type: "esign_consent",
      },
      ...common,
    },
    {
      document_type: "closing_summary",
      title: `${config.name} Closing Summary — Attorney Review Required`,
      file_name: `${loanPart}-${config.code}-closing-summary.pdf`,
      terms_snapshot: {
        ...snapshot,
        document_type: "closing_summary",
      },
      ...common,
    },
  ];
}

export async function generateStateAwareLoanDocuments(
  loan: LoanForDocumentGeneration,
): Promise<void> {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const documents = buildStateAwareDocumentSeeds(loan).map((document) => ({
    loan_application_id: loan.id,
    borrower_user_id: loan.user_id ?? null,
    ...document,
  }));

  const { error } = await supabase
    .from("generated_loan_documents")
    .upsert(documents, {
      onConflict: "loan_application_id,document_type",
      ignoreDuplicates: false,
    });

  if (error) {
    throw new Error(
      `Unable to generate state-aware loan documents: ${error.message}`,
    );
  }

  const config = getStateDocumentConfig(
    loan.property_state ?? loan.state,
  );

  const { error: eventError } = await supabase
    .from("loan_timeline_events")
    .insert({
      loan_application_id: loan.id,
      event_type: "state_documents_generated",
      title: `${config.name} loan documents generated`,
      description:
        `${config.name} templates ${config.templateVersion} were selected ` +
        "from the collateral property's state. Attorney review is required.",
      metadata: {
        document_state: config.code,
        template_version: config.templateVersion,
        generated_document_count: documents.length,
      },
    });

  // Do not fail the approval transaction solely because an optional audit
  // event could not be inserted.
  if (eventError) {
    console.warn("Document audit event was not recorded:", eventError.message);
  }
}
