import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getAdminClient, verifyGymPactSession } from "../_shared/gympact-session.ts";

const allowedOrigins = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

function getCorsHeaders(request: Request) {
  const origin = request.headers.get("origin") ?? "";

  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "null",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
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
    const { sessionToken } = await request.json();
    const session = await verifyGymPactSession(sessionToken);

    if (!session) {
      return new Response(JSON.stringify({ error: "Invalid session." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = getAdminClient();
    const { data, error } = await admin
      .from("workouts")
      .select("id, user_id, muscles, duration_minutes, notes, photo_path, logged_at, users(display_name)")
      .order("logged_at", { ascending: false });

    if (error) {
      throw error;
    }

    const workouts = await Promise.all((data ?? []).map(async workout => {
      const { data: photo, error: photoError } = await admin.storage
        .from("workout-proofs")
        .createSignedUrl(workout.photo_path, 60 * 60);

      return {
        ...workout,
        athlete_name: workout.users?.display_name ?? "GymPact athlete",
        photo_url: photoError ? null : photo.signedUrl,
      };
    }));

    return new Response(JSON.stringify({ workouts }), {
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
