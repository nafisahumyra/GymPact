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

function jsonResponse(body: unknown, status: number, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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
    const body = await request.json();
    const session = await verifyGymPactSession(body.sessionToken);

    if (!session) {
      return jsonResponse({ error: "Invalid session." }, 401, corsHeaders);
    }

    const {
      createdBy,
      goalType,
      targetAmount,
      timeframe,
      wagerType,
      wagerDescription,
      startDate,
      endDate,
    } = body;

    if (
      typeof createdBy !== "string" ||
      goalType !== "workouts" ||
      !Number.isInteger(targetAmount) ||
      targetAmount < 1 ||
      !["day", "week", "month"].includes(timeframe) ||
      !["reward", "punishment"].includes(wagerType) ||
      typeof wagerDescription !== "string" ||
      wagerDescription.trim().length === 0 ||
      typeof startDate !== "string" ||
      typeof endDate !== "string"
    ) {
      return jsonResponse({ error: "Invalid pact." }, 400, corsHeaders);
    }

    const admin = getAdminClient();
    const { data: athletes, error: athletesError } = await admin
      .from("users")
      .select("id")
      .order("id");

    if (athletesError || athletes?.length !== 2 || !athletes.some(athlete => athlete.id === createdBy)) {
      return jsonResponse({ error: "Unknown athlete." }, 400, corsHeaders);
    }

    const participantIds = athletes.map(athlete => athlete.id);
    const { data: pact, error: pactError } = await admin.rpc("create_gympact_pact", {
      p_created_by: createdBy,
      p_goal_type: goalType,
      p_target_amount: targetAmount,
      p_timeframe: timeframe,
      p_wager_type: wagerType,
      p_wager_description: wagerDescription.trim(),
      p_start_date: startDate,
      p_end_date: endDate,
      p_participant_ids: participantIds,
    });

    if (pactError) {
      if (pactError.code === "23505") {
        return jsonResponse({ error: "An open challenge already exists.", code: "open-pact" }, 409, corsHeaders);
      }

      throw pactError;
    }

    return jsonResponse({
      pact: {
        id: pact.id,
        participants: participantIds,
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
      },
    }, 201, corsHeaders);
  } catch {
    return jsonResponse({ error: "Unable to create pact." }, 500, corsHeaders);
  }
});
