import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const proofApiKey = process.env.PROOF_API_KEY || "";
const proofEnvironment = String(process.env.PROOF_ENVIRONMENT || "fairfax").toLowerCase() === "production" ? "production" : "fairfax";
const proofBaseUrl = proofEnvironment === "production" ? "https://api.proof.com" : "https://api.fairfax.proof.com";
const proofEnabled = String(process.env.PROOF_ENABLED || "false").toLowerCase() === "true";
const allowPlaceOrder = String(process.env.PROOF_ALLOW_PLACE_ORDER || "false").toLowerCase() === "true";

const NOTARY_DOC_TYPES = new Set(["deed_of_trust", "mortgage", "security_instrument"]);

function firstAndLast(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return { first_name: parts[0] || "Borrower", last_name: parts.slice(1).join(" ") || "Borrower" };
}

const STATE_ABBREVIATIONS: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO",
  connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID",
  illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY", louisiana: "LA",
  maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS",
  missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH",
  "new jersey": "NJ", "new mexico": "NM", "new york": "NY", "north carolina": "NC",
  "north dakota": "ND", ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA",
  "rhode island": "RI", "south carolina": "SC", "south dakota": "SD", tennessee: "TN",
  texas: "TX", utah: "UT", vermont: "VT", virginia: "VA", washington: "WA",
  "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
};

function normalizeState(value: unknown) {
  const raw = String(value || "").trim();
  if (/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase();
  return STATE_ABBREVIATIONS[raw.toLowerCase()] || raw.toUpperCase();
}

function parsePropertyAddress(value: unknown, fallbackState?: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  // Preferred SecuredLanding format: "street/location, City, ST 12345".
  const commaMatch = raw.match(/^(.+?),\s*([^,]+?),\s*([A-Za-z]{2}|[A-Za-z ]+)\s+(\d{5}(?:-\d{4})?)$/);
  if (commaMatch) {
    return {
      line1: commaMatch[1].trim(),
      city: commaMatch[2].trim(),
      state: normalizeState(commaMatch[3]),
      postal: commaMatch[4].trim(),
    };
  }

  // Fallback for addresses entered without commas, e.g. "123 Main St Palmdale CA 93591".
  const state = normalizeState(fallbackState);
  const stateToken = state && /^[A-Z]{2}$/.test(state) ? state : "[A-Z]{2}";
  const looseMatch = raw.match(new RegExp(`^(.+?)\\s+([A-Za-z][A-Za-z .'-]+)\\s+(${stateToken})\\s+(\\d{5}(?:-\\d{4})?)$`, "i"));
  if (looseMatch) {
    return {
      line1: looseMatch[1].trim(),
      city: looseMatch[2].trim(),
      state: normalizeState(looseMatch[3]),
      postal: looseMatch[4].trim(),
    };
  }

  return null;
}

function eligibilityJurisdictions(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.recording_jurisdictions)) return payload.recording_jurisdictions;
  if (payload && typeof payload === "object") return [payload];
  return [];
}

function supportedJurisdiction(payload: any) {
  const jurisdictions = eligibilityJurisdictions(payload);
  return jurisdictions.find((item: any) => item?.supported === true) || null;
}

