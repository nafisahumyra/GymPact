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
      requirements,
      timeframe,
      wagerType,
      wagerDescription,
      startDate,
      endDate,
    } = body;

    if (
      typeof createdBy !== "string" ||
      !Array.isArray(requirements) ||
      requirements.length === 0 ||
      requirements.some(requirement => (
        !requirement ||
        !["workouts", "hiit", "steps"].includes(requirement.type) ||
        !Number.isInteger(requirement.targetAmount) ||
        requirement.targetAmount < 1
      )) ||
      new Set(requirements.map(requirement => requirement.type)).size !== requirements.length ||
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
    const { data: pact, error: pactError } = await admin.rpc("create_gympact_pact_with_requirements", {
      p_created_by: createdBy,
      p_timeframe: timeframe,
      p_wager_type: wagerType,
      p_wager_description: wagerDescription.trim(),
      p_start_date: startDate,
      p_end_date: endDate,
      p_participant_ids: participantIds,
      p_requirements: requirements,
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
        requirements,
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
