import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getAdminClient, verifyGymPactSession } from "../_shared/gympact-session.ts";
import { getDataEnvironment } from "../_shared/data-environment.ts";

const measurementUnits = new Set(["minutes", "reps", "sets", "miles", "steps"]);
const allowedOrigins = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://nafisahumyra.github.io",
]);

type Measurement = { amount: number; unit: string };

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") ?? "";
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  if (allowedOrigins.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function json(body: unknown, request: Request, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), "Content-Type": "application/json" },
  });
}

serve(async request => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders(request) });
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders(request) });

  try {
    const body = await request.json();
    const environment = getDataEnvironment(body.dataEnvironment);
    const session = await verifyGymPactSession(body.sessionToken);
    const userId = body.userId;
    const workoutId = body.workoutId;
    const activityName = typeof body.activityName === "string" ? body.activityName.trim() : "";
    const muscles = Array.isArray(body.muscles)
      ? body.muscles.filter((muscle: unknown): muscle is string => typeof muscle === "string" && muscle.trim())
      : [];
    const notes = typeof body.notes === "string" && body.notes.trim() ? body.notes : null;
    const loggedAt = typeof body.loggedAt === "string" ? new Date(body.loggedAt) : null;
    const measurements = Array.isArray(body.measurements)
      ? body.measurements.filter((measurement: unknown): measurement is Measurement => (
        typeof measurement === "object" && measurement !== null &&
        typeof (measurement as Measurement).amount === "number" &&
        Number.isInteger((measurement as Measurement).amount) &&
        (measurement as Measurement).amount > 0 &&
        typeof (measurement as Measurement).unit === "string" &&
        measurementUnits.has((measurement as Measurement).unit)
      ))
      : [];

    if (
      !session || !environment || typeof userId !== "string" || typeof workoutId !== "string" ||
      !activityName || !muscles.length || !Array.isArray(body.measurements) ||
      !measurements.length || measurements.length !== body.measurements.length || !loggedAt || Number.isNaN(loggedAt.valueOf()) ||
      loggedAt > new Date()
    ) {
      return json({ error: "Invalid workout update." }, request, 400);
    }

    const admin = getAdminClient();
    const { data: existing, error: existingError } = await admin
      .from("workouts")
      .select("id, user_id, photo_path")
      .eq("id", workoutId)
      .eq("data_environment", environment)
      .maybeSingle();
    if (existingError) throw existingError;
    if (!existing) return json({ error: "Workout not found." }, request, 404);

    // The owner check is performed against the stored record rather than
    // trusting the UI to decide which menu actions to display.
    if (existing.user_id !== userId) return json({ error: "You can only edit your own workouts." }, request, 403);

    const { data: workout, error: updateError } = await admin
      .from("workouts")
      .update({
        activity_name: activityName,
        muscles: JSON.stringify(muscles),
        measurements,
        notes,
        logged_at: loggedAt.toISOString(),
      })
      .eq("id", workoutId)
      .eq("user_id", userId)
      .eq("data_environment", environment)
      .select("id, user_id, activity_name, muscles, measurements, duration_minutes, notes, photo_path, logged_at")
      .single();
    if (updateError) throw updateError;

    return json({ workout }, request);
  } catch (error) {
    console.error("Unable to update workout.", error);
    return json({ error: "Unable to update workout." }, request, 500);
  }
});
