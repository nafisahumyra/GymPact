import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getAdminClient, verifyGymPactSession } from "../_shared/gympact-session.ts";
import { getCorsHeaders } from "../_shared/exercise-tracking.ts";
import { getDataEnvironment } from "../_shared/data-environment.ts";
import { getActivePactForAthlete, ensureStepTrackerForPact, getStepTracker } from "../_shared/step-tracking.ts";
import { addUtcDays, getLocalMidnightUtc, getPactWindow, getStepTotalSummary } from "../_shared/pact-requirements.ts";
import { finalizeDueActivePacts } from "../_shared/pact-finalization.ts";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function dateIsEligible(pact: { start_date: string; end_date: string; active_at: string | null }, localDate: string) {
  if (!DATE.test(localDate) || localDate < pact.start_date || localDate > pact.end_date) return false;
  const { start, endExclusive } = getPactWindow(pact);
  return getLocalMidnightUtc(localDate) >= new Date(start) && getLocalMidnightUtc(addUtcDays(localDate, 1)) <= endExclusive;
}

serve(async request => {
  const corsHeaders = getCorsHeaders(request);
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  try {
    const body = await request.json();
    const environment = getDataEnvironment(body.dataEnvironment);
    const session = await verifyGymPactSession(body.sessionToken);
    const localDate = typeof body.localDate === "string" ? body.localDate : "";
    if (!environment || !session?.athlete_id || session.athlete_id !== body.userId) {
      return Response.json({ error: "You can only update your own steps." }, { status: 401, headers: corsHeaders });
    }
    const admin = getAdminClient();
    await finalizeDueActivePacts(admin);
    const pact = await getActivePactForAthlete(admin, body.userId, environment);
    const tracker = pact ? await ensureStepTrackerForPact(admin, pact.id, body.userId) : null;
    if (!pact || !tracker) return Response.json({ error: "Steps tracking requires an active weekly pact with a Steps requirement." }, { status: 409, headers: corsHeaders });
    if (!dateIsEligible(pact, localDate)) return Response.json({ error: "Choose a full local day within this pact." }, { status: 400, headers: corsHeaders });
    const summary = await getStepTotalSummary(admin, pact, body.userId);
    const existingTotal = summary.explicitByDate.get(localDate);
    const legacyTotal = summary.legacyByDate.get(localDate) ?? 0;
    if (body.action === "get") {
      return Response.json({
        localDate, total: existingTotal ?? legacyTotal, hasExplicitTotal: existingTotal !== undefined,
        legacyTotal, canReplaceLegacy: existingTotal === undefined && legacyTotal > 0,
      }, { headers: corsHeaders });
    }
    const steps = Number(body.steps);
    if (!Number.isInteger(steps) || steps < 0) return Response.json({ error: "Enter a whole-number daily total of zero or more." }, { status: 400, headers: corsHeaders });
    const { error } = await admin.from("daily_step_totals").upsert({
      pact_id: pact.id, user_id: body.userId, local_date: localDate, timezone: "America/New_York", steps,
      data_environment: environment, updated_at: new Date().toISOString(),
    }, { onConflict: "pact_id,user_id,local_date,data_environment" });
    if (error) throw error;
    const updated = await getStepTracker(admin, pact.id, body.userId);
    const justCompleted = Boolean(updated && updated.totalSteps >= updated.targetSteps && tracker.status === "active");
    if (justCompleted) await admin.from("weekly_step_goals").update({ status: "completed", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", tracker.id).eq("status", "active");
    return Response.json({ tracker: await getStepTracker(admin, pact.id, body.userId), pactId: pact.id, justCompleted }, { headers: corsHeaders });
  } catch (error) {
    console.error("daily-steps", error);
    return Response.json({ error: "Unable to save daily steps." }, { status: 500, headers: corsHeaders });
  }
});
