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
    const { data: pacts, error } = await admin
      .from("pacts")
      .select("id, goal_type, target_amount, timeframe, wager_type, wager_description, start_date, end_date, final_result, final_workout_counts, winner_id, completed_at, pact_participants(user_id, users(display_name))")
      .eq("status", "completed")
      .order("completed_at", { ascending: false });

    if (error) {
      throw error;
    }

    const history = (pacts ?? []).map(pact => {
      const participants = (pact.pact_participants ?? []).map(participant => ({
        userId: participant.user_id,
        displayName: participant.users?.display_name ?? "GymPact athlete",
        completed: Number(pact.final_workout_counts?.[participant.user_id] ?? 0),
        target: pact.target_amount,
      }));
      const winner = participants.find(participant => participant.userId === pact.winner_id);

      return {
        id: pact.id,
        goalType: pact.goal_type,
        targetAmount: pact.target_amount,
        timeframe: pact.timeframe,
        wagerType: pact.wager_type,
        wagerDescription: pact.wager_description,
        startDate: pact.start_date,
        endDate: pact.end_date,
        completedAt: pact.completed_at,
        result: pact.final_result,
        winnerName: winner?.displayName ?? null,
        participants,
      };
    });

    return new Response(JSON.stringify({ pacts: history }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Unable to load challenge history." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
