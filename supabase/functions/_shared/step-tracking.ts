import { getAdminClient } from "./gympact-session.ts";

type AdminClient = ReturnType<typeof getAdminClient>;

export type StepTracker = {
  id: string;
  pactId: string;
  userId: string;
  exerciseName: "Steps";
  targetSteps: number;
  totalSteps: number;
  status: "active" | "completed";
  completedAt: string | null;
};

export async function getActivePactForAthlete(admin: AdminClient, userId: string) {
  const { data, error } = await admin
    .from("pacts")
    .select("id, timeframe, start_date, end_date, active_at, pact_participants!inner(user_id)")
    .eq("status", "active")
    .eq("pact_participants.user_id", userId)
    .order("active_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.timeframe === "week" ? data : null;
}

export async function getStepTracker(admin: AdminClient, pactId: string, userId: string): Promise<StepTracker | null> {
  const { data: goal, error } = await admin
    .from("weekly_step_goals")
    .select("id, pact_id, user_id, target_steps, status, completed_at")
    .eq("pact_id", pactId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!goal) return null;

  const { data: logs, error: logsError } = await admin
    .from("weekly_step_logs")
    .select("steps")
    .eq("goal_id", goal.id);
  if (logsError) throw logsError;
  const totalSteps = (logs ?? []).reduce((sum, log) => sum + Number(log.steps), 0);

  return {
    id: goal.id, pactId: goal.pact_id, userId: goal.user_id, exerciseName: "Steps",
    targetSteps: Number(goal.target_steps), totalSteps,
    status: goal.status as "active" | "completed", completedAt: goal.completed_at,
  };
}
