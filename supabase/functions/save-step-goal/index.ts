import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getAdminClient, verifyGymPactSession } from "../_shared/gympact-session.ts";
import { ensureAthlete, getCorsHeaders } from "../_shared/exercise-tracking.ts";
import { getActivePactForAthlete, getStepTracker } from "../_shared/step-tracking.ts";
import { finalizeDueActivePacts } from "../_shared/pact-finalization.ts";
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
    const admin = getAdminClient();
    await finalizeDueActivePacts(admin);
    const pact = await getActivePactForAthlete(admin, userId, environment);
    if (!pact) return Response.json({ error: "Steps tracking requires an active weekly Pact." }, { status: 409, headers: corsHeaders });
    return Response.json({ error: "The Steps target comes from this pact and can’t be changed here." }, { status: 409, headers: corsHeaders });
  } catch {
    return Response.json({ error: "Unable to save step target." }, { status: 500, headers: corsHeaders });
  }
});
