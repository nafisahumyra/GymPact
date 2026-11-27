import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getAdminClient, verifyGymPactSession } from "../_shared/gympact-session.ts";
import {
  ensureAthlete,
  getCorsHeaders,
  getExerciseTrackers,
} from "../_shared/exercise-tracking.ts";
import { ensureStepTrackerForPact, getActivePactForAthlete } from "../_shared/step-tracking.ts";
import { getDataEnvironment } from "../_shared/data-environment.ts";

serve(async request => {
  const corsHeaders = getCorsHeaders(request);

  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  try {
    const { sessionToken, userId, dataEnvironment } = await request.json();
    const environment = getDataEnvironment(dataEnvironment);
    const session = await verifyGymPactSession(sessionToken);

    if (!environment || !session?.athlete_id || session.athlete_id !== userId || !await ensureAthlete(userId)) {
      return Response.json({ error: "Invalid session or athlete." }, { status: 401, headers: corsHeaders });
    }

    const activePact = await getActivePactForAthlete(getAdminClient(), userId, environment);
    const stepTracker = activePact
      ? await ensureStepTrackerForPact(getAdminClient(), activePact.id, userId)
      : null;

    return Response.json({ trackers: await getExerciseTrackers(userId, environment), stepTracker, stepPact: activePact && stepTracker ? { startDate: activePact.start_date, endDate: activePact.end_date, activeAt: activePact.active_at } : null }, { headers: corsHeaders });
  } catch (error) {
    // Keep the client message safe, while retaining the actual failure in the
    // function log so a non-critical refresh does not become unactionable.
    console.error("get-exercise-progress", error instanceof Error ? error.message : error);
    return Response.json({ error: "Unable to load exercise progress." }, { status: 500, headers: corsHeaders });
  }
});
