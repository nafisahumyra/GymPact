import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getAdminClient, verifyGymPactSession } from "../_shared/gympact-session.ts";

const allowedOrigins = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://nafisahumyra.github.io",
]);
const supportedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

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

function fileExtension(type: string) {
  return type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
}

async function signedPhotoUrl(admin: ReturnType<typeof getAdminClient>, path: string | null) {
  if (!path) return null;
  const { data, error } = await admin.storage.from("profile-photos").createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

serve(async request => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders(request) });
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders(request) });

  try {
    const isFormRequest = (request.headers.get("content-type") ?? "").includes("multipart/form-data");
    const payload = isFormRequest ? await request.formData() : await request.json();
    const get = (key: string) => isFormRequest ? payload.get(key) : payload[key];
    const action = get("action");
    const session = await verifyGymPactSession(get("sessionToken"));
    if (!session?.athlete_id) return json({ error: "Select an athlete before updating a profile." }, request, 401);

    const admin = getAdminClient();
    const { data: athlete, error: athleteError } = await admin
      .from("users")
      .select("id, display_name, profile_photo_path")
      .eq("id", session.athlete_id)
      .single();
    if (athleteError) throw athleteError;

    if (action === "get") {
      return json({ displayName: athlete.display_name, photoUrl: await signedPhotoUrl(admin, athlete.profile_photo_path) }, request);
    }

    if (action === "remove") {
      const { error } = await admin.from("users").update({ profile_photo_path: null }).eq("id", athlete.id);
      if (error) throw error;
      if (athlete.profile_photo_path) await admin.storage.from("profile-photos").remove([athlete.profile_photo_path]);
      return json({ displayName: athlete.display_name, photoUrl: null }, request);
    }

    const photo = get("photo");
    if (action !== "update" || !(photo instanceof File) || photo.size === 0 || photo.size > 5 * 1024 * 1024 || !supportedTypes.has(photo.type)) {
      return json({ error: "Choose a JPEG, PNG, or WebP photo smaller than 5 MB." }, request, 400);
    }

    const path = `${athlete.id}/${crypto.randomUUID()}.${fileExtension(photo.type)}`;
    const { error: uploadError } = await admin.storage.from("profile-photos").upload(path, photo, { contentType: photo.type, upsert: false });
    if (uploadError) throw uploadError;

    const { error: updateError } = await admin.from("users").update({ profile_photo_path: path }).eq("id", athlete.id);
    if (updateError) {
      await admin.storage.from("profile-photos").remove([path]);
      throw updateError;
    }

    if (athlete.profile_photo_path) await admin.storage.from("profile-photos").remove([athlete.profile_photo_path]);
    return json({ displayName: athlete.display_name, photoUrl: await signedPhotoUrl(admin, path) }, request);
  } catch (error) {
    console.error("Unable to update profile photo.", error);
    return json({ error: "Unable to update profile photo." }, request, 500);
  }
});
