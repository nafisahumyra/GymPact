import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getAdminClient, verifyGymPactSession } from "../_shared/gympact-session.ts";

const allowedOrigins = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://nafisahumyra.github.io",
]);

function getCorsHeaders(request: Request) {
  const origin = request.headers.get("origin") ?? "";
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };

  if (allowedOrigins.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

serve(async (request) => {
  const corsHeaders = getCorsHeaders(request);

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const { sessionToken, pactId, athleteId } = await request.json();
    const session = await verifyGymPactSession(sessionToken);

    if (!session) {
      return new Response(JSON.stringify({ error: "Invalid session." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (typeof pactId !== "string" || typeof athleteId !== "string") {
      return new Response(JSON.stringify({ error: "Invalid pact." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = getAdminClient();
    const { data: pendingPact, error: pactError } = await admin
      .from("pacts")
      .select("id, created_by, pact_participants(user_id)")
      .eq("id", pactId)
      .eq("status", "pending")
      .maybeSingle();

    if (pactError) {
      throw pactError;
    }

    const isParticipant = pendingPact?.pact_participants
      ?.some(participant => participant.user_id === athleteId);

    if (!pendingPact || !isParticipant) {
      return new Response(JSON.stringify({ error: "Pending pact not found." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (pendingPact.created_by === athleteId) {
      return new Response(JSON.stringify({ error: "Pact creators cannot accept their own challenge." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: pact, error: updateError } = await admin
      .from("pacts")
      .update({ status: "active" })
      .eq("id", pactId)
      .eq("status", "pending")
      .select("id, status")
      .maybeSingle();

    if (updateError) {
      throw updateError;
    }

    if (!pact) {
      return new Response(JSON.stringify({ error: "Pact is no longer pending." }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ pact }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Unable to accept pact." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
