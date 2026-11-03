import { getAdminClient } from "./gympact-session.ts";
import type { DataEnvironment } from "./data-environment.ts";

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

export async function getActivePactForAthlete(admin: AdminClient, userId: string, environment: DataEnvironment = "production") {
  const { data, error } = await admin
    .from("pacts")
    .select("id, timeframe, start_date, end_date, active_at, pact_participants!inner(user_id)")
    .eq("status", "active")
    .eq("data_environment", environment)
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

// A Steps requirement is also the source of truth for its companion tracker.
// This is intentionally idempotent so active Pacts created before automatic
// tracker creation are repaired the next time their progress is loaded.
export async function ensureStepTrackerForPact(
  admin: AdminClient,
  pactId: string,
  userId: string,
): Promise<StepTracker | null> {
  const { data: requirement, error: requirementError } = await admin
    .from("pact_requirements")
    .select("target_amount")
    .eq("pact_id", pactId)
    .eq("requirement_type", "steps")
    .maybeSingle();
  if (requirementError) throw requirementError;

  if (!requirement) return null;

  const { error: goalError } = await admin
    .from("weekly_step_goals")
    .upsert(
      { pact_id: pactId, user_id: userId, target_steps: Number(requirement.target_amount) },
      { onConflict: "pact_id,user_id", ignoreDuplicates: true },
    );
  if (goalError) throw goalError;

  return getStepTracker(admin, pactId, userId);
}
