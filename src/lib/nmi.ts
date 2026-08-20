/**
 * NMI browser tokenization configuration.
 *
 * The browser key MUST come from the same NMI merchant/environment as the
 * server-side private key. Environment-specific keys take priority so an old
 * generic VITE_NMI_PUBLIC_KEY cannot silently override a live deployment.
 */
export type NmiBrowserEnvironment = "live" | "sandbox";

export function getNmiBrowserEnvironment(): NmiBrowserEnvironment {
  const env = String(import.meta.env.VITE_NMI_ENVIRONMENT || "").trim().toLowerCase();
  if (env === "live" || env === "production") return "live";
  if (env === "sandbox" || env === "test") return "sandbox";

  // securedlanding.com is production. Do not label the production site sandbox
  // merely because VITE_NMI_ENVIRONMENT was omitted at build time.
  if (typeof window !== "undefined" && /(^|\.)securedlanding\.com$/i.test(window.location.hostname)) return "live";
  return "sandbox";
}

export function getNmiTokenizationKey(): string {
  const env = getNmiBrowserEnvironment();

  const environmentKey = env === "live"
    ? import.meta.env.VITE_NMI_LIVE_TOKENIZATION_KEY
    : import.meta.env.VITE_NMI_SANDBOX_TOKENIZATION_KEY;

  const fallbackKey = import.meta.env.VITE_NMI_PUBLIC_KEY || import.meta.env.VITE_NMI_TOKENIZATION_KEY;
  const key = environmentKey || fallbackKey;

  if (!key) {
    throw new Error(
      env === "live"
        ? "NMI live public tokenization key is not configured. Set VITE_NMI_LIVE_TOKENIZATION_KEY."
        : "NMI sandbox public tokenization key is not configured. Set VITE_NMI_SANDBOX_TOKENIZATION_KEY."
    );
  }

  return String(key).trim();
}

/** Safe configuration metadata. Never returns any part of the key itself. */
export function getNmiBrowserDiagnostics() {
  const env = getNmiBrowserEnvironment();
  const envSpecificPresent = Boolean(
    env === "live"
      ? import.meta.env.VITE_NMI_LIVE_TOKENIZATION_KEY
      : import.meta.env.VITE_NMI_SANDBOX_TOKENIZATION_KEY
  );
  const genericPresent = Boolean(import.meta.env.VITE_NMI_PUBLIC_KEY || import.meta.env.VITE_NMI_TOKENIZATION_KEY);
  const key = getNmiTokenizationKey();

  return {
    environment: env,
    keySource: envSpecificPresent ? "environment-specific" : "generic-fallback",
    keyConfigured: Boolean(key),
    keyLength: key.length,
    genericKeyAlsoPresent: genericPresent,
  };
}
