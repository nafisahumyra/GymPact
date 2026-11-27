import { getAdminClient } from "./gympact-session.ts";
import { classifyWorkoutForPact } from "./pact-workout-classification.ts";

type AdminClient = ReturnType<typeof getAdminClient>;

export type PactRequirement = {
  type: string;
  targetAmount: number;
  position: number;
};

type Participant = { userId: string; displayName: string };
type PactWindow = { start_date: string; end_date: string; active_at: string | null; data_environment?: string };

const PACT_TIME_ZONE = "America/New_York";

export function getPactLocalDate(instant: string | Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PACT_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(instant));
}

export function addUtcDays(date: string, days: number) {
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

function stepTotal(measurements: unknown) {
  if (!Array.isArray(measurements)) return 0;
  return measurements.reduce((total, measurement) => {
    if (!measurement || typeof measurement !== "object") return total;
    const item = measurement as { unit?: unknown; amount?: unknown };
    return item.unit === "steps" && typeof item.amount === "number" && item.amount > 0
      ? total + item.amount : total;
  }, 0);
}

export async function getStepTotalSummary(
  admin: AdminClient,
  pact: PactWindow & { id: string; active_at: string | null },
  userId: string,
) {
  const { start, endExclusive } = getPactWindow(pact);
  const environment = pact.data_environment ?? "production";
  const legacyByDate = new Map<string, number>();
  const addLegacy = (date: string, steps: number) => {
    legacyByDate.set(date, (legacyByDate.get(date) ?? 0) + steps);
  };
  const [{ data: workouts, error: workoutsError }, { data: logs, error: logsError }, { data: daily, error: dailyError }] = await Promise.all([
    admin.from("workouts").select("logged_at, measurements").eq("user_id", userId).eq("data_environment", environment).gte("logged_at", start).lt("logged_at", endExclusive.toISOString()),
    admin.from("weekly_step_logs").select("logged_at, steps").eq("pact_id", pact.id).eq("user_id", userId).gte("logged_at", start).lt("logged_at", endExclusive.toISOString()),
    admin.from("daily_step_totals").select("local_date, steps").eq("pact_id", pact.id).eq("user_id", userId).eq("data_environment", environment).gte("local_date", pact.start_date).lte("local_date", pact.end_date),
  ]);
  if (workoutsError) throw workoutsError;
  if (logsError) throw logsError;
  if (dailyError) throw dailyError;
  (workouts ?? []).forEach(workout => {
    const steps = stepTotal(workout.measurements);
    if (steps) addLegacy(getPactLocalDate(workout.logged_at), steps);
  });
  (logs ?? []).forEach(log => addLegacy(getPactLocalDate(log.logged_at), Number(log.steps) || 0));

  // A pact created or accepted partway through a local day begins on the next
  // full local day. This is the same seven-day boundary used by the Week tab.
  const explicitByDate = new Map<string, number>();
  (daily ?? []).forEach(record => {
    if (getLocalMidnightUtc(record.local_date) >= new Date(start)) {
      explicitByDate.set(record.local_date, Number(record.steps) || 0);
    }
  });
  const dates = new Set([...legacyByDate.keys(), ...explicitByDate.keys()]);
  let total = 0;
  let legacyTotal = 0;
  explicitByDate.forEach(value => { total += value; });
  legacyByDate.forEach((value, date) => {
    if (!explicitByDate.has(date)) { total += value; legacyTotal += value; }
  });
  return { total, legacyTotal, explicitByDate, legacyByDate, dates };
}

function repetitionTotal(measurements: unknown) {
  if (!Array.isArray(measurements)) return 0;
  return measurements.reduce((total, measurement) => {
    if (!measurement || typeof measurement !== "object") return total;
    const item = measurement as { unit?: unknown; amount?: unknown };
    return item.unit === "reps" && typeof item.amount === "number" && item.amount > 0
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
    .eq("data_environment", pact.data_environment ?? "production")
    .gte("logged_at", start)
    .lt("logged_at", endExclusive.toISOString());
  if (error) throw error;

  const totals = new Map<string, { workouts: number; hiit: number; steps: number; pushups: number; pullups: number }>();
  participants.forEach(participant => totals.set(participant.userId, { workouts: 0, hiit: 0, steps: 0, pushups: 0, pullups: 0 }));
  (workouts ?? []).forEach(workout => {
    const total = totals.get(workout.user_id) ?? { workouts: 0, hiit: 0, steps: 0, pushups: 0, pullups: 0 };
    const classified = classifyWorkoutForPact(workout.muscles, requirements);
    total.workouts += classified.workouts;
    total.hiit += classified.hiit;
    const reps = repetitionTotal(workout.measurements);
    total.pushups += classified.pushups ? reps : 0;
    total.pullups += classified.pullups ? reps : 0;
    totals.set(workout.user_id, total);
  });

  const repTypes = requirements.filter(requirement => requirement.type === "pushups" || requirement.type === "pullups");
  if (repTypes.length) {
    const exerciseNames = repTypes.map(requirement => requirement.type === "pushups" ? "Pushups" : "Pullups");
    const { data: exerciseLogs, error: exerciseLogsError } = await admin
      .from("exercise_set_logs")
      .select("user_id, exercise_name, reps, logged_at")
      .in("user_id", participants.map(participant => participant.userId))
      .in("exercise_name", exerciseNames)
      .eq("data_environment", pact.data_environment ?? "production")
      .gte("logged_at", start)
      .lt("logged_at", endExclusive.toISOString());
    if (exerciseLogsError) throw exerciseLogsError;
    (exerciseLogs ?? []).forEach(log => {
      const total = totals.get(log.user_id) ?? { workouts: 0, hiit: 0, steps: 0, pushups: 0, pullups: 0 };
      if (log.exercise_name === "Pushups") total.pushups += Number(log.reps) || 0;
      if (log.exercise_name === "Pullups") total.pullups += Number(log.reps) || 0;
      totals.set(log.user_id, total);
    });
  }

  const stepSummaries = await Promise.all(participants.map(async participant => ({
    userId: participant.userId,
    summary: await getStepTotalSummary(admin, pact, participant.userId),
  })));
  stepSummaries.forEach(({ userId, summary }) => {
    const total = totals.get(userId) ?? { workouts: 0, hiit: 0, steps: 0, pushups: 0, pullups: 0 };
    total.steps = summary.total;
    totals.set(userId, total);
  });

  return participants.map(participant => {
    const totalsForAthlete = totals.get(participant.userId) ?? { workouts: 0, hiit: 0, steps: 0, pushups: 0, pullups: 0 };
    const progress = requirements.map(requirement => {
      const raw = totalsForAthlete[requirement.type as "workouts" | "hiit" | "steps" | "pushups" | "pullups"] ?? 0;
      return {
        ...requirement,
        completed: Math.min(raw, requirement.targetAmount),
        rawCompleted: raw,
      };
    });
    // Internal composition data: get-current-pact can derive today's pace
    // without a second pass through the same three step-total queries.
    const stepSummary = stepSummaries.find(item => item.userId === participant.userId)?.summary ?? null;
    return { ...participant, requirements: progress, isComplete: progress.every(item => item.completed >= item.targetAmount), stepSummary };
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
