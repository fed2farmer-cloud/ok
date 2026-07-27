export const SUPPORTED_PROPERTY_STATES = [
  "CA", "TX", "AZ", "NV", "WA", "OR",
  "CO", "UT", "VA", "NC", "AR", "MO",
] as const;

export type SupportedPropertyState =
  (typeof SUPPORTED_PROPERTY_STATES)[number];

export type SecurityInstrumentType =
  | "deed_of_trust"
  | "mortgage";

export interface StateDocumentConfig {
  code: SupportedPropertyState;
  name: string;
  securityInstrumentType: SecurityInstrumentType;
  securityInstrumentTitle: string;
  templateVersion: string;
  attorneyReviewRequired: true;
}

export const STATE_DOCUMENT_CONFIG: Record<
  SupportedPropertyState,
  StateDocumentConfig
> = {
  CA: {
    code: "CA",
    name: "California",
    securityInstrumentType: "deed_of_trust",
    securityInstrumentTitle: "California Deed of Trust",
    templateVersion: "CA-2026.1",
    attorneyReviewRequired: true,
  },
  TX: {
    code: "TX",
    name: "Texas",
    securityInstrumentType: "deed_of_trust",
    securityInstrumentTitle: "Texas Deed of Trust",
    templateVersion: "TX-2026.1",
    attorneyReviewRequired: true,
  },
  AZ: {
    code: "AZ",
    name: "Arizona",
    securityInstrumentType: "deed_of_trust",
    securityInstrumentTitle: "Arizona Deed of Trust",
    templateVersion: "AZ-2026.1",
    attorneyReviewRequired: true,
  },
  NV: {
    code: "NV",
    name: "Nevada",
    securityInstrumentType: "deed_of_trust",
    securityInstrumentTitle: "Nevada Deed of Trust",
    templateVersion: "NV-2026.1",
    attorneyReviewRequired: true,
  },
  WA: {
    code: "WA",
    name: "Washington",
    securityInstrumentType: "deed_of_trust",
    securityInstrumentTitle: "Washington Deed of Trust",
    templateVersion: "WA-2026.1",
    attorneyReviewRequired: true,
  },
  OR: {
    code: "OR",
    name: "Oregon",
    securityInstrumentType: "deed_of_trust",
    securityInstrumentTitle: "Oregon Trust Deed",
    templateVersion: "OR-2026.1",
    attorneyReviewRequired: true,
  },
  CO: {
    code: "CO",
    name: "Colorado",
    securityInstrumentType: "deed_of_trust",
    securityInstrumentTitle: "Colorado Deed of Trust",
    templateVersion: "CO-2026.1",
    attorneyReviewRequired: true,
  },
  UT: {
    code: "UT",
    name: "Utah",
    securityInstrumentType: "deed_of_trust",
    securityInstrumentTitle: "Utah Trust Deed",
    templateVersion: "UT-2026.1",
    attorneyReviewRequired: true,
  },
  VA: {
    code: "VA",
    name: "Virginia",
    securityInstrumentType: "deed_of_trust",
    securityInstrumentTitle: "Virginia Deed of Trust",
    templateVersion: "VA-2026.1",
    attorneyReviewRequired: true,
  },
  NC: {
    code: "NC",
    name: "North Carolina",
    securityInstrumentType: "deed_of_trust",
    securityInstrumentTitle: "North Carolina Deed of Trust",
    templateVersion: "NC-2026.1",
    attorneyReviewRequired: true,
  },
  AR: {
    code: "AR",
    name: "Arkansas",
    securityInstrumentType: "mortgage",
    securityInstrumentTitle: "Arkansas Real Estate Mortgage",
    templateVersion: "AR-2026.1",
    attorneyReviewRequired: true,
  },
  MO: {
    code: "MO",
    name: "Missouri",
    securityInstrumentType: "deed_of_trust",
    securityInstrumentTitle: "Missouri Deed of Trust",
    templateVersion: "MO-2026.1",
    attorneyReviewRequired: true,
  },
};

const STATE_NAME_TO_CODE: Record<string, SupportedPropertyState> =
  Object.values(STATE_DOCUMENT_CONFIG).reduce((acc, config) => {
    acc[config.name.toUpperCase()] = config.code;
    return acc;
  }, {} as Record<string, SupportedPropertyState>);

export function normalizePropertyState(
  value: string | null | undefined,
): SupportedPropertyState {
  const normalized = (value ?? "").trim().toUpperCase();

  if (
    SUPPORTED_PROPERTY_STATES.includes(
      normalized as SupportedPropertyState,
    )
  ) {
    return normalized as SupportedPropertyState;
  }

  const fromName = STATE_NAME_TO_CODE[normalized];
  if (fromName) return fromName;

  throw new Error(
    `Unsupported or missing property state: "${value ?? ""}". ` +
      `Supported states: ${SUPPORTED_PROPERTY_STATES.join(", ")}.`,
  );
}

export function getStateDocumentConfig(
  value: string | null | undefined,
): StateDocumentConfig {
  return STATE_DOCUMENT_CONFIG[normalizePropertyState(value)];
}
