import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getAdminClient, verifyGymPactSession } from "../_shared/gympact-session.ts";
import { finalizeDueActivePacts } from "../_shared/pact-finalization.ts";
import {
  getPactWindow,
  getPactRequirementProgress,
  getPactRequirements,
} from "../_shared/pact-requirements.ts";
import { classifyWorkoutForPact } from "../_shared/pact-workout-classification.ts";
import { getDataEnvironment } from "../_shared/data-environment.ts";

const allowedOrigins = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://nafisahumyra.github.io",
]);

function getCorsHeaders(request: Request) {
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

async function mapPact(
  admin: ReturnType<typeof getAdminClient>,
  pact: Record<string, unknown>,
) {
  const participantDetails = Array.isArray(pact.pact_participants)
    ? pact.pact_participants
      .map(participant => {
        const { user_id: userId, users } = participant as {
          user_id?: string;
          users?: { display_name?: string; profile_photo_path?: string | null } | null;
        };

        return {
          userId,
          displayName: users?.display_name,
          profilePhotoPath: users?.profile_photo_path ?? null,
        };
      })
      .filter((participant): participant is { userId: string; displayName?: string } =>
        typeof participant.userId === "string"
      )
    : [];

  const participants = participantDetails.map(participant => participant.userId);
  const dataEnvironment = typeof pact.data_environment === "string"
    ? pact.data_environment
    : "production";
  const requirements = await getPactRequirements(admin, String(pact.id));
  const pactWindow = getPactWindow(pact as {
    start_date: string;
    end_date: string;
    active_at: string | null;
  });
  const requirementProgress = await getPactRequirementProgress(
    admin,
    pact as { id: string; start_date: string; end_date: string; active_at: string | null },
    participantDetails.map(participant => ({
      userId: participant.userId,
      displayName: participant.displayName ?? "GymPact athlete",
    })),
    requirements,
  );
  const progress = requirementProgress.map(participant => {
    const workouts = participant.requirements.find(requirement => requirement.type === "workouts");
    return {
      ...participant,
      completed: workouts?.completed ?? 0,
      target: workouts?.targetAmount ?? 0,
    };
  });

  const participantDetailsWithPhotos = await Promise.all(participantDetails.map(async participant => {
    if (!participant.profilePhotoPath) return { userId: participant.userId, displayName: participant.displayName, profilePhotoUrl: null };
    const { data, error } = await admin.storage.from("profile-photos").createSignedUrl(participant.profilePhotoPath, 60 * 60);
    if (error) return { userId: participant.userId, displayName: participant.displayName, profilePhotoUrl: null };
    return { userId: participant.userId, displayName: participant.displayName, profilePhotoUrl: data.signedUrl };
  }));

  const workoutDays = Object.fromEntries(participants.map(userId => [userId, [] as Array<{ date: string; activityName: string; loggedAt: string }>])) as Record<string, Array<{ date: string; activityName: string; loggedAt: string }>>;

  if (pact.active_at && participants.length) {
    const { start, endExclusive } = pactWindow;
    const { data: workouts, error: workoutsError } = await admin
      .from("workouts")
      .select("user_id, activity_name, muscles, logged_at")
      .in("user_id", participants)
      .eq("data_environment", dataEnvironment)
      .gte("logged_at", start)
      .lt("logged_at", endExclusive.toISOString())
      .order("logged_at", { ascending: true });
    if (workoutsError) throw workoutsError;

    const pactHasWorkoutRequirement = requirements.some(requirement => requirement.type === "workouts" || requirement.type === "hiit");
    (workouts ?? []).forEach(workout => {
      const classified = classifyWorkoutForPact(workout.muscles, requirements);
      const isQualifying = pactHasWorkoutRequirement
        ? classified.workouts > 0 || classified.hiit > 0
        : true;
      if (!isQualifying || !workoutDays[workout.user_id]) return;
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
      }).formatToParts(new Date(workout.logged_at));
      const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
      workoutDays[workout.user_id].push({
        date: `${values.year}-${values.month}-${values.day}`,
        activityName: workout.activity_name || "Workout",
        loggedAt: workout.logged_at,
      });
    });
  }

  return {
    id: pact.id,
    createdBy: pact.created_by,
    participants,
    participantDetails: participantDetailsWithPhotos,
    goalType: pact.goal_type,
    targetAmount: pact.target_amount,
    requirements,
    timeframe: pact.timeframe,
    wagerType: pact.wager_type,
    wagerDescription: pact.wager_description,
    status: pact.status,
    createdAt: pact.created_at,
    activeAt: pact.active_at,
    startDate: pact.start_date,
    endDate: pact.end_date,
    endsAt: pactWindow.endExclusive.toISOString(),
    cancelledAt: pact.cancelled_at,
    progress,
    workoutDays,
  };
}

serve(async (request) => {
  const corsHeaders = getCorsHeaders(request);

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const { sessionToken, dataEnvironment } = await request.json();
    const environment = getDataEnvironment(dataEnvironment);
    const session = await verifyGymPactSession(sessionToken);

    if (!session || !environment) {
      return new Response(JSON.stringify({ error: "Invalid session." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = getAdminClient();
    await finalizeDueActivePacts(admin);
    const { data: pact, error } = await admin
      .from("pacts")
      .select("id, created_by, goal_type, target_amount, timeframe, wager_type, wager_description, status, created_at, active_at, start_date, end_date, cancelled_at, data_environment, pact_participants(user_id, users(display_name, profile_photo_path))")
      .in("status", ["pending", "active"])
      .eq("data_environment", environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return new Response(JSON.stringify({ pact: pact ? await mapPact(admin, pact) : null }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Unable to load current pact." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
