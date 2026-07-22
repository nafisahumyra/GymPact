import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getAdminClient, verifyGymPactSession } from "../_shared/gympact-session.ts";

const allowedOrigins = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

function getCorsHeaders(request: Request) {
  const origin = request.headers.get("origin") ?? "";

  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "null",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function mapPact(pact: Record<string, unknown>) {
  const participants = Array.isArray(pact.pact_participants)
    ? pact.pact_participants
      .map(participant => (participant as { user_id?: string }).user_id)
      .filter((userId): userId is string => typeof userId === "string")
    : [];

  return {
    id: pact.id,
    participants,
    goalType: pact.goal_type,
    targetAmount: pact.target_amount,
    timeframe: pact.timeframe,
    wagerType: pact.wager_type,
    wagerDescription: pact.wager_description,
    status: pact.status,
    createdAt: pact.created_at,
    startDate: pact.start_date,
    endDate: pact.end_date,
    cancelledAt: pact.cancelled_at,
  };
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
    const { sessionToken } = await request.json();
    const session = await verifyGymPactSession(sessionToken);

    if (!session) {
      return new Response(JSON.stringify({ error: "Invalid session." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = getAdminClient();
    const { data: pact, error } = await admin
      .from("pacts")
      .select("id, goal_type, target_amount, timeframe, wager_type, wager_description, status, created_at, start_date, end_date, cancelled_at, pact_participants(user_id)")
      .in("status", ["pending", "active"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return new Response(JSON.stringify({ pact: pact ? mapPact(pact) : null }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Unable to load current pact." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
