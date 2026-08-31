import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getAdminClient, verifyGymPactSession } from "../_shared/gympact-session.ts";
import { ensureAthlete, getCorsHeaders } from "../_shared/exercise-tracking.ts";
import { getActivePactForAthlete, getStepTracker } from "../_shared/step-tracking.ts";
import { finalizeDueActivePacts } from "../_shared/pact-finalization.ts";
import { getAthletePactCompletion } from "../_shared/pact-requirements.ts";

serve(async request => {
  const corsHeaders = getCorsHeaders(request);
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  try {
    const { sessionToken, userId, steps } = await request.json();
    const increment = Number(steps);
    if (!await verifyGymPactSession(sessionToken) || !await ensureAthlete(userId) || !Number.isInteger(increment) || increment <= 0) {
      return Response.json({ error: "Enter a whole number of steps greater than zero." }, { status: 400, headers: corsHeaders });
    }
    const admin = getAdminClient();
    await finalizeDueActivePacts(admin);
    const pact = await getActivePactForAthlete(admin, userId);
    const tracker = pact ? await getStepTracker(admin, pact.id, userId) : null;
    if (!tracker || tracker.status !== "active") return Response.json({ error: "Your Steps tracker is not active." }, { status: 409, headers: corsHeaders });
    const { error } = await admin.from("weekly_step_logs").insert({ goal_id: tracker.id, pact_id: pact.id, user_id: userId, steps: increment });
    if (error) throw error;
    const updated = await getStepTracker(admin, pact.id, userId);
    const justCompleted = Boolean(updated && updated.totalSteps >= updated.targetSteps);
    if (justCompleted) {
      const { error: completeError } = await admin.from("weekly_step_goals").update({ status: "completed", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", tracker.id).eq("status", "active");
      if (completeError) throw completeError;
    }
    const pactParticipantComplete = await getAthletePactCompletion(admin, pact, userId);
    await finalizeDueActivePacts(admin);
    return Response.json({
      tracker: await getStepTracker(admin, pact.id, userId),
      justCompleted,
      pactId: pact.id,
      pactParticipantComplete,
    }, { headers: corsHeaders });
  } catch {
    return Response.json({ error: "Unable to log steps." }, { status: 500, headers: corsHeaders });
  }
});
