import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getAdminClient, verifyGymPactSession } from "../_shared/gympact-session.ts";
import {
  ensureAthlete,
  getCorsHeaders,
  getExerciseTrackers,
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

    if (existing) {
      const trackers = await getExerciseTrackers(userId);
      const current = trackers.find(tracker => tracker.id === existing.id);
      const completed = !reset && (current?.totalReps ?? 0) >= target;
      const { error } = await admin
        .from("exercise_goals")
        .update({
          target_reps: target,
          status: completed ? "completed" : "active",
          completed_at: completed ? (current?.completedAt ?? new Date().toISOString()) : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (error) throw error;
    } else {
      const { error } = await admin
        .from("exercise_goals")
        .insert({ user_id: userId, exercise_name: exerciseName, target_reps: target });

      if (error) throw error;
    }

    return Response.json({ trackers: await getExerciseTrackers(userId) }, { headers: corsHeaders });
  } catch {
    return Response.json({ error: "Unable to save exercise goal." }, { status: 500, headers: corsHeaders });
  }
});
