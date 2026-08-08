/**
 * NMI public tokenization configuration.
 * Keep the browser tokenization key paired with the same merchant environment
 * as the private server-side NMI_API_KEY.
 */
export function getNmiTokenizationKey(): string {
  const env = String(import.meta.env.VITE_NMI_ENVIRONMENT || "sandbox").toLowerCase();
  const isLive = env === "production" || env === "live";
  const key = isLive
    ? (import.meta.env.VITE_NMI_LIVE_TOKENIZATION_KEY || import.meta.env.VITE_NMI_TOKENIZATION_KEY)
    : (import.meta.env.VITE_NMI_SANDBOX_TOKENIZATION_KEY || import.meta.env.VITE_NMI_TOKENIZATION_KEY);

  if (!key) {
    throw new Error(
      isLive
        ? "NMI live tokenization key is not configured."
        : "NMI sandbox tokenization key is not configured."
    );
  }
  return String(key);
}
