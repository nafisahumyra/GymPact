import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getAdminClient, verifyGymPactSession } from "../_shared/gympact-session.ts";

const allowedOrigins = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://nafisahumyra.github.io",
]);

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") ?? "";
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };

  if (allowedOrigins.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function json(body: unknown, request: Request, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), "Content-Type": "application/json" },
  });
}

serve(async request => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders(request) });
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders(request) });

  try {
    const { sessionToken, userId } = await request.json();
    const session = await verifyGymPactSession(sessionToken);
    if (!session || typeof userId !== "string") return json({ error: "Invalid athlete selection." }, request, 401);

    const admin = getAdminClient();
    const { data: athlete, error: athleteError } = await admin
      .from("users")
      .select("id, display_name")
      .eq("id", userId)
      .maybeSingle();
    if (athleteError) throw athleteError;
    if (!athlete) return json({ error: "Athlete not found." }, request, 404);

    if (session.athlete_id && session.athlete_id !== athlete.id) {
      return json({ error: "This session is already assigned to another athlete." }, request, 403);
    }

    if (!session.athlete_id) {
      const { data: updated, error: updateError } = await admin
        .from("gympact_sessions")
        .update({ athlete_id: athlete.id })
        .eq("id", session.id)
        .is("athlete_id", null)
        .select("id")
        .maybeSingle();
      if (updateError) throw updateError;
      if (!updated) return json({ error: "This session is already assigned to another athlete." }, request, 403);
    }

    return json({ athlete }, request);
  } catch (error) {
    console.error("Unable to select athlete.", error);
    return json({ error: "Unable to select athlete." }, request, 500);
  }
});
