import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getAdminClient, verifyGymPactSession } from "../_shared/gympact-session.ts";
import { finalizeDueActivePacts } from "../_shared/pact-finalization.ts";

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
    const formData = await request.formData();
    const session = await verifyGymPactSession(formData.get("sessionToken"));

    if (!session) {
      return new Response(JSON.stringify({ error: "Invalid session." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = formData.get("userId");
    const duration = Number(formData.get("durationMinutes"));
    const notes = formData.get("notes");
    const photo = formData.get("photo");
    let muscles: unknown;

    try {
      muscles = JSON.parse(String(formData.get("muscles") ?? ""));
    } catch {
      muscles = null;
    }

    if (
      typeof userId !== "string" ||
      !Array.isArray(muscles) ||
      muscles.length === 0 ||
      !muscles.every(muscle => typeof muscle === "string") ||
      !Number.isInteger(duration) ||
      duration <= 0 ||
      !(photo instanceof File) ||
      photo.size === 0 ||
      photo.size > 500 * 1024
    ) {
      return new Response(JSON.stringify({ error: "Invalid workout." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = getAdminClient();
    const { data: athlete, error: athleteError } = await admin
      .from("users")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (athleteError || !athlete) {
      return new Response(JSON.stringify({ error: "Unknown athlete." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const workoutId = crypto.randomUUID();
    const photoPath = `${userId}/${workoutId}.jpg`;
    const { error: uploadError } = await admin.storage
      .from("workout-proofs")
      .upload(photoPath, photo, {
        contentType: "image/jpeg",
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: workout, error: workoutError } = await admin
      .from("workouts")
      .insert({
        id: workoutId,
        user_id: userId,
        muscles: JSON.stringify(muscles),
        duration_minutes: duration,
        notes: typeof notes === "string" && notes ? notes : null,
        photo_path: photoPath,
        logged_at: new Date().toISOString(),
      })
      .select("id, user_id, muscles, duration_minutes, notes, photo_path, logged_at")
      .single();

    if (workoutError) {
      await admin.storage.from("workout-proofs").remove([photoPath]);
      throw workoutError;
    }

    // A Pact only finishes early when both athletes have reached its target.
    // All other outcomes remain active until the end of the Pact period.
    await finalizeDueActivePacts(admin);

    return new Response(JSON.stringify({ workout }), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Unable to log workout." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
