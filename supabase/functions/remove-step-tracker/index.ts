import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getAdminClient, verifyGymPactSession } from "../_shared/gympact-session.ts";
import { ensureAthlete, getCorsHeaders } from "../_shared/exercise-tracking.ts";
import { getActivePactForAthlete } from "../_shared/step-tracking.ts";

serve(async request => {
  const corsHeaders = getCorsHeaders(request);
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  try {
    const { sessionToken, userId } = await request.json();
    const session = await verifyGymPactSession(sessionToken);
    if (!session?.athlete_id || session.athlete_id !== userId || !await ensureAthlete(userId)) return Response.json({ error: "Invalid session or athlete." }, { status: 401, headers: corsHeaders });
    const admin = getAdminClient(); const pact = await getActivePactForAthlete(admin, userId);
    if (!pact) return Response.json({ removed: true }, { headers: corsHeaders });
    return Response.json({ error: "Steps tracking is linked to this pact and cannot be removed." }, { status: 409, headers: corsHeaders });
  } catch { return Response.json({ error: "Unable to remove Steps tracker." }, { status: 500, headers: corsHeaders }); }
});
