import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getAdminClient, verifyGymPactSession } from "../_shared/gympact-session.ts";
import { getDataEnvironment } from "../_shared/data-environment.ts";
import { getCorsHeaders } from "../_shared/exercise-tracking.ts";
import { addUtcDays, getLocalMidnightUtc, getPactRequirements, getPactWindow, getStepTotalSummary } from "../_shared/pact-requirements.ts";
import { getActivePactForAthlete } from "../_shared/step-tracking.ts";

function localDay() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function eligibleDates(pact: { start_date: string; end_date: string; active_at: string | null }) {
  const { start, endExclusive } = getPactWindow(pact);
  const dates: string[] = [];
  for (let date = pact.start_date; date <= pact.end_date; date = addUtcDays(date, 1)) {
    if (getLocalMidnightUtc(date) >= new Date(start) && getLocalMidnightUtc(addUtcDays(date, 1)) <= endExclusive) dates.push(date);
  }
  return dates;
}

serve(async request => {
  const headers = getCorsHeaders(request);
  if (request.method === "OPTIONS") return new Response(null, { headers });
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers });

  try {
    const { sessionToken, dataEnvironment } = await request.json();
    const environment = getDataEnvironment(dataEnvironment);
    const session = await verifyGymPactSession(sessionToken);
    const athleteId = session?.athlete_id;
    if (!environment || !athleteId) return Response.json({ error: "Invalid session." }, { status: 401, headers });

    const admin = getAdminClient();
    const pact = await getActivePactForAthlete(admin, athleteId, environment);
    if (!pact) return Response.json({ pacing: null }, { headers });
    const requirement = (await getPactRequirements(admin, pact.id)).find(item => item.type === "steps");
    if (!requirement) return Response.json({ pacing: null }, { headers });
    const dates = eligibleDates(pact);
    const today = localDay();
    const index = dates.indexOf(today);
    if (index < 0) return Response.json({ pacing: null }, { headers });
    const summary = await getStepTotalSummary(admin, pact, athleteId);
    const prior = dates.slice(0, index).reduce((total, date) => total + (summary.explicitByDate.get(date) ?? summary.legacyByDate.get(date) ?? 0), 0);
    const total = summary.explicitByDate.get(today) ?? summary.legacyByDate.get(today) ?? null;
    const suggestedSteps = Math.max(0, Math.ceil((requirement.targetAmount - prior) / (dates.length - index)));
    return Response.json({ pacing: { pactId: pact.id, localDate: today, total, suggestedSteps, target: requirement.targetAmount, weeklyTotal: summary.total } }, { headers });
  } catch (error) {
    console.error("get-today-step-pace", error instanceof Error ? error.message : error);
    return Response.json({ error: "Unable to load today's Steps." }, { status: 500, headers });
  }
});
