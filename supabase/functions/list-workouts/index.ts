import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getAdminClient, verifyGymPactSession } from "../_shared/gympact-session.ts";
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

serve(async (request) => {
  const corsHeaders = getCorsHeaders(request);

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const { sessionToken, dataEnvironment, limit, cursor, activityFeed } = await request.json();
    const environment = getDataEnvironment(dataEnvironment);
    const session = await verifyGymPactSession(sessionToken);

    if (!session || !environment) {
      return new Response(JSON.stringify({ error: "Invalid session." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = getAdminClient();
    const requestedLimit = Number(limit);
    const usePagination = Number.isInteger(requestedLimit) && requestedLimit > 0;
    const pageSize = Math.min(requestedLimit, 25);
    const cursorLoggedAt = typeof cursor?.loggedAt === "string" ? new Date(cursor.loggedAt) : null;
    const cursorId = typeof cursor?.id === "string" ? cursor.id : null;

    if (usePagination && cursor && (!cursorLoggedAt || Number.isNaN(cursorLoggedAt.valueOf()) || !cursorId)) {
      return new Response(JSON.stringify({ error: "Invalid workout cursor." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isActivityFeed = activityFeed === true;
    const source = isActivityFeed ? "activity_feed" : "workouts";
    const fields = isActivityFeed
      ? "id, activity_type, user_id, activity_name, muscles, measurements, duration_minutes, notes, photo_path, logged_at, month_start, monthly_goal, athlete_name"
      : "id, user_id, activity_name, muscles, measurements, duration_minutes, notes, photo_path, logged_at, users(display_name)";

    let query = admin
      .from(source)
      .select(fields)
      .eq("data_environment", environment)
      .order("logged_at", { ascending: false })
      .order("id", { ascending: false });

    if (usePagination && cursorLoggedAt && cursorId) {
      query = query.or(`logged_at.lt.${cursorLoggedAt.toISOString()},and(logged_at.eq.${cursorLoggedAt.toISOString()},id.lt.${cursorId})`);
    }

    if (usePagination) query = query.limit(pageSize + 1);

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const rows = data ?? [];
    const hasMore = usePagination && rows.length > pageSize;
    const page = hasMore ? rows.slice(0, pageSize) : rows;
    const workouts = await Promise.all(page.map(async workout => {
      const photoBucket = workout.activity_type === "monthly_goal_completion"
        ? "monthly-pact-proofs"
        : "workout-proofs";
      const { data: photo, error: photoError } = workout.photo_path
        ? await admin.storage.from(photoBucket).createSignedUrl(workout.photo_path, 60 * 60)
        : { data: null, error: null };

      return {
        ...workout,
        activity_type: workout.activity_type ?? "workout",
        athlete_name: workout.athlete_name ?? workout.users?.display_name ?? "GymPact athlete",
        photo_url: photoError ? null : photo.signedUrl,
      };
    }));

    const lastWorkout = page.at(-1);
    const nextCursor = hasMore && lastWorkout
      ? { loggedAt: lastWorkout.logged_at, id: lastWorkout.id }
      : null;

    return new Response(JSON.stringify({ workouts, hasMore, nextCursor }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Unable to load workouts." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
