import { createClient } from "npm:@supabase/supabase-js@2";

const SESSION_DURATION_MS = 4 * 60 * 60 * 1000;

function getAdminClient() {
  const projectUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!projectUrl || !serviceRoleKey) {
    throw new Error("Session storage is not configured.");
  }

  return createClient(projectUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function createSessionToken() {
  const bytes = new Uint8Array(32);

  crypto.getRandomValues(bytes);

  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

async function hashToken(token: string) {
  const tokenBytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", tokenBytes);

  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function createGymPactSession() {
  const admin = getAdminClient();
  const token = createSessionToken();
  const tokenHash = await hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();

  const { error } = await admin
    .from("gympact_sessions")
    .insert({
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

  if (error) {
    throw new Error("session-insert-failed");
  }

  return { token, expiresAt };
}

export async function verifyGymPactSession(token: unknown) {
  if (typeof token !== "string" || token.length === 0) {
    return null;
  }

  const admin = getAdminClient();
  const tokenHash = await hashToken(token);
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("gympact_sessions")
    .select("id, expires_at")
    .eq("token_hash", tokenHash)
    .gt("expires_at", now)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
}