async function proofFetch(path: string, init: RequestInit = {}) {
  const response = await fetch(`${proofBaseUrl}${path}`, {
    ...init,
    headers: { ApiKey: proofApiKey, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const text = await response.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  if (!response.ok) {
    const detail = body?.message || body?.error || body?.errors?.[0]?.message || text || `HTTP ${response.status}`;
    throw new Error(`Proof API: ${detail}`);
  }
  return body;
}

async function authenticate(req: any, db: any) {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) throw Object.assign(new Error("Missing user auth token."), { statusCode: 401 });
  const { data: { user }, error } = await db.auth.getUser(token);
  if (error || !user) throw Object.assign(new Error("Invalid user auth token."), { statusCode: 401 });
  return user;
}

async function ownedLoan(db: any, userId: string, loanId: number) {
  const { data, error } = await db.from("loan_applications")
    .select("id,user_id,loan_number,full_name,business_name,email,phone,property_address,county,state,status")
    .eq("id", loanId).eq("user_id", userId).single();
  if (error || !data) throw Object.assign(new Error("Loan not found for this borrower."), { statusCode: 404 });
  return data;
}

async function getRow(db: any, loanId: number) {
  const { data, error } = await db.from("proof_notary_transactions").select("*").eq("loan_application_id", loanId).maybeSingle();
  if (error && !/does not exist|schema cache/i.test(error.message || "")) throw error;
  return data || null;
}

async function saveRow(db: any, loan: any, patch: Record<string, any>) {
  const payload = {
    loan_application_id: Number(loan.id),
    borrower_user_id: loan.user_id,
    provider: "proof",
    environment: proofEnvironment,
    updated_at: new Date().toISOString(),
    ...patch,
  };
  const { data, error } = await db.from("proof_notary_transactions")
    .upsert(payload, { onConflict: "loan_application_id" }).select("*").single();
  if (error) {
    if (/does not exist|schema cache/i.test(error.message || "")) {
      throw new Error("Proof database migration is not installed yet. Run 20260912_v4_5_3_proof_closing_integration.sql in Supabase first.");
    }
    throw error;
  }
  return data;
}

function requireProof() {
  if (!proofApiKey) throw Object.assign(new Error("PROOF_API_KEY is not configured on the server."), { statusCode: 503 });
}

export default async function handler(req: any, res: any) {
  try {
    if (!supabaseUrl || !serviceRoleKey) return res.status(500).json({ error: "Missing Supabase server environment variables." });
    const db = createClient(supabaseUrl, serviceRoleKey);
    const user = await authenticate(req, db);
    const loanId = Number(req.method === "GET" ? req.query?.loanId : req.body?.loanId);
    if (!Number.isFinite(loanId) || loanId <= 0) return res.status(400).json({ error: "A valid loanId is required." });
    const loan = await ownedLoan(db, user.id, loanId);

    if (req.method === "GET") {
      return res.status(200).json({
        configured: Boolean(proofApiKey), enabled: proofEnabled, environment: proofEnvironment,
        allowPlaceOrder, transaction: await getRow(db, loanId),
      });
    }
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const action = String(req.body?.action || "");
    requireProof();
    let row = await getRow(db, loanId);

    if (action === "check_eligibility") {
      const address = parsePropertyAddress(loan.property_address, loan.state);
      if (!address) {
        return res.status(400).json({
          error: "Proof requires a full property address in the format 'street/location, City, ST ZIP'. Update the property address before checking eligibility.",
        });
      }
      const qs = new URLSearchParams({
        transaction_type: String(process.env.PROOF_TRANSACTION_TYPE || "other"),
        "street_address[line1]": address.line1,
        "street_address[city]": address.city,
        "street_address[state]": address.state,
        "street_address[postal]": address.postal,
        "street_address[country]": "US",
      });
      const eligibility = await proofFetch(`/mortgage/v2/transactions/verify_address?${qs.toString()}`, { method: "GET" });
      const jurisdiction = supportedJurisdiction(eligibility);
      const supported = Boolean(jurisdiction);
      row = await saveRow(db, loan, {
        status: supported ? "eligible" : "not_eligible",
        eligibility_status: supported ? "supported" : "not_supported",
        property_supported: supported,
        eligibility_response: eligibility,
        last_error: null,
      });
      return res.status(200).json({
        success: true,
        message: supported
          ? "Proof reports this property is eligible for online closing."
          : "Proof did not report this property as eligible for online closing.",
        transaction: row,
      });
    }

    if (action === "create_transaction") {
      if (!proofEnabled) return res.status(409).json({ error: "Proof transaction creation is disabled. Set PROOF_ENABLED=true after the Fairfax/test account is ready." });
      if (row?.proof_transaction_id) return res.status(200).json({ success: true, message: "A Proof transaction already exists for this loan.", transaction: row });
      if (row?.property_supported !== true && String(process.env.PROOF_REQUIRE_ELIGIBILITY || "true").toLowerCase() !== "false") {
        return res.status(409).json({ error: "Check Proof property eligibility before creating the transaction." });
      }
      const address = parsePropertyAddress(loan.property_address, loan.state);
      if (!address) {
        return res.status(400).json({
          error: "Proof requires a full property address in the format 'street/location, City, ST ZIP' before a transaction can be created.",
        });
      }
      const name = firstAndLast(String(loan.full_name || loan.business_name || "Borrower"));
      const payload: any = {
        transaction_type: String(process.env.PROOF_TRANSACTION_TYPE || "other"),
        transaction_name: `SecuredLanding Loan ${loan.loan_number || loan.id}`,
        loan_number: String(loan.loan_number || loan.id),
        external_id: `securedlanding-loan-${loan.id}`,
        draft: true,
        signers: [{ email: loan.email || user.email, ...name, external_id: user.id }],
        street_address: {
          line1: address.line1,
          city: address.city,
          state: address.state,
          zip_code: address.postal,
        },
        message_subject: `SecuredLanding closing — Loan #${loan.loan_number || loan.id}`,
        message_to_signer: "Complete the identity verification and remote online notarization steps for your SecuredLanding closing. County recording is handled separately after notarization.",
      };
      const eligibility = row?.eligibility_response || {};
      const jurisdictionObject = supportedJurisdiction(eligibility) || eligibilityJurisdictions(eligibility)[0] || {};
      const jurisdiction = jurisdictionObject?.id || jurisdictionObject?.recording_jurisdiction_id;
      const titleAgency = jurisdictionObject?.eligible_title_agencies?.[0] || eligibility?.eligible_title_agencies?.[0] || {};
      const titleAgencyId = process.env.PROOF_TITLE_AGENCY_ID || titleAgency?.id;
      const titleUnderwriterId =
        process.env.PROOF_TITLE_UNDERWRITER_ID ||
        titleAgency?.eligible_title_underwriters?.[0]?.id ||
        titleAgency?.eligible_underwriters?.[0]?.id ||
        jurisdictionObject?.eligible_title_underwriters?.[0]?.id;
      if (jurisdiction) payload.recording_jurisdiction_id = jurisdiction;
      if (titleAgencyId) payload.title_agency_id = titleAgencyId;
      if (titleUnderwriterId) payload.title_underwriter_id = titleUnderwriterId;
      if (process.env.PROOF_CONFIG_ID) payload.config_id = process.env.PROOF_CONFIG_ID;
      const created = await proofFetch("/mortgage/v2/transactions", { method: "POST", body: JSON.stringify(payload) });
      const proofId = created?.id || created?.transaction_id;
      if (!proofId) throw new Error("Proof created the transaction but did not return a transaction ID.");
      row = await saveRow(db, loan, {
        status: "draft_created", proof_transaction_id: proofId,
        proof_transaction_status: created?.status || "started", proof_transaction_response: created,
        last_error: null,
      });
      return res.status(200).json({ success: true, message: `Proof draft ${proofId} created.`, transaction: row });
    }

    if (action === "upload_documents") {
      if (!row?.proof_transaction_id) return res.status(409).json({ error: "Create the Proof draft before sending documents." });
      const { data: docs, error: docsError } = await db.from("generated_loan_documents")
        .select("id,document_type,title,storage_path,status")
        .eq("loan_application_id", loanId).not("storage_path", "is", null);
      if (docsError) throw docsError;
      const sendable = (docs || []).filter((doc: any) => String(doc.storage_path || "").trim());
      if (!sendable.length) {
        return res.status(409).json({ error: "No approved PDF closing files are stored yet. Proof will not receive the prototype HTML-only forms. Upload attorney-approved final PDFs first." });
      }
      let uploaded = Number(row.documents_uploaded || 0);
      const uploadedTrackingIds = new Set<string>((row.uploaded_document_tracking_ids || []).map(String));
      let uploadedThisRun = 0;
      for (const doc of sendable) {
        const trackingId = `generated-loan-document-${doc.id}`;
        if (uploadedTrackingIds.has(trackingId)) continue;
        const path = String(doc.storage_path);
        const { data: signed, error: signedError } = await db.storage.from("loan-documents").createSignedUrl(path, 900);
        if (signedError || !signed?.signedUrl) throw new Error(`Could not create a temporary URL for ${doc.title || doc.document_type}.`);
        await proofFetch(`/mortgage/v2/transactions/${encodeURIComponent(row.proof_transaction_id)}/documents`, {
          method: "POST",
          body: JSON.stringify({
            filename: `${doc.title || doc.document_type}.pdf`,
            resource: signed.signedUrl,
            tracking_id: trackingId,
            notarization_required: NOTARY_DOC_TYPES.has(String(doc.document_type)),
            esign_required: true,
          }),
        });
        uploaded += 1;
        uploadedThisRun += 1;
        uploadedTrackingIds.add(trackingId);
      }
      row = await saveRow(db, loan, {
        documents_uploaded: uploaded,
        uploaded_document_tracking_ids: Array.from(uploadedTrackingIds),
        status: uploaded > 0 ? "documents_uploaded" : row.status,
        last_error: null,
      });
      return res.status(200).json({
        success: true,
        message: uploadedThisRun ? `${uploadedThisRun} approved PDF document(s) sent to Proof.` : "All available approved PDFs were already sent to Proof.",
        transaction: row,
      });
    }

    if (action === "place_order") {
      if (!allowPlaceOrder) return res.status(409).json({ error: "Proof place-order is locked. Set PROOF_ALLOW_PLACE_ORDER=true only after final document review." });
      if (!row?.proof_transaction_id) return res.status(409).json({ error: "Create the Proof draft first." });
      if (Number(row.documents_uploaded || 0) < 1) return res.status(409).json({ error: "Send the final approved PDFs to Proof before placing the order." });
      const placed = await proofFetch(`/mortgage/v2/transactions/${encodeURIComponent(row.proof_transaction_id)}/place_order`, {
        method: "POST", body: JSON.stringify({ suppress_email: false, require_new_signer_verification: true, skip_closing_ops: false }),
      });
      row = await saveRow(db, loan, { status: "sent_to_proof", placed_order_at: new Date().toISOString(), proof_transaction_response: placed, last_error: null });
      return res.status(200).json({ success: true, message: "Closing package sent to the Proof closing team.", transaction: row });
    }

    if (action === "refresh") {
      if (!row?.proof_transaction_id) return res.status(409).json({ error: "No Proof transaction exists yet." });
      const current = await proofFetch(`/mortgage/v2/transactions/${encodeURIComponent(row.proof_transaction_id)}`, { method: "GET" });
      row = await saveRow(db, loan, { proof_transaction_status: current?.status || row.proof_transaction_status, proof_transaction_response: current, last_error: null });
      return res.status(200).json({ success: true, message: "Proof transaction status refreshed.", transaction: row });
    }

    return res.status(400).json({ error: "Unsupported Proof action." });
  } catch (error: any) {
    return res.status(error?.statusCode || 500).json({ error: error?.message || "Proof closing request failed." });
  }
}
