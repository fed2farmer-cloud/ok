/**
 * NMI browser tokenization configuration.
 *
 * v4.4.6: environment is explicit and fail-safe. A production hostname no
 * longer forces the LIVE NMI merchant. This lets securedlanding.com run a
 * sandbox merchant during end-to-end testing. Live mode must be explicitly
 * enabled with VITE_NMI_ENVIRONMENT=live.
 */
export type NmiBrowserEnvironment = "live" | "sandbox";

export function getNmiBrowserEnvironment(): NmiBrowserEnvironment {
  const env = String(import.meta.env.VITE_NMI_ENVIRONMENT || "sandbox")
    .trim()
    .toLowerCase();

  if (env === "live" || env === "production") return "live";
  return "sandbox";
}

export function getNmiTokenizationKey(): string {
  const env = getNmiBrowserEnvironment();

  const environmentKey = env === "live"
    ? import.meta.env.VITE_NMI_LIVE_TOKENIZATION_KEY
    : import.meta.env.VITE_NMI_SANDBOX_TOKENIZATION_KEY;

  // Generic keys remain supported for older deployments, but an
  // environment-specific key always wins.
  const fallbackKey =
    import.meta.env.VITE_NMI_PUBLIC_KEY ||
    import.meta.env.VITE_NMI_TOKENIZATION_KEY;
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
  const genericPresent = Boolean(
    import.meta.env.VITE_NMI_PUBLIC_KEY ||
    import.meta.env.VITE_NMI_TOKENIZATION_KEY
  );
  const key = getNmiTokenizationKey();

  return {
    environment: env,
    keySource: envSpecificPresent ? "environment-specific" : "generic-fallback",
    keyConfigured: Boolean(key),
    keyLength: key.length,
    genericKeyAlsoPresent: genericPresent,
  };
}
