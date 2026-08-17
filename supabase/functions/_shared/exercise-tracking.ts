import { getAdminClient } from "./gympact-session.ts";

export const TRACKED_EXERCISES = ["Pushups", "Pullups"] as const;

export type TrackedExercise = typeof TRACKED_EXERCISES[number];

export type ExerciseTracker = {
  id: string;
  userId: string;
  exerciseName: TrackedExercise;
  targetReps: number;
  status: "active" | "completed";
  completedAt: string | null;
  totalReps: number;
  totalSets: number;
};

export const allowedOrigins = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://nafisahumyra.github.io",
]);

export function getCorsHeaders(request: Request) {
  const origin = request.headers.get("origin") ?? "";
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };

  if (allowedOrigins.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

export function isTrackedExercise(value: unknown): value is TrackedExercise {
  return typeof value === "string" && TRACKED_EXERCISES.includes(value as TrackedExercise);
}

export async function ensureAthlete(userId: unknown) {
  if (typeof userId !== "string") {
    return null;
  }

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("users")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  return error ? null : data;
}

export async function getExerciseTrackers(userId: string): Promise<ExerciseTracker[]> {
  const admin = getAdminClient();
  const { data: goals, error: goalsError } = await admin
    .from("exercise_goals")
    .select("id, user_id, exercise_name, target_reps, status, completed_at")
    .eq("user_id", userId)
    .order("exercise_name", { ascending: true });

  if (goalsError) {
    throw goalsError;
  }

  const goalIds = (goals ?? []).map(goal => goal.id);
  const totals = new Map<string, { reps: number; sets: number }>();

  if (goalIds.length > 0) {
    const { data: logs, error: logsError } = await admin
      .from("exercise_set_logs")
      .select("goal_id, reps")
      .in("goal_id", goalIds);

    if (logsError) {
      throw logsError;
    }

    (logs ?? []).forEach(log => {
      const total = totals.get(log.goal_id) ?? { reps: 0, sets: 0 };
      total.reps += log.reps;
      total.sets += 1;
      totals.set(log.goal_id, total);
    });
  }

  return (goals ?? []).map(goal => {
    const total = totals.get(goal.id) ?? { reps: 0, sets: 0 };

    return {
      id: goal.id,
      userId: goal.user_id,
      exerciseName: goal.exercise_name as TrackedExercise,
      targetReps: goal.target_reps,
      status: goal.status as "active" | "completed",
      completedAt: goal.completed_at,
      totalReps: total.reps,
      totalSets: total.sets,
    };
  });
}
