import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getAdminClient, verifyGymPactSession } from "../_shared/gympact-session.ts";
import { getCorsHeaders } from "../_shared/exercise-tracking.ts";

serve(async request => {
  const headers = getCorsHeaders(request);
  if (request.method === "OPTIONS") return new Response(null, { headers });
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers });
  try {
    const { sessionToken, dataEnvironment } = await request.json();
    if (dataEnvironment !== "dev" || !await verifyGymPactSession(sessionToken)) {
      return Response.json({ error: "Invalid reset request." }, { status: 401, headers });
    }
    const { error } = await getAdminClient().rpc("reset_gympact_dev_data");
    if (error) throw error;
    return Response.json({ reset: true }, { headers });
  } catch {
    return Response.json({ error: "Unable to reset Dev test data." }, { status: 500, headers });
  }
});
