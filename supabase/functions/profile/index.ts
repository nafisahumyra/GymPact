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

    if (action !== "save") {
      return json({ error: "Unsupported profile action." }, request, 400);
    }

    const displayName = typeof get("displayName") === "string" ? get("displayName").trim() : "";
    if (!displayName || displayName.length > 60) {
      return json({ error: "Enter a display name of up to 60 characters." }, request, 400);
    }

    const photo = get("photo");
    const removePhoto = get("removePhoto") === "true";
    if (photo && (!(photo instanceof File) || photo.size === 0 || photo.size > 5 * 1024 * 1024 || !supportedTypes.has(photo.type))) {
      return json({ error: "Choose a JPEG, PNG, or WebP photo smaller than 5 MB." }, request, 400);
    }

    let nextPhotoPath: string | null = athlete.profile_photo_path;
    let uploadedPath: string | null = null;

    if (photo instanceof File) {
      uploadedPath = `${athlete.id}/${crypto.randomUUID()}.${fileExtension(photo.type)}`;
      const { error: uploadError } = await admin.storage.from("profile-photos").upload(uploadedPath, photo, { contentType: photo.type, upsert: false });
      if (uploadError) throw uploadError;
      nextPhotoPath = uploadedPath;
    } else if (removePhoto) {
      nextPhotoPath = null;
    }

    const { data: updatedAthlete, error: updateError } = await admin
      .from("users")
      .update({ display_name: displayName, profile_photo_path: nextPhotoPath })
      .eq("id", athlete.id)
      .select("display_name, profile_photo_path")
      .single();

    if (updateError) {
      if (uploadedPath) await admin.storage.from("profile-photos").remove([uploadedPath]);
      if (updateError.code === "23505") return json({ error: "That display name is already in use." }, request, 409);
      throw updateError;
    }

    if (athlete.profile_photo_path && athlete.profile_photo_path !== nextPhotoPath) {
      await admin.storage.from("profile-photos").remove([athlete.profile_photo_path]);
    }

    return json({
      displayName: updatedAthlete.display_name,
      photoUrl: await signedPhotoUrl(admin, updatedAthlete.profile_photo_path),
    }, request);
  } catch (error) {
    console.error("Unable to update profile photo.", error);
    return json({ error: "Unable to update profile photo." }, request, 500);
  }
});
