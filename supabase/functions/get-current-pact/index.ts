import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getAdminClient, verifyGymPactSession } from "../_shared/gympact-session.ts";
import { finalizeDueActivePacts } from "../_shared/pact-finalization.ts";

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

async function getPactProgress(
  admin: ReturnType<typeof getAdminClient>,
  pact: Record<string, unknown>,
  participantDetails: Array<{ userId: string; displayName?: string }>,
) {
  const target = Number(pact.target_amount);
  const progress = participantDetails.map(participant => ({
    userId: participant.userId,
    displayName: participant.displayName ?? "GymPact athlete",
    completed: 0,
    target,
  }));

  if (pact.status !== "active") {
    return null;
  }

  // Existing active pacts created before active_at was introduced cannot be
  // backdated safely. Returning zero avoids counting any pre-acceptance work.
  if (
    typeof pact.active_at !== "string" ||
    typeof pact.start_date !== "string" ||
    typeof pact.end_date !== "string"
  ) {
    return progress;
  }

  const startOfPact = `${pact.start_date}T00:00:00.000Z`;
  const endExclusive = new Date(`${pact.end_date}T00:00:00.000Z`);

  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);

  const { data: workouts, error } = await admin
    .from("workouts")
    .select("user_id")
    .in("user_id", participantDetails.map(participant => participant.userId))
    .gte("logged_at", startOfPact)
    .gte("logged_at", pact.active_at)
    .lt("logged_at", endExclusive.toISOString());

  if (error) {
    throw error;
  }

  const counts = new Map<string, number>();

  for (const workout of workouts ?? []) {
    counts.set(workout.user_id, (counts.get(workout.user_id) ?? 0) + 1);
  }

  return progress.map(participant => ({
    ...participant,
    completed: Math.min(counts.get(participant.userId) ?? 0, target),
  }));
}

async function mapPact(
  admin: ReturnType<typeof getAdminClient>,
  pact: Record<string, unknown>,
) {
  const participantDetails = Array.isArray(pact.pact_participants)
    ? pact.pact_participants
      .map(participant => {
        const { user_id: userId, users } = participant as {
          user_id?: string;
          users?: { display_name?: string } | null;
        };

        return {
          userId,
          displayName: users?.display_name,
        };
      })
      .filter((participant): participant is { userId: string; displayName?: string } =>
        typeof participant.userId === "string"
      )
    : [];

  const participants = participantDetails.map(participant => participant.userId);
  const progress = await getPactProgress(admin, pact, participantDetails);

  return {
    id: pact.id,
    createdBy: pact.created_by,
    participants,
    participantDetails,
    goalType: pact.goal_type,
    targetAmount: pact.target_amount,
    timeframe: pact.timeframe,
    wagerType: pact.wager_type,
    wagerDescription: pact.wager_description,
    status: pact.status,
    createdAt: pact.created_at,
    activeAt: pact.active_at,
    startDate: pact.start_date,
    endDate: pact.end_date,
    cancelledAt: pact.cancelled_at,
    progress,
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
    await finalizeDueActivePacts(admin);
    const { data: pact, error } = await admin
      .from("pacts")
      .select("id, created_by, goal_type, target_amount, timeframe, wager_type, wager_description, status, created_at, active_at, start_date, end_date, cancelled_at, pact_participants(user_id, users(display_name))")
      .in("status", ["pending", "active"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return new Response(JSON.stringify({ pact: pact ? await mapPact(admin, pact) : null }), {
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
