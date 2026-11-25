import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getAdminClient, verifyGymPactSession } from "../_shared/gympact-session.ts";
import { ensureAthlete, getCorsHeaders } from "../_shared/exercise-tracking.ts";
import { ensureStepTrackerForPact, getActivePactForAthlete, getStepTracker } from "../_shared/step-tracking.ts";
import { finalizeDueActivePacts } from "../_shared/pact-finalization.ts";
import { getAthletePactCompletion } from "../_shared/pact-requirements.ts";
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
      return Response.json({ error: "You can only update your own steps." }, { status: 401, headers: corsHeaders });
    }
    const admin = getAdminClient();
    await finalizeDueActivePacts(admin);
    const pact = await getActivePactForAthlete(admin, userId, environment);
    const tracker = pact ? await ensureStepTrackerForPact(admin, pact.id, userId) : null;
    if (!tracker || tracker.status !== "active") return Response.json({ error: "Your Steps tracker is not active." }, { status: 409, headers: corsHeaders });
    return Response.json({ error: "Use daily-steps to save the total for a selected day." }, { status: 410, headers: corsHeaders });
  } catch {
    return Response.json({ error: "Unable to log steps." }, { status: 500, headers: corsHeaders });
  }
});
