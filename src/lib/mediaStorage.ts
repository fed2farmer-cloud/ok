import { supabase } from "./supabase";

export function normalizeStoragePath(rawValue: string | null | undefined, bucket: string): string {
  const value = String(rawValue ?? "").trim();
  if (!value) return "";

  try {
    if (/^https?:\/\//i.test(value)) {
      const url = new URL(value);
      const markers = [
        `/storage/v1/object/public/${bucket}/`,
        `/storage/v1/object/sign/${bucket}/`,
        `/storage/v1/object/authenticated/${bucket}/`,
      ];
      for (const marker of markers) {
        const index = url.pathname.indexOf(marker);
        if (index >= 0) {
          return decodeURIComponent(url.pathname.slice(index + marker.length)).replace(/^\/+/, "");
        }
      }
      return value;
    }
  } catch {
    // Fall through and treat it as a storage object path.
  }

  let cleaned = value.replace(/^\/+/, "");
  const prefixes = [
    `${bucket}/`,
    `storage/v1/object/public/${bucket}/`,
    `storage/v1/object/sign/${bucket}/`,
    `storage/v1/object/authenticated/${bucket}/`,
  ];
  for (const prefix of prefixes) {
    const index = cleaned.indexOf(prefix);
    if (index >= 0) cleaned = cleaned.slice(index + prefix.length);
  }
  try {
    return decodeURIComponent(cleaned).replace(/^\/+/, "");
  } catch {
    return cleaned.replace(/^\/+/, "");
  }
}

export async function resolveStorageUrl(
  bucket: string,
  rawValue: string | null | undefined,
  expiresInSeconds = 3600,
): Promise<string> {
  if (!supabase) return "";
  const path = normalizeStoragePath(rawValue, bucket);
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;

  const signed = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  if (!signed.error && signed.data?.signedUrl) return signed.data.signedUrl;

  const publicResult = supabase.storage.from(bucket).getPublicUrl(path);
  const publicUrl = publicResult.data?.publicUrl ?? "";
  if (publicUrl) return publicUrl;

  console.error("Unable to resolve storage media", {
    bucket,
    rawValue,
    normalizedPath: path,
    signedError: signed.error?.message,
  });
  return "";
}
