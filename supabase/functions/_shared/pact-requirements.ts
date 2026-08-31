import { getAdminClient } from "./gympact-session.ts";

type AdminClient = ReturnType<typeof getAdminClient>;

export type PactRequirement = {
  type: string;
  targetAmount: number;
  position: number;
};

type Participant = { userId: string; displayName: string };
type PactWindow = { start_date: string; end_date: string; active_at: string | null };

const PACT_TIME_ZONE = "America/New_York";

function addUtcDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function getTimeZoneOffsetMs(instant: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PACT_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(instant);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day),
    Number(values.hour), Number(values.minute), Number(values.second)) - instant.getTime();
}

export function getLocalMidnightUtc(date: string) {
  const utcMidnight = new Date(`${date}T00:00:00.000Z`);
  let result = new Date(utcMidnight.getTime() - getTimeZoneOffsetMs(utcMidnight));
  result = new Date(utcMidnight.getTime() - getTimeZoneOffsetMs(result));
  return result;
}

export function getPactWindow(pact: PactWindow) {
  const start = getLocalMidnightUtc(pact.start_date);
  const endExclusive = getLocalMidnightUtc(addUtcDays(pact.end_date, 1));
  const activeAt = pact.active_at ? new Date(pact.active_at) : null;
  return {
    start: activeAt && activeAt > start ? activeAt.toISOString() : start.toISOString(),
    endExclusive,
  };
}

function parseMuscles(muscles: unknown) {
  if (Array.isArray(muscles)) return muscles.filter(value => typeof value === "string");
  if (typeof muscles !== "string") return [];
  try {
    const parsed = JSON.parse(muscles);
    return Array.isArray(parsed) ? parsed.filter(value => typeof value === "string") : [muscles];
  } catch {
    return muscles.split(",");
  }
}

function stepTotal(measurements: unknown) {
  if (!Array.isArray(measurements)) return 0;
  return measurements.reduce((total, measurement) => {
    if (!measurement || typeof measurement !== "object") return total;
    const item = measurement as { unit?: unknown; amount?: unknown };
    return item.unit === "steps" && typeof item.amount === "number" && item.amount > 0
      ? total + item.amount : total;
  }, 0);
}

export async function getPactRequirements(admin: AdminClient, pactId: string): Promise<PactRequirement[]> {
  const { data, error } = await admin
    .from("pact_requirements")
    .select("requirement_type, target_amount, position")
    .eq("pact_id", pactId)
    .order("position");
  if (error) throw error;
  return (data ?? []).map(item => ({
    type: item.requirement_type,
    targetAmount: Number(item.target_amount),
    position: Number(item.position),
  }));
}

export async function getPactRequirementProgress(
  admin: AdminClient,
  pact: PactWindow & { id: string; active_at: string | null },
  participants: Participant[],
  requirements: PactRequirement[],
) {
  const empty = participants.map(participant => ({
    ...participant,
    requirements: requirements.map(requirement => ({ ...requirement, completed: 0 })),
    isComplete: false,
  }));
  if (!pact.active_at || participants.length === 0) return empty;

  const { start, endExclusive } = getPactWindow(pact);
  const { data: workouts, error } = await admin
    .from("workouts")
    .select("user_id, muscles, measurements")
    .in("user_id", participants.map(participant => participant.userId))
    .gte("logged_at", start)
    .lt("logged_at", endExclusive.toISOString());
  if (error) throw error;

  const totals = new Map<string, { workouts: number; hiit: number; steps: number }>();
  participants.forEach(participant => totals.set(participant.userId, { workouts: 0, hiit: 0, steps: 0 }));
  (workouts ?? []).forEach(workout => {
    const total = totals.get(workout.user_id) ?? { workouts: 0, hiit: 0, steps: 0 };
    total.workouts += 1;
    if (parseMuscles(workout.muscles).some(muscle => muscle.trim().toLowerCase() === "hiit")) total.hiit += 1;
    total.steps += stepTotal(workout.measurements);
    totals.set(workout.user_id, total);
  });

  const { data: stepLogs, error: stepLogsError } = await admin
    .from("weekly_step_logs")
    .select("user_id, steps")
    .eq("pact_id", pact.id)
    .in("user_id", participants.map(participant => participant.userId));
  if (stepLogsError) throw stepLogsError;
  (stepLogs ?? []).forEach(log => {
    const total = totals.get(log.user_id) ?? { workouts: 0, hiit: 0, steps: 0 };
    total.steps += Number(log.steps);
    totals.set(log.user_id, total);
  });

  return participants.map(participant => {
    const totalsForAthlete = totals.get(participant.userId) ?? { workouts: 0, hiit: 0, steps: 0 };
    const progress = requirements.map(requirement => {
      const raw = totalsForAthlete[requirement.type as "workouts" | "hiit" | "steps"] ?? 0;
      return { ...requirement, completed: Math.min(raw, requirement.targetAmount) };
    });
    return { ...participant, requirements: progress, isComplete: progress.every(item => item.completed >= item.targetAmount) };
  });
}

export async function getAthletePactCompletion(
  admin: AdminClient,
  pact: PactWindow & { id: string; active_at: string | null },
  userId: string,
) {
  const requirements = await getPactRequirements(admin, pact.id);
  if (requirements.length === 0) return false;
  const [progress] = await getPactRequirementProgress(
    admin,
    pact,
    [{ userId, displayName: "GymPact athlete" }],
    requirements,
  );
  return progress?.isComplete === true;
}
