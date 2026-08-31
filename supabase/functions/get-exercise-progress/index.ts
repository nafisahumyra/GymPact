import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getAdminClient, verifyGymPactSession } from "../_shared/gympact-session.ts";
import {
  ensureAthlete,
  getCorsHeaders,
  getExerciseTrackers,
} from "../_shared/exercise-tracking.ts";
import { getActivePactForAthlete, getStepTracker } from "../_shared/step-tracking.ts";

serve(async request => {
  const corsHeaders = getCorsHeaders(request);

  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  try {
    const { sessionToken, userId } = await request.json();
    const session = await verifyGymPactSession(sessionToken);

    if (!session || !await ensureAthlete(userId)) {
      return Response.json({ error: "Invalid session or athlete." }, { status: 401, headers: corsHeaders });
    }

    const activePact = await getActivePactForAthlete(getAdminClient(), userId);
    const stepTracker = activePact ? await getStepTracker(getAdminClient(), activePact.id, userId) : null;

    return Response.json({ trackers: await getExerciseTrackers(userId), stepTracker }, { headers: corsHeaders });
  } catch {
    return Response.json({ error: "Unable to load exercise progress." }, { status: 500, headers: corsHeaders });
  }
});
