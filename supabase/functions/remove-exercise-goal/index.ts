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
    const { sessionToken, userId, exerciseName } = await request.json();
    const session = await verifyGymPactSession(sessionToken);

    if (!session) {
      return Response.json({ error: "Invalid session." }, { status: 401, headers: corsHeaders });
    }

    if (!await ensureAthlete(userId) || !isTrackedExercise(exerciseName)) {
      return Response.json({ error: "Invalid exercise tracker." }, { status: 400, headers: corsHeaders });
    }

    const admin = getAdminClient();
    const { error } = await admin
      .from("exercise_goals")
      .delete()
      .eq("user_id", userId)
      .eq("exercise_name", exerciseName);

    if (error) throw error;

    return Response.json({ removed: true }, { headers: corsHeaders });
  } catch {
    return Response.json({ error: "Unable to remove exercise tracker." }, { status: 500, headers: corsHeaders });
  }
});
