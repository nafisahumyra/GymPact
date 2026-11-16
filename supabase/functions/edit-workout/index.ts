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
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") ?? "";
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-gympact-edit-client",
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

function diagnosticSuffix(error: unknown, stage: string) {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" && /^[A-Z0-9]{2,12}$/.test(code)) return `EDIT-${stage}-${code}`;
  }
  return `EDIT-${stage}`;
}

serve(async request => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders(request) });
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders(request) });

  let stage = "REQUEST";

  try {
    const body = await request.json();
    const userId = typeof body.userId === "string" ? body.userId : "";
    const workoutId = typeof body.workoutId === "string"
      ? body.workoutId.replace(/^workout:/, "")
      : "";
    const environment = getDataEnvironment(body.dataEnvironment);
    stage = "SESSION";
    const session = await verifyGymPactSession(body.sessionToken);
    const loggedAt = typeof body.loggedAt === "string" ? new Date(body.loggedAt) : null;
    const muscles = Array.isArray(body.muscles)
      ? body.muscles.filter((muscle: unknown): muscle is string => typeof muscle === "string" && muscle.trim())
      : [];
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
    const notes = typeof body.notes === "string" && body.notes.trim() ? body.notes : null;

    if (!session || !userId || session.athlete_id !== userId) {
      return json({ error: "Your GymPact session expired. Please unlock GymPact and try again. [EDIT-SESSION]" }, request, 401);
    }

    if (
      !environment || !uuidPattern.test(workoutId) || !muscles.length ||
      !Array.isArray(body.measurements) || !measurements.length || measurements.length !== body.measurements.length ||
      !loggedAt || Number.isNaN(loggedAt.valueOf()) || loggedAt > new Date()
    ) {
      return json({ error: "Check the workout date, muscle groups, and measurements, then try again. [EDIT-VALIDATION]" }, request, 400);
    }

    stage = "DATABASE";
    const admin = getAdminClient();
    const { data: updated, error: updateError } = await admin
      .from("workouts")
      .update({
        activity_name: muscles.join(" · "),
        muscles: JSON.stringify(muscles),
        measurements,
        notes,
        logged_at: loggedAt.toISOString(),
      })
      .eq("id", workoutId)
      .eq("user_id", userId)
      .eq("data_environment", environment)
      .select("id, logged_at")
      .maybeSingle();

    if (updateError) throw updateError;
    if (!updated) return json({ error: "That workout could not be found. [EDIT-NOT-FOUND]" }, request, 404);

    return json({ workout: updated }, request);
  } catch (error) {
    console.error("Unable to edit workout.", error);
    return json({ error: `Unable to update workout. [${diagnosticSuffix(error, stage)}]` }, request, 500);
  }
});
