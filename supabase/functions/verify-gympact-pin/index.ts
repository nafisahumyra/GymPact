import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createGymPactSession } from "../_shared/gympact-session.ts";

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

function equalInConstantTime(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return difference === 0;
}

serve(async (request) => {
  const corsHeaders = getCorsHeaders(request);

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const configuredPin = Deno.env.get("GYMPACT_SHARED_PIN")?.trim();

  try {
    const { pin } = await request.json();
    const submittedPin = typeof pin === "string" ? pin.trim() : "";

    if (!configuredPin) {
      return new Response(JSON.stringify({ error: "PIN verification is not configured." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isValidFormat = /^\d{6}$/.test(submittedPin);
    const verified = isValidFormat && equalInConstantTime(submittedPin, configuredPin);

    if (!verified) {
      return new Response(JSON.stringify({ verified: false }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const session = await createGymPactSession();

    return new Response(JSON.stringify({
      verified: true,
      sessionToken: session.token,
      expiresAt: session.expiresAt,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ verified: false }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
