/**
 * NMI browser tokenization configuration.
 *
 * Preferred variable for the current SecuredLanding deployment:
 *   VITE_NMI_PUBLIC_KEY
 *
 * Legacy names are retained as fallbacks so older deployments do not break.
 * The public tokenization key is intentionally browser-safe; private merchant
 * API keys must remain server-side only.
 */
export function getNmiTokenizationKey(): string {
  const directKey = import.meta.env.VITE_NMI_PUBLIC_KEY;
  if (directKey) return String(directKey).trim();

  const env = String(import.meta.env.VITE_NMI_ENVIRONMENT || "sandbox").toLowerCase();
  const isLive = env === "production" || env === "live";
  const legacyKey = isLive
    ? (import.meta.env.VITE_NMI_LIVE_TOKENIZATION_KEY || import.meta.env.VITE_NMI_TOKENIZATION_KEY)
    : (import.meta.env.VITE_NMI_SANDBOX_TOKENIZATION_KEY || import.meta.env.VITE_NMI_TOKENIZATION_KEY);

  if (!legacyKey) {
    throw new Error(
      "NMI public tokenization key is not configured. Set VITE_NMI_PUBLIC_KEY."
    );
  }

  return String(legacyKey).trim();
}
