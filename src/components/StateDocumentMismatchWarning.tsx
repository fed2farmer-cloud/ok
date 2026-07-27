import {
  getStateDocumentConfig,
  normalizePropertyState,
} from "../config/stateDocumentConfig";

interface Props {
  propertyState?: string | null;
  documentState?: string | null;
  title?: string | null;
}

export default function StateDocumentMismatchWarning({
  propertyState,
  documentState,
  title,
}: Props) {
  try {
    const expected = normalizePropertyState(propertyState);
    const actual = documentState
      ? normalizePropertyState(documentState)
      : null;
    const config = getStateDocumentConfig(expected);

    const titleLooksWrong =
      Boolean(title) &&
      Object.values({
        CA: "California",
        TX: "Texas",
        AZ: "Arizona",
        NV: "Nevada",
        WA: "Washington",
        OR: "Oregon",
        CO: "Colorado",
        UT: "Utah",
        VA: "Virginia",
        NC: "North Carolina",
        AR: "Arkansas",
        MO: "Missouri",
      }).some(
        (stateName) =>
          stateName !== config.name &&
          title!.toLowerCase().includes(stateName.toLowerCase()),
      );

    if (actual === expected && !titleLooksWrong) return null;

    return (
      <div
        role="alert"
        className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-900"
      >
        <p className="font-bold">State document mismatch blocked</p>
        <p className="mt-1 text-sm">
          This property is in {config.name} ({expected}), but the saved
          document does not match that state. Regenerate the loan package
          before review or signature.
        </p>
      </div>
    );
  } catch (error) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900"
      >
        <p className="font-bold">Property state needs review</p>
        <p className="mt-1 text-sm">
          {error instanceof Error
            ? error.message
            : "The property state is missing or unsupported."}
        </p>
      </div>
    );
  }
}
