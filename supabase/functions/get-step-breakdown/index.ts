import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getAdminClient, verifyGymPactSession } from "../_shared/gympact-session.ts";
import { getCorsHeaders } from "../_shared/exercise-tracking.ts";
import { getDataEnvironment } from "../_shared/data-environment.ts";
import { addUtcDays, getLocalMidnightUtc, getPactLocalDate, getPactRequirements, getPactWindow, getStepTotalSummary } from "../_shared/pact-requirements.ts";

const TIME_ZONE = "America/New_York";
function eligibleDates(pact: { start_date: string; end_date: string; active_at: string | null }) {
  const { start, endExclusive } = getPactWindow(pact);
  const days: string[] = [];
  for (let date = pact.start_date; date <= pact.end_date; date = addUtcDays(date, 1)) {
    if (getLocalMidnightUtc(date) >= new Date(start) && getLocalMidnightUtc(addUtcDays(date, 1)) <= endExclusive) days.push(date);
  }
  return days;
}
serve(async request => {
  const headers = getCorsHeaders(request);
  if (request.method === "OPTIONS") return new Response(null, { headers });
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers });
  try {
    const body = await request.json(); const environment = getDataEnvironment(body.dataEnvironment);
    const session = await verifyGymPactSession(body.sessionToken);
    if (!environment || !session?.athlete_id) return Response.json({ error: "Invalid session." }, { status: 401, headers });
    const admin = getAdminClient();
    const { data: pact, error } = await admin.from("pacts").select("id, start_date, end_date, active_at, data_environment, status, pact_participants(user_id, users(display_name))").eq("id", body.pactId).eq("data_environment", environment).maybeSingle();
    if (error) throw error;
    const participants = (pact?.pact_participants ?? []) as Array<{ user_id: string; users: { display_name: string } | null }>;
    if (!pact || !participants.some(item => item.user_id === session.athlete_id)) return Response.json({ error: "Not a pact participant." }, { status: 403, headers });
    const stepsRequirement = (await getPactRequirements(admin, pact.id)).find(item => item.type === "steps");
    if (!stepsRequirement) return Response.json({ error: "This pact has no Steps requirement." }, { status: 404, headers });
    const days = eligibleDates(pact); const today = getPactLocalDate(new Date());
    const people = await Promise.all(participants.map(async person => {
      const summary = await getStepTotalSummary(admin, pact, person.user_id);
      const { data: references, error: refsError } = await admin.from("daily_step_pace_references").select("local_date, suggested_steps").eq("pact_id", pact.id).eq("user_id", person.user_id).eq("data_environment", environment);
      if (refsError) throw refsError;
      const refs = new Map((references ?? []).map(ref => [ref.local_date, Number(ref.suggested_steps)]));
      let prior = 0; const output = [];
      for (let index = 0; index < days.length; index += 1) {
        const date = days[index]; const value = summary.explicitByDate.has(date) ? summary.explicitByDate.get(date)! : summary.legacyByDate.get(date);
        const calculated = Math.max(0, Math.ceil((stepsRequirement.targetAmount - prior) / (days.length - index)));
        const suggestion = refs.get(date) ?? calculated;
        if (date < today && !refs.has(date)) await admin.from("daily_step_pace_references").upsert({ pact_id: pact.id, user_id: person.user_id, local_date: date, suggested_steps: suggestion, data_environment: environment }, { onConflict: "pact_id,user_id,local_date,data_environment", ignoreDuplicates: true });
        output.push({ localDate: date, total: value ?? null, source: summary.explicitByDate.has(date) ? "explicit" : value === undefined ? "none" : "legacy", suggestedSteps: suggestion, isToday: date === today, isFuture: date > today });
        prior += value ?? 0;
      }
      return { userId: person.user_id, displayName: person.users?.display_name || "Athlete", total: summary.total, target: stepsRequirement.targetAmount, days: output };
    }));
    return Response.json({ pactId: pact.id, status: pact.status, timezone: TIME_ZONE, days, people }, { headers });
  } catch (error) { console.error("get-step-breakdown", error); return Response.json({ error: "Unable to load daily Steps." }, { status: 500, headers }); }
});
