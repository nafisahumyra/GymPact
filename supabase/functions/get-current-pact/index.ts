import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getAdminClient, verifyGymPactSession } from "../_shared/gympact-session.ts";
import { finalizeDueActivePacts } from "../_shared/pact-finalization.ts";
import {
  getPactRequirementProgress,
  getPactRequirements,
} from "../_shared/pact-requirements.ts";

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
  const requirements = await getPactRequirements(admin, String(pact.id));
  const requirementProgress = await getPactRequirementProgress(
    admin,
    pact as { id: string; start_date: string; end_date: string; active_at: string | null },
    participantDetails.map(participant => ({
      userId: participant.userId,
      displayName: participant.displayName ?? "GymPact athlete",
    })),
    requirements,
  );
  const progress = requirementProgress.map(participant => {
    const workouts = participant.requirements.find(requirement => requirement.type === "workouts");
    return {
      ...participant,
      completed: workouts?.completed ?? 0,
      target: workouts?.targetAmount ?? 0,
    };
  });

  return {
    id: pact.id,
    createdBy: pact.created_by,
    participants,
    participantDetails,
    goalType: pact.goal_type,
    targetAmount: pact.target_amount,
    requirements,
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
