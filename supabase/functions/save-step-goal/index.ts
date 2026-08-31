import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getAdminClient, verifyGymPactSession } from "../_shared/gympact-session.ts";
import { ensureAthlete, getCorsHeaders } from "../_shared/exercise-tracking.ts";
import { getActivePactForAthlete, getStepTracker } from "../_shared/step-tracking.ts";
import { finalizeDueActivePacts } from "../_shared/pact-finalization.ts";

serve(async request => {
  const corsHeaders = getCorsHeaders(request);
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  try {
    const { sessionToken, userId, targetSteps, reset = false } = await request.json();
    const target = Number(targetSteps);
    if (!await verifyGymPactSession(sessionToken) || !await ensureAthlete(userId) || !Number.isInteger(target) || target <= 0) {
      return Response.json({ error: "Invalid step target." }, { status: 400, headers: corsHeaders });
    }
    const admin = getAdminClient();
    await finalizeDueActivePacts(admin);
    const pact = await getActivePactForAthlete(admin, userId);
    if (!pact) return Response.json({ error: "Steps tracking requires an active weekly Pact." }, { status: 409, headers: corsHeaders });
    const existing = await getStepTracker(admin, pact.id, userId);
    if (existing && reset) {
      const { error } = await admin.from("weekly_step_logs").delete().eq("goal_id", existing.id);
      if (error) throw error;
    }
    const keptTotal = existing && !reset ? existing.totalSteps : 0;
    const completed = !reset && keptTotal >= target;
    if (existing) {
      const { error } = await admin.from("weekly_step_goals").update({ target_steps: target, status: completed ? "completed" : "active", completed_at: completed ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await admin.from("weekly_step_goals").insert({ pact_id: pact.id, user_id: userId, target_steps: target });
      if (error) throw error;
    }
    return Response.json({ tracker: await getStepTracker(admin, pact.id, userId) }, { headers: corsHeaders });
  } catch {
    return Response.json({ error: "Unable to save step target." }, { status: 500, headers: corsHeaders });
  }
});
