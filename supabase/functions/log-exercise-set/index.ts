import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getAdminClient, verifyGymPactSession } from "../_shared/gympact-session.ts";
import {
  ensureAthlete,
  getCorsHeaders,
  getExerciseTrackers,
  isTrackedExercise,
} from "../_shared/exercise-tracking.ts";
import { getDataEnvironment } from "../_shared/data-environment.ts";

serve(async request => {
  const corsHeaders = getCorsHeaders(request);

  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  try {
    const { sessionToken, userId, exerciseName, reps, dataEnvironment } = await request.json();
    const environment = getDataEnvironment(dataEnvironment);
    const session = await verifyGymPactSession(sessionToken);
    const setReps = Number(reps);

    if (!session) {
      return Response.json({ error: "Invalid session." }, { status: 401, headers: corsHeaders });
    }

    if (!environment || !await ensureAthlete(userId) || !isTrackedExercise(exerciseName) ||
      !Number.isInteger(setReps) || setReps <= 0) {
      return Response.json({ error: "Invalid exercise set." }, { status: 400, headers: corsHeaders });
    }

    const admin = getAdminClient();
    const { data: goal, error: goalError } = await admin
      .from("exercise_goals")
      .select("id, target_reps, status")
      .eq("user_id", userId)
      .eq("exercise_name", exerciseName)
      .eq("data_environment", environment)
      .maybeSingle();

    if (goalError) throw goalError;
    if (!goal || goal.status !== "active") {
      return Response.json({ error: "This exercise goal is not active." }, { status: 409, headers: corsHeaders });
    }

    const { error: logError } = await admin
      .from("exercise_set_logs")
      .insert({ goal_id: goal.id, user_id: userId, exercise_name: exerciseName, reps: setReps, data_environment: environment });

    if (logError) throw logError;

    const trackers = await getExerciseTrackers(userId, environment);
    const tracker = trackers.find(item => item.id === goal.id);
    const justCompleted = Boolean(tracker && tracker.totalReps >= tracker.targetReps);

    if (justCompleted) {
      const { error: completeError } = await admin
        .from("exercise_goals")
        .update({ status: "completed", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", goal.id)
        .eq("status", "active");

      if (completeError) throw completeError;
    }

    return Response.json({
      justCompleted,
      tracker: (await getExerciseTrackers(userId, environment)).find(item => item.id === goal.id),
    }, { headers: corsHeaders });
  } catch {
    return Response.json({ error: "Unable to log exercise set." }, { status: 500, headers: corsHeaders });
  }
});
