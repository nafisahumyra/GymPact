import { getAdminClient } from "./gympact-session.ts";

type AdminClient = ReturnType<typeof getAdminClient>;

type Participant = {
  userId: string;
  displayName: string;
};

type ActivePact = {
  id: string;
  status: string;
  target_amount: number;
  start_date: string;
  end_date: string;
  active_at: string | null;
  pact_participants?: Array<{
    user_id?: string;
    users?: { display_name?: string } | null;
  }>;
};

const activePactSelect = "id, status, target_amount, start_date, end_date, active_at, pact_participants(user_id, users(display_name))";

function getParticipants(pact: ActivePact): Participant[] {
  return (pact.pact_participants ?? [])
    .map(participant => ({
      userId: participant.user_id ?? "",
      displayName: participant.users?.display_name ?? "GymPact athlete",
    }))
    .filter((participant): participant is Participant => Boolean(participant.userId));
}

function getPactWindow(pact: ActivePact) {
  const start = new Date(`${pact.start_date}T00:00:00.000Z`);
  const endExclusive = new Date(`${pact.end_date}T00:00:00.000Z`);

  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);

  if (pact.active_at) {
    const activatedAt = new Date(pact.active_at);

    if (activatedAt > start) {
      return { start: activatedAt.toISOString(), endExclusive };
    }
  }

  return { start: start.toISOString(), endExclusive };
}

export async function getPactWorkoutCounts(
  admin: AdminClient,
  pact: ActivePact,
  participants = getParticipants(pact),
) {
  const counts = Object.fromEntries(participants.map(participant => [participant.userId, 0])) as Record<string, number>;

  if (!pact.active_at || participants.length === 0) {
    return counts;
  }

  const { start, endExclusive } = getPactWindow(pact);
  const { data: workouts, error } = await admin
    .from("workouts")
    .select("user_id")
    .in("user_id", participants.map(participant => participant.userId))
    .gte("logged_at", start)
    .lt("logged_at", endExclusive.toISOString());

  if (error) {
    throw error;
  }

  for (const workout of workouts ?? []) {
    counts[workout.user_id] = (counts[workout.user_id] ?? 0) + 1;
  }

  return counts;
}

export async function finalizeActivePactIfNeeded(
  admin: AdminClient,
  pact: ActivePact,
  now = new Date(),
) {
  if (pact.status !== "active") {
    return null;
  }

  const participants = getParticipants(pact);

  if (participants.length !== 2 || !pact.active_at) {
    return null;
  }

  const counts = await getPactWorkoutCounts(admin, pact, participants);
  const successfulParticipants = participants.filter(
    participant => counts[participant.userId] >= pact.target_amount,
  );
  const { endExclusive } = getPactWindow(pact);
  const deadlineReached = now >= endExclusive;

  if (successfulParticipants.length !== participants.length && !deadlineReached) {
    return null;
  }

  const finalResult = successfulParticipants.length === participants.length
    ? "both_completed"
    : successfulParticipants.length === 1
      ? "winner"
      : "both_failed";
  const winnerId = finalResult === "winner" ? successfulParticipants[0].userId : null;
  const { data, error } = await admin
    .from("pacts")
    .update({
      status: "completed",
      final_result: finalResult,
      final_workout_counts: counts,
      winner_id: winnerId,
      completed_at: now.toISOString(),
    })
    .eq("id", pact.id)
    .eq("status", "active")
    .select("id, status, final_result, winner_id, completed_at")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function finalizeDueActivePacts(admin: AdminClient) {
  const { data: pacts, error } = await admin
    .from("pacts")
    .select(activePactSelect)
    .eq("status", "active");

  if (error) {
    throw error;
  }

  return Promise.all((pacts ?? []).map(pact => finalizeActivePactIfNeeded(admin, pact)));
}
