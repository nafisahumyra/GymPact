import { getAdminClient } from "./gympact-session.ts";
import {
  getPactRequirementProgress,
  getPactRequirements,
  getPactWindow,
} from "./pact-requirements.ts";

type AdminClient = ReturnType<typeof getAdminClient>;
type Participant = { userId: string; displayName: string };
type ActivePact = {
  id: string;
  status: string;
  target_amount: number;
  start_date: string;
  end_date: string;
  active_at: string | null;
  pact_participants?: Array<{ user_id?: string; users?: { display_name?: string } | null }>;
};

const activePactSelect = "id, status, target_amount, start_date, end_date, active_at, pact_participants(user_id, users(display_name))";

function getParticipants(pact: ActivePact): Participant[] {
  return (pact.pact_participants ?? []).map(participant => ({
    userId: participant.user_id ?? "",
    displayName: participant.users?.display_name ?? "GymPact athlete",
  })).filter((participant): participant is Participant => Boolean(participant.userId));
}

export async function finalizeActivePactIfNeeded(admin: AdminClient, pact: ActivePact, now = new Date()) {
  if (pact.status !== "active") return null;

  const participants = getParticipants(pact);
  if (participants.length !== 2 || !pact.active_at) return null;

  const requirements = await getPactRequirements(admin, pact.id);
  const progress = await getPactRequirementProgress(admin, pact, participants, requirements);
  const successfulParticipants = progress.filter(participant => participant.isComplete);
  const { endExclusive } = getPactWindow(pact);
  const deadlineReached = now >= endExclusive;

  if (successfulParticipants.length !== participants.length && !deadlineReached) return null;

  const finalResult = successfulParticipants.length === participants.length
    ? "both_completed"
    : successfulParticipants.length === 1 ? "winner" : "both_failed";
  const winnerId = finalResult === "winner" ? successfulParticipants[0].userId : null;
  const finalRequirementProgress = Object.fromEntries(progress.map(participant => [
    participant.userId,
    Object.fromEntries(participant.requirements.map(requirement => [
      requirement.type,
      { completed: requirement.completed, target: requirement.targetAmount },
    ])),
  ]));
  const finalWorkoutCounts = Object.fromEntries(progress.map(participant => [
    participant.userId,
    participant.requirements.find(requirement => requirement.type === "workouts")?.completed ?? 0,
  ]));

  const { data, error } = await admin.from("pacts").update({
    status: "completed",
    final_result: finalResult,
    final_workout_counts: finalWorkoutCounts,
    final_requirement_progress: finalRequirementProgress,
    winner_id: winnerId,
    completed_at: now.toISOString(),
  }).eq("id", pact.id).eq("status", "active")
    .select("id, status, final_result, winner_id, completed_at").maybeSingle();

  if (error) throw error;
  return data;
}

export async function finalizeDueActivePacts(admin: AdminClient) {
  const { data: pacts, error } = await admin.from("pacts").select(activePactSelect).eq("status", "active");
  if (error) throw error;
  return Promise.all((pacts ?? []).map(pact => finalizeActivePactIfNeeded(admin, pact)));
}
