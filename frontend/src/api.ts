export type Config = {
  market: string;
  demo: boolean;
  generation_enabled: boolean;
  provider: string;
  features: {
    community: boolean;
    video: boolean;
    payments: boolean;
    local_review?: boolean;
    share_preview?: boolean;
  };
  upload: { max_bytes: number; mime_types: string[] };
};
export type Version = {
  id: string;
  root_version_id: string;
  parent_version_id: string | null;
  story_world_id: string;
  creator_id: string;
  title: string;
  caption: string;
  image_url: string | null;
  source_id: string | null;
  depth: number;
  remix_allowed: boolean;
  favorite?: boolean;
  safety_state: string;
  demo: boolean;
  created_at: number | string;
};
export type Job = {
  input_summary?: {
    kind?: string;
    text_excerpt?: string;
    source_id?: string | null;
    source_url?: string | null;
    parent_version_id?: string | null;
    locale?: string;
  };
  id: string;
  status: string;
  stage: string;
  version_id: string | null;
  error: { code: string; message: string } | null;
  demo: boolean;
};
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const multipart = options.body instanceof FormData;
  const r = await fetch("/api/v1" + path, {
    ...options,
    credentials: "include",
    headers: {
      ...(!multipart ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok)
    throw new ApiError(
      body.error?.code || "NETWORK_ERROR",
      body.error?.message || r.statusText,
    );
  return body;
}
export const post = <T = any>(path: string, body: unknown = {}) =>
  api<T>(path, { method: "POST", body: JSON.stringify(body) });
