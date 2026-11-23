import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getAdminClient, verifyGymPactSession } from "../_shared/gympact-session.ts";
import { getDataEnvironment } from "../_shared/data-environment.ts";

const origins = new Set(["http://localhost:3000", "http://127.0.0.1:3000", "https://nafisahumyra.github.io"]);
const headers = (request: Request) => {
  const origin = request.headers.get("origin") ?? "";
  return { "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json", ...(origins.has(origin) ? { "Access-Control-Allow-Origin": origin } : {}) };
};
const json = (body: unknown, request: Request, status = 200) => new Response(JSON.stringify(body), { status, headers: headers(request) });

function localDateParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return { year: Number(values.year), month: Number(values.month), day: Number(values.day) };
}
function monthStartForNewPact(environment: "production" | "dev" = "production") {
  const local = localDateParts();
  const date = new Date(Date.UTC(local.year, local.month - 1, 1));

  if (environment === "dev" && local.day !== 1) date.setUTCMonth(date.getUTCMonth() + 1);

  return date.toISOString().slice(0, 10);
}
function monthEnd(monthStart: string) {
  const date = new Date(`${monthStart}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  date.setUTCDate(0);
  return date.toISOString().slice(0, 10);
}
function isMonthActive(monthStart: string) {
  const local = localDateParts();
  const today = `${local.year}-${String(local.month).padStart(2, "0")}-${String(local.day).padStart(2, "0")}`;
  return today >= monthStart && today <= monthEnd(monthStart);
}
function monthLabel(monthStart: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "long", year: "numeric" }).format(new Date(`${monthStart}T12:00:00Z`));
}

function localDateString(value: string | Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function mapPact(admin: ReturnType<typeof getAdminClient>, pact: any) {
  const { data: commitments, error } = await admin.from("monthly_pact_commitments")
    .select("user_id, goal, signature, signed_at, completed_at, proof_path, goal_type, tracking_mode, target, unit, reported_progress, users(display_name)")
    .eq("monthly_pact_id", pact.id).order("signed_at");
  if (error) throw error;
  const { data: checkins, error: checkinsError } = await admin.from("monthly_pact_checkins")
    .select("id, user_id, checkin_date, body, created_at, users(display_name)")
    .eq("monthly_pact_id", pact.id).order("created_at");
  if (checkinsError) throw checkinsError;
  const { data: participants, error: participantsError } = await admin.from("users")
    .select("id, display_name")
    .in("id", [pact.created_by, pact.recipient_id]);
  if (participantsError) throw participantsError;
  return {
    id: pact.id, monthStart: pact.month_start, monthEnd: monthEnd(pact.month_start), monthLabel: monthLabel(pact.month_start),
    createdBy: pact.created_by, recipientId: pact.recipient_id, consequence: pact.consequence, status: pact.status,
    finalResult: pact.final_result, createdAt: pact.created_at, signedAt: pact.signed_at, finalizedAt: pact.finalized_at,
    commitments: (commitments ?? []).map((item: any) => ({
      userId: item.user_id, displayName: item.users?.display_name ?? "GymPact athlete", goal: item.goal,
      signature: item.signature, signedAt: item.signed_at, completedAt: item.completed_at,
      goalType: item.goal_type, trackingMode: item.tracking_mode, target: item.target,
      unit: item.unit, reportedProgress: item.reported_progress,
      completedByDeadline: Boolean(item.completed_at && localDateString(item.completed_at) <= monthEnd(pact.month_start)),
      proofPath: item.proof_path
    })),
    participants: (participants ?? []).map(item => ({ userId: item.id, displayName: item.display_name ?? "GymPact athlete" })),
    checkins: (checkins ?? []).map((item: any) => ({ id: item.id, userId: item.user_id, displayName: item.users?.display_name ?? "GymPact athlete", date: item.checkin_date, body: item.body, createdAt: item.created_at })),
  };
}

async function validUser(admin: ReturnType<typeof getAdminClient>, userId: unknown) {
  if (typeof userId !== "string") return false;
  const { data } = await admin.from("users").select("id").eq("id", userId).maybeSingle();
  return Boolean(data);
}

function trackingSettings(body: Record<string, unknown>) {
  const goalType = body.goalType === "cumulative" ? "cumulative" : body.goalType === "single_attempt" ? "single_attempt" : null;
  const trackingMode = body.trackingMode === "checkins_only" ? "checkins_only" : body.trackingMode === "track" ? "track" : null;
  if (!goalType || !trackingMode) return null;
  if (trackingMode === "checkins_only") return { goal_type: goalType, tracking_mode: trackingMode, target: null, unit: null, reported_progress: null };
  const target = typeof body.target === "number" ? body.target : Number(body.target);
  const reportedProgress = typeof body.startingValue === "number" ? body.startingValue : Number(body.startingValue);
  const unit = typeof body.unit === "string" ? body.unit.trim() : "";
  if (!Number.isFinite(target) || target <= 0 || !Number.isFinite(reportedProgress) || reportedProgress < 0 || !unit || unit.length > 40) return null;
  return { goal_type: goalType, tracking_mode: trackingMode, target, unit, reported_progress: reportedProgress };
}

serve(async request => {
  if (request.method === "OPTIONS") return new Response(null, { headers: headers(request) });
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: headers(request) });
  try {
    const body = await request.json();
    const session = await verifyGymPactSession(body.sessionToken);
    if (!session) return json({ error: "Invalid session." }, request, 401);
    const environment = getDataEnvironment(body.dataEnvironment);
    if (!environment) return json({ error: "Invalid data environment." }, request, 400);
    const admin = getAdminClient();
    await admin.rpc("finalize_due_monthly_pacts");
    const action = body.action;

    if (action === "get") {
      const candidateMonth = monthStartForNewPact(environment);
      let currentPact;
      let error;

      if (environment === "dev") {
        ({ data: currentPact, error } = await admin.from("monthly_pacts").select("*")
          .eq("data_environment", environment).in("status", ["pending", "upcoming", "active"])
          .order("month_start").limit(1).maybeSingle());
      } else {
        ({ data: currentPact, error } = await admin.from("monthly_pacts").select("*")
          .eq("data_environment", environment).eq("month_start", candidateMonth)
          .in("status", ["pending", "upcoming", "active", "completed", "failed"])
          .maybeSingle());
      }
      if (error) throw error;
      const { data: candidateUsers, error: candidateUsersError } = await admin.from("users").select("id, display_name").order("id");
      if (candidateUsersError) throw candidateUsersError;
      const partner = (candidateUsers ?? []).find(user => user.id !== session.athlete_id) ?? null;
      return json({ pact: currentPact ? await mapPact(admin, currentPact) : null, candidateMonth, candidateLabel: monthLabel(candidateMonth), partner: partner ? { userId: partner.id, displayName: partner.display_name ?? "GymPact athlete" } : null }, request);
    }

    if (action === "list") {
      const { data, error } = await admin.from("monthly_pacts").select("*")
        .eq("data_environment", environment).in("status", ["completed", "failed"])
        .order("month_start", { ascending: false });
      if (error) throw error;
      return json({ pacts: await Promise.all((data ?? []).map(item => mapPact(admin, item))) }, request);
    }

    if (!await validUser(admin, body.userId)) return json({ error: "Unknown athlete." }, request, 400);

    if (action === "create") {
      const goal = typeof body.goal === "string" ? body.goal.trim() : "";
      const signature = typeof body.signature === "string" ? body.signature.trim() : "";
      const consequence = typeof body.consequence === "string" ? body.consequence.trim() : "";
      const tracking = trackingSettings(body);
      if (!goal || !signature || !consequence || !tracking) return json({ error: "Goal, consequence, signature, and valid tracking settings are required." }, request, 400);
      const { data: users, error: usersError } = await admin.from("users").select("id").order("id");
      if (usersError || users?.length !== 2) throw usersError || new Error("Athletes unavailable");
      const recipient = users.find(user => user.id !== body.userId);
      const monthStart = monthStartForNewPact(environment);
      const { data: pact, error } = await admin.from("monthly_pacts").insert({ month_start: monthStart, created_by: body.userId, recipient_id: recipient.id, consequence, status: "pending", data_environment: environment }).select().single();
      if (error) return json({ error: error.code === "23505" ? "A Pact already exists for this month." : "Unable to create Month Pact." }, request, error.code === "23505" ? 409 : 400);
      const { error: commitmentError } = await admin.from("monthly_pact_commitments").insert({ monthly_pact_id: pact.id, user_id: body.userId, goal, signature, ...tracking });
      if (commitmentError) throw commitmentError;
      return json({ pact: await mapPact(admin, pact) }, request, 201);
    }

    const { data: pact, error: pactError } = await admin.from("monthly_pacts").select("*").eq("id", body.pactId).eq("data_environment", environment).maybeSingle();
    if (pactError || !pact) return json({ error: "Month Pact not found." }, request, 404);

    if (action === "decline") {
      if (pact.status !== "pending" || pact.recipient_id !== body.userId) return json({ error: "This Pact cannot be declined." }, request, 409);
      await admin.from("monthly_pacts").update({ status: "declined" }).eq("id", pact.id);
      return json({ declined: true }, request);
    }
    if (action === "sign") {
      const goal = typeof body.goal === "string" ? body.goal.trim() : "";
      const signature = typeof body.signature === "string" ? body.signature.trim() : "";
      const tracking = trackingSettings(body);
      if (pact.status !== "pending" || pact.recipient_id !== body.userId || !goal || !signature || !tracking) return json({ error: "Goal, signature, and valid tracking settings are required to sign." }, request, 400);
      const { error } = await admin.from("monthly_pact_commitments").insert({ monthly_pact_id: pact.id, user_id: body.userId, goal, signature, ...tracking });
      if (error) throw error;
      const status = isMonthActive(pact.month_start) ? "active" : "upcoming";
      const { data: signed, error: updateError } = await admin.from("monthly_pacts").update({ status, signed_at: new Date().toISOString() }).eq("id", pact.id).select().single();
      if (updateError) throw updateError;
      return json({ pact: await mapPact(admin, signed) }, request);
    }
    if (action === "checkin") {
      const date = typeof body.date === "string" ? body.date : "";
      const text = typeof body.body === "string" ? body.body.trim() : "";
      const local = localDateParts();
      const today = `${local.year}-${String(local.month).padStart(2, "0")}-${String(local.day).padStart(2, "0")}`;
      if (pact.status !== "active" || !text || date < pact.month_start || date > monthEnd(pact.month_start) || date > today) return json({ error: "Check-ins are available only on active Pact days." }, request, 400);
      if (!session.athlete_id || body.userId !== session.athlete_id || ![pact.created_by, pact.recipient_id].includes(body.userId)) return json({ error: "Not a Pact participant." }, request, 403);
      const { data: existing, error: existingError } = await admin.from("monthly_pact_checkins")
        .select("id").eq("monthly_pact_id", pact.id).eq("user_id", body.userId).eq("checkin_date", date)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (existingError) throw existingError;
      const result = existing
        ? await admin.from("monthly_pact_checkins").update({ body: text }).eq("id", existing.id)
        : await admin.from("monthly_pact_checkins").insert({ monthly_pact_id: pact.id, user_id: body.userId, checkin_date: date, body: text });
      if (result.error) throw result.error;
      return json({ checkinSaved: true, checkinUpdated: Boolean(existing) }, request, existing ? 200 : 201);
    }
    return json({ error: "Unknown action." }, request, 400);
  } catch (error) {
    return json({ error: "Unable to process Month Pact." }, request, 500);
  }
});
