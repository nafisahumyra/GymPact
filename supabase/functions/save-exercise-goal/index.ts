import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getAdminClient, verifyGymPactSession } from "../_shared/gympact-session.ts";
import {
  ensureAthlete,
  getCorsHeaders,
  isTrackedExercise,
} from "../_shared/exercise-tracking.ts";

serve(async request => {
  const corsHeaders = getCorsHeaders(request);

  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  try {
    const { sessionToken, userId, exerciseName, targetReps, reset = false } = await request.json();
    const session = await verifyGymPactSession(sessionToken);
    const target = Number(targetReps);

    if (!session) {
      return Response.json({ error: "Invalid session." }, { status: 401, headers: corsHeaders });
    }

    if (!await ensureAthlete(userId) || !isTrackedExercise(exerciseName) ||
      !Number.isInteger(target) || target <= 0) {
      return Response.json({ error: "Invalid exercise goal." }, { status: 400, headers: corsHeaders });
    }

    const admin = getAdminClient();
    const { data: existing, error: existingError } = await admin
      .from("exercise_goals")
      .select("id")
      .eq("user_id", userId)
      .eq("exercise_name", exerciseName)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existing && reset) {
      const { error: deleteError } = await admin
        .from("exercise_set_logs")
        .delete()
        .eq("goal_id", existing.id);

      if (deleteError) throw deleteError;
    }

    let totalReps = 0;
    let totalSets = 0;

    if (existing && !reset) {
      const { data: logs, error: logsError } = await admin
        .from("exercise_set_logs")
        .select("reps")
        .eq("goal_id", existing.id);

      if (logsError) throw logsError;

      totalSets = (logs ?? []).length;
      totalReps = (logs ?? []).reduce((sum, log) => sum + log.reps, 0);
    }

    const completed = !reset && totalReps >= target;
    let savedGoal;

    if (existing) {
      const { error } = await admin
        .from("exercise_goals")
        .update({
          target_reps: target,
          status: completed ? "completed" : "active",
          completed_at: completed ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (error) throw error;

      savedGoal = {
        id: existing.id,
        user_id: userId,
        exercise_name: exerciseName,
        target_reps: target,
        status: completed ? "completed" : "active",
        completed_at: completed ? new Date().toISOString() : null,
      };
    } else {
      const { data: insertedGoal, error } = await admin
        .from("exercise_goals")
        .insert({ user_id: userId, exercise_name: exerciseName, target_reps: target })
        .select("id, user_id, exercise_name, target_reps, status, completed_at")
        .single();

      if (error) throw error;

      savedGoal = insertedGoal;
    }

    return Response.json({
      tracker: {
        id: savedGoal.id,
        userId: savedGoal.user_id,
        exerciseName: savedGoal.exercise_name,
        targetReps: savedGoal.target_reps,
        status: savedGoal.status,
        completedAt: savedGoal.completed_at,
        totalReps,
        totalSets,
      },
    }, { headers: corsHeaders });
  } catch {
    return Response.json({ error: "Unable to save exercise goal." }, { status: 500, headers: corsHeaders });
  }
});
