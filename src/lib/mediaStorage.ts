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

function parentFolder(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash >= 0 ? path.slice(0, slash) : "";
}

/**
 * Returns signed URL candidates in priority order.
 *
 * The exact database path is tried first. If that object was replaced or a
 * shared object was removed, the latest files in the same loan folder are
 * also returned as recovery candidates.
 */
export async function resolveStorageUrls(
  bucket: string,
  rawValue: string | null | undefined,
  expiresInSeconds = 3600,
): Promise<string[]> {
  if (!supabase) return [];

  const path = normalizeStoragePath(rawValue, bucket);
  if (!path) return [];
  if (/^https?:\/\//i.test(path)) return [path];

  const candidatePaths: string[] = [path];
  const folder = parentFolder(path);

  if (folder) {
    const { data: listed, error: listError } = await supabase.storage
      .from(bucket)
      .list(folder, {
        limit: 100,
        sortBy: { column: "updated_at", order: "desc" },
      });

    if (listError) {
      console.warn("Unable to list media recovery candidates", {
        bucket,
        folder,
        message: listError.message,
      });
    } else {
      for (const item of listed ?? []) {
        if (!item.name || item.name === ".emptyFolderPlaceholder") continue;
        const siblingPath = `${folder}/${item.name}`;
        if (!candidatePaths.includes(siblingPath)) candidatePaths.push(siblingPath);
      }
    }
  }

  const urls: string[] = [];
  for (const candidatePath of candidatePaths) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(candidatePath, expiresInSeconds);

    if (!error && data?.signedUrl) {
      urls.push(data.signedUrl);
    } else if (candidatePath === path) {
      console.error("Unable to sign requested storage object", {
        bucket,
        rawValue,
        normalizedPath: path,
        message: error?.message,
      });
    }
  }

  return [...new Set(urls)];
}

export async function resolveStorageUrl(
  bucket: string,
  rawValue: string | null | undefined,
  expiresInSeconds = 3600,
): Promise<string> {
  const urls = await resolveStorageUrls(bucket, rawValue, expiresInSeconds);
  return urls[0] ?? "";
}
