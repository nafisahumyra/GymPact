import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getAdminClient, verifyGymPactSession } from "../_shared/gympact-session.ts";
import { getDataEnvironment } from "../_shared/data-environment.ts";
import { getCorsHeaders } from "../_shared/exercise-tracking.ts";

type StreakOutcome = { completedAt: string; successful: boolean };

function monthEnd(monthStart: string) {
  const date = new Date(`${monthStart}T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  date.setUTCDate(0);
  return date.toISOString().slice(0, 10);
}

function calculateStreak(outcomes: StreakOutcome[]) {
  let streak = 0;
  for (const outcome of outcomes.sort((left, right) => new Date(right.completedAt).getTime() - new Date(left.completedAt).getTime())) {
    if (!outcome.successful) break;
    streak += 1;
  }
  return streak;
}

serve(async request => {
  const headers = getCorsHeaders(request);
  if (request.method === "OPTIONS") return new Response(null, { headers });
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers });

  try {
    const { sessionToken, dataEnvironment } = await request.json();
    const environment = getDataEnvironment(dataEnvironment);
    const session = await verifyGymPactSession(sessionToken);
    const athleteId = session?.athlete_id;
    if (!environment || !athleteId) return Response.json({ error: "Invalid session." }, { status: 401, headers });

    const admin = getAdminClient();
    const [workoutResult, weeklyResult, monthlyPactResult] = await Promise.all([
      admin.from("workouts").select("id", { count: "exact", head: true }).eq("user_id", athleteId).eq("data_environment", environment),
      admin.from("pacts")
        .select("final_result, winner_id, completed_at, pact_participants!inner(user_id)")
        .eq("status", "completed")
        .eq("timeframe", "week")
        .eq("data_environment", environment)
        .eq("pact_participants.user_id", athleteId),
      admin.from("monthly_pacts")
        .select("id, month_start, finalized_at")
        .in("status", ["completed", "failed"])
        .eq("data_environment", environment),
    ]);
    if (workoutResult.error) throw workoutResult.error;
    if (weeklyResult.error) throw weeklyResult.error;
    if (monthlyPactResult.error) throw monthlyPactResult.error;

    const monthlyPacts = monthlyPactResult.data ?? [];
    const monthlyIds = monthlyPacts.map(pact => pact.id);
    const commitmentsResult = monthlyIds.length
      ? await admin.from("monthly_pact_commitments").select("monthly_pact_id, completed_at").eq("user_id", athleteId).in("monthly_pact_id", monthlyIds)
      : { data: [], error: null };
    if (commitmentsResult.error) throw commitmentsResult.error;
    const commitments = new Map((commitmentsResult.data ?? []).map(commitment => [commitment.monthly_pact_id, commitment]));

    const outcomes: StreakOutcome[] = [
      ...(weeklyResult.data ?? []).flatMap(pact => pact.completed_at ? [{
        completedAt: pact.completed_at,
        successful: pact.final_result === "both_completed" || (pact.final_result === "winner" && pact.winner_id === athleteId),
      }] : []),
      ...monthlyPacts.flatMap(pact => {
        const commitment = commitments.get(pact.id);
        const completedAt = pact.finalized_at ?? `${monthEnd(pact.month_start)}T23:59:59-05:00`;
        return [{ completedAt, successful: Boolean(commitment?.completed_at && commitment.completed_at <= `${monthEnd(pact.month_start)}T23:59:59.999-05:00`) }];
      }),
    ];

    return Response.json({ workoutCount: workoutResult.count ?? 0, pactStreak: calculateStreak(outcomes) }, { headers });
  } catch (error) {
    console.error("get-dashboard-summary", error instanceof Error ? error.message : error);
    return Response.json({ error: "Unable to load dashboard summary." }, { status: 500, headers });
  }
});
