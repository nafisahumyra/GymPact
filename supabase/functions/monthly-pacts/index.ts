import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getAdminClient, verifyGymPactSession } from "../_shared/gympact-session.ts";

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
function monthStartForNewPact(now = new Date()) {
  const local = localDateParts(now);
  const date = new Date(Date.UTC(local.year, local.month - 1, 1));
  if (local.day !== 1) date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString().slice(0, 10);
}
function monthEnd(monthStart: string) {
  const date = new Date(`${monthStart}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  date.setUTCDate(0);
  return date.toISOString().slice(0, 10);
}
function isMonthActive(monthStart: string, now = new Date()) {
  const local = localDateParts(now);
  const today = `${local.year}-${String(local.month).padStart(2, "0")}-${String(local.day).padStart(2, "0")}`;
  return today >= monthStart && today <= monthEnd(monthStart);
}

async function monthlyTestDate(admin: ReturnType<typeof getAdminClient>) {
  const { data, error } = await admin.from("monthly_pact_test_mode").select("simulated_date").eq("id", true).maybeSingle();
  if (error) throw error;
  return data?.simulated_date ?? null;
}

async function monthlyReferenceNow(admin: ReturnType<typeof getAdminClient>) {
  const simulatedDate = await monthlyTestDate(admin);
  return simulatedDate ? new Date(`${simulatedDate}T12:00:00-04:00`) : new Date();
}
function monthLabel(monthStart: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "long", year: "numeric" }).format(new Date(`${monthStart}T12:00:00Z`));
}

async function mapPact(admin: ReturnType<typeof getAdminClient>, pact: any) {
  const { data: commitments, error } = await admin.from("monthly_pact_commitments")
    .select("user_id, goal, signature, signed_at, completed_at, proof_path, users(display_name)")
    .eq("monthly_pact_id", pact.id).order("signed_at");
  if (error) throw error;
  const { data: checkins, error: checkinsError } = await admin.from("monthly_pact_checkins")
    .select("id, user_id, checkin_date, body, created_at, users(display_name)")
    .eq("monthly_pact_id", pact.id).order("created_at");
  if (checkinsError) throw checkinsError;
  return {
    id: pact.id, monthStart: pact.month_start, monthEnd: monthEnd(pact.month_start), monthLabel: monthLabel(pact.month_start),
    createdBy: pact.created_by, recipientId: pact.recipient_id, consequence: pact.consequence, status: pact.status,
    finalResult: pact.final_result, createdAt: pact.created_at, signedAt: pact.signed_at, finalizedAt: pact.finalized_at,
    commitments: (commitments ?? []).map((item: any) => ({ userId: item.user_id, displayName: item.users?.display_name ?? "GymPact athlete", goal: item.goal, signature: item.signature, signedAt: item.signed_at, completedAt: item.completed_at, proofPath: item.proof_path })),
    checkins: (checkins ?? []).map((item: any) => ({ id: item.id, userId: item.user_id, displayName: item.users?.display_name ?? "GymPact athlete", date: item.checkin_date, body: item.body, createdAt: item.created_at })),
  };
}

async function validUser(admin: ReturnType<typeof getAdminClient>, userId: unknown) {
  if (typeof userId !== "string") return false;
  const { data } = await admin.from("users").select("id").eq("id", userId).maybeSingle();
  return Boolean(data);
}

serve(async request => {
  if (request.method === "OPTIONS") return new Response(null, { headers: headers(request) });
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: headers(request) });
  try {
    const body = await request.json();
    if (!await verifyGymPactSession(body.sessionToken)) return json({ error: "Invalid session." }, request, 401);
    const admin = getAdminClient();
    await admin.rpc("finalize_due_monthly_pacts");
    const action = body.action;

    if (action === "test-mode-get") {
      return json({ simulatedDate: await monthlyTestDate(admin) }, request);
    }

    if (action === "test-mode-set") {
      const simulatedDate = body.simulatedDate === null ? null : body.simulatedDate;
      if (simulatedDate !== null && !["2026-09-01", "2026-09-15"].includes(simulatedDate)) {
        return json({ error: "Unsupported test date." }, request, 400);
      }
      const { error } = await admin.from("monthly_pact_test_mode").upsert({ id: true, simulated_date: simulatedDate, updated_at: new Date().toISOString() });
      if (error) throw error;
      return json({ simulatedDate }, request);
    }

    const referenceNow = await monthlyReferenceNow(admin);

    if (action === "get") {
      const { data: openPact, error } = await admin.from("monthly_pacts").select("*")
        .in("status", ["pending", "upcoming", "active"]).order("month_start").limit(1).maybeSingle();
      if (error) throw error;
      const candidateMonth = monthStartForNewPact(referenceNow);
      return json({ pact: openPact ? await mapPact(admin, openPact) : null, candidateMonth, candidateLabel: monthLabel(candidateMonth), simulatedDate: await monthlyTestDate(admin) }, request);
    }

    if (!await validUser(admin, body.userId)) return json({ error: "Unknown athlete." }, request, 400);

    if (action === "create") {
      const goal = typeof body.goal === "string" ? body.goal.trim() : "";
      const signature = typeof body.signature === "string" ? body.signature.trim() : "";
      const consequence = typeof body.consequence === "string" ? body.consequence.trim() : "";
      if (!goal || !signature || !consequence) return json({ error: "Goal, consequence, and signature are required." }, request, 400);
      const { data: users, error: usersError } = await admin.from("users").select("id").order("id");
      if (usersError || users?.length !== 2) throw usersError || new Error("Athletes unavailable");
      const recipient = users.find(user => user.id !== body.userId);
      const monthStart = monthStartForNewPact(referenceNow);
      const { data: pact, error } = await admin.from("monthly_pacts").insert({ month_start: monthStart, created_by: body.userId, recipient_id: recipient.id, consequence, status: "pending" }).select().single();
      if (error) return json({ error: error.code === "23505" ? "A Pact already exists for this month." : "Unable to create Month Pact." }, request, error.code === "23505" ? 409 : 400);
      const { error: commitmentError } = await admin.from("monthly_pact_commitments").insert({ monthly_pact_id: pact.id, user_id: body.userId, goal, signature });
      if (commitmentError) throw commitmentError;
      return json({ pact: await mapPact(admin, pact) }, request, 201);
    }

    const { data: pact, error: pactError } = await admin.from("monthly_pacts").select("*").eq("id", body.pactId).maybeSingle();
    if (pactError || !pact) return json({ error: "Month Pact not found." }, request, 404);

    if (action === "decline") {
      if (pact.status !== "pending" || pact.recipient_id !== body.userId) return json({ error: "This Pact cannot be declined." }, request, 409);
      await admin.from("monthly_pacts").update({ status: "declined" }).eq("id", pact.id);
      return json({ declined: true }, request);
    }
    if (action === "sign") {
      const goal = typeof body.goal === "string" ? body.goal.trim() : "";
      const signature = typeof body.signature === "string" ? body.signature.trim() : "";
      if (pact.status !== "pending" || pact.recipient_id !== body.userId || !goal || !signature) return json({ error: "Goal and signature are required to sign." }, request, 400);
      const { error } = await admin.from("monthly_pact_commitments").insert({ monthly_pact_id: pact.id, user_id: body.userId, goal, signature });
      if (error) throw error;
      const status = isMonthActive(pact.month_start, referenceNow) ? "active" : "upcoming";
      const { data: signed, error: updateError } = await admin.from("monthly_pacts").update({ status, signed_at: new Date().toISOString() }).eq("id", pact.id).select().single();
      if (updateError) throw updateError;
      return json({ pact: await mapPact(admin, signed) }, request);
    }
    if (action === "checkin") {
      const date = typeof body.date === "string" ? body.date : "";
      const text = typeof body.body === "string" ? body.body.trim() : "";
      const local = localDateParts(referenceNow);
      const today = `${local.year}-${String(local.month).padStart(2, "0")}-${String(local.day).padStart(2, "0")}`;
      if (pact.status !== "active" || !text || date < pact.month_start || date > monthEnd(pact.month_start) || date > today) return json({ error: "Check-ins are available only on active Pact days." }, request, 400);
      if (![pact.created_by, pact.recipient_id].includes(body.userId)) return json({ error: "Not a Pact participant." }, request, 403);
      const { error } = await admin.from("monthly_pact_checkins").insert({ monthly_pact_id: pact.id, user_id: body.userId, checkin_date: date, body: text });
      if (error) throw error;
      return json({ checkinSaved: true }, request, 201);
    }
    if (action === "list") {
      const { data, error } = await admin.from("monthly_pacts").select("*").in("status", ["completed", "failed"]).order("month_start", { ascending: false });
      if (error) throw error;
      return json({ pacts: await Promise.all((data ?? []).map(item => mapPact(admin, item))) }, request);
    }
    return json({ error: "Unknown action." }, request, 400);
  } catch (error) {
    return json({ error: "Unable to process Month Pact." }, request, 500);
  }
});
