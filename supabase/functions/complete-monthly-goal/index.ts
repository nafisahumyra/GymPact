import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getAdminClient, verifyGymPactSession } from "../_shared/gympact-session.ts";

const origins = new Set(["http://localhost:3000", "http://127.0.0.1:3000", "https://nafisahumyra.github.io"]);
const headers = (request: Request) => {
  const origin = request.headers.get("origin") ?? "";
  return { "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json", ...(origins.has(origin) ? { "Access-Control-Allow-Origin": origin } : {}) };
};

serve(async request => {
  if (request.method === "OPTIONS") return new Response(null, { headers: headers(request) });
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: headers(request) });
  try {
    const form = await request.formData();
    if (!await verifyGymPactSession(form.get("sessionToken"))) return new Response(JSON.stringify({ error: "Invalid session." }), { status: 401, headers: headers(request) });
    const pactId = form.get("pactId");
    const userId = form.get("userId");
    const photo = form.get("photo");
    if (typeof pactId !== "string" || typeof userId !== "string" || !(photo instanceof File) || photo.size === 0 || photo.size > 5 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: "A proof photo is required." }), { status: 400, headers: headers(request) });
    }
    const admin = getAdminClient();
    await admin.rpc("finalize_due_monthly_pacts");
    const { data: pact } = await admin.from("monthly_pacts").select("id, status, created_by, recipient_id").eq("id", pactId).maybeSingle();
    if (!pact || pact.status !== "active" || ![pact.created_by, pact.recipient_id].includes(userId)) {
      return new Response(JSON.stringify({ error: "This goal cannot be completed now." }), { status: 409, headers: headers(request) });
    }
    const { data: commitment } = await admin.from("monthly_pact_commitments").select("completed_at").eq("monthly_pact_id", pactId).eq("user_id", userId).maybeSingle();
    if (!commitment || commitment.completed_at) return new Response(JSON.stringify({ error: "Goal already completed." }), { status: 409, headers: headers(request) });
    const path = `${pactId}/${userId}/${crypto.randomUUID()}.jpg`;
    const { error: uploadError } = await admin.storage.from("monthly-pact-proofs").upload(path, photo, { contentType: "image/jpeg", upsert: false });
    if (uploadError) throw uploadError;
    const { error: updateError } = await admin.from("monthly_pact_commitments").update({ completed_at: new Date().toISOString(), proof_path: path }).eq("monthly_pact_id", pactId).eq("user_id", userId);
    if (updateError) { await admin.storage.from("monthly-pact-proofs").remove([path]); throw updateError; }
    return new Response(JSON.stringify({ completed: true }), { headers: headers(request) });
  } catch {
    return new Response(JSON.stringify({ error: "Unable to save goal completion." }), { status: 500, headers: headers(request) });
  }
});
