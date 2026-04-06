import {
  getSupabaseEnvHints,
  getSupabaseServerConfig,
} from "@/lib/server/supabase-config";
import { SupabaseRestError } from "@/lib/server/supabase-rest";

function getSupabaseConfig() {
  const { supabaseUrl, serviceRoleKey } = getSupabaseServerConfig();

  if (!supabaseUrl) {
    throw new SupabaseRestError("Missing Supabase URL. " + getSupabaseEnvHints(), 500);
  }

  if (!serviceRoleKey) {
    throw new SupabaseRestError("Missing service role key. " + getSupabaseEnvHints(), 500);
  }

  return {
    supabaseUrl,
    serviceRoleKey,
  };
}

export async function uploadToSupabaseStorage(
  bucket: string,
  objectPath: string,
  fileBytes: ArrayBuffer,
  contentType: string
): Promise<void> {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();

  const encodedPath = objectPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  const response = await fetch(
    `${supabaseUrl}/storage/v1/object/${bucket}/${encodedPath}`,
    {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": contentType,
        "x-upsert": "false",
      },
      body: fileBytes,
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const detailsText = await response.text();
    throw new SupabaseRestError(
      "Failed to upload file to Supabase Storage.",
      response.status,
      detailsText
    );
  }
}

type StorageSignedUrlPayload = {
  signedURL?: string;
  signedUrl?: string;
  token?: string;
};

function encodeObjectPath(objectPath: string): string {
  return objectPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function buildAbsoluteSignedUrl(
  supabaseUrl: string,
  bucket: string,
  encodedPath: string,
  payload: StorageSignedUrlPayload
): string {
  const signedPath = payload.signedURL ?? payload.signedUrl;
  if (signedPath) {
    if (/^https?:\/\//i.test(signedPath)) {
      return signedPath;
    }

    const normalizedPath = signedPath.startsWith("/")
      ? signedPath
      : `/${signedPath}`;

    return `${supabaseUrl}/storage/v1${normalizedPath}`;
  }

  if (payload.token) {
    return `${supabaseUrl}/storage/v1/object/sign/${bucket}/${encodedPath}?token=${encodeURIComponent(
      payload.token
    )}`;
  }

  throw new SupabaseRestError(
    "Invalid signed URL response from Supabase Storage.",
    500,
    payload
  );
}

export async function createSupabaseStorageSignedUrl(
  bucket: string,
  objectPath: string,
  expiresInSeconds = 300
): Promise<string> {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const encodedPath = encodeObjectPath(objectPath);

  const response = await fetch(
    `${supabaseUrl}/storage/v1/object/sign/${bucket}/${encodedPath}`,
    {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        expiresIn: expiresInSeconds,
      }),
      cache: "no-store",
    }
  );

  const raw = await response.text();

  if (!response.ok) {
    throw new SupabaseRestError(
      "Failed to create Supabase Storage signed URL.",
      response.status,
      raw
    );
  }

  let payload: StorageSignedUrlPayload;
  try {
    payload = (raw ? JSON.parse(raw) : {}) as StorageSignedUrlPayload;
  } catch {
    throw new SupabaseRestError(
      "Invalid JSON from Supabase Storage signed URL response.",
      500,
      raw
    );
  }

  return buildAbsoluteSignedUrl(supabaseUrl, bucket, encodedPath, payload);
}
