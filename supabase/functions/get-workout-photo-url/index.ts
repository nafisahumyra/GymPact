import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getAdminClient, verifyGymPactSession } from "../_shared/gympact-session.ts";
import { getDataEnvironment } from "../_shared/data-environment.ts";

const allowedOrigins = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://nafisahumyra.github.io",
]);
const sharedAthleteNames = ["Nafisa", "Mahfuzur"];

function getCorsHeaders(request: Request) {
  const origin = request.headers.get("origin") ?? "";
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };

  if (allowedOrigins.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

serve(async request => {
  const corsHeaders = getCorsHeaders(request);

  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  try {
    const { sessionToken, userId, workoutId, dataEnvironment } = await request.json();
    const environment = getDataEnvironment(dataEnvironment);
    const session = await verifyGymPactSession(sessionToken);

    if (!session || !environment || typeof userId !== "string" || typeof workoutId !== "string" || !workoutId) {
      return Response.json({ error: "Invalid session or workout." }, { status: 401, headers: corsHeaders });
    }

    const admin = getAdminClient();
    const { data: sharedAthletes, error: athletesError } = await admin
      .from("users")
      .select("id")
      .in("display_name", sharedAthleteNames);

    if (athletesError) throw athletesError;
    const sharedAthleteIds = (sharedAthletes ?? []).map(athlete => athlete.id);

    if (!sharedAthleteIds.includes(userId)) {
      return Response.json({ error: "Not authorized to view workout photos." }, { status: 403, headers: corsHeaders });
    }

    const { data: workout, error } = await admin
      .from("workouts")
      .select("photo_path, user_id")
      .eq("id", workoutId)
      .eq("data_environment", environment)
      .in("user_id", sharedAthleteIds)
      .maybeSingle();

    if (error) throw error;
    if (!workout?.photo_path) return Response.json({ photoUrl: null }, { headers: corsHeaders });

    const { data: photo, error: photoError } = await admin.storage
      .from("workout-proofs")
      .createSignedUrl(workout.photo_path, 60 * 60);

    if (photoError) throw photoError;
    return Response.json({ photoUrl: photo?.signedUrl ?? null }, { headers: corsHeaders });
  } catch {
    return Response.json({ error: "Unable to load workout photo." }, { status: 500, headers: corsHeaders });
  }
});
