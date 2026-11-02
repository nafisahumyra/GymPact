const token = sessionStorage.getItem("gymPactSessionToken");
const athleteId = sessionStorage.getItem("gymPactSelectedAthleteId");
const athleteName = localStorage.getItem("currentUser") || "Athlete";
const state = { pact: null, month: null, workouts: [], trackers: [] };

const $ = selector => document.querySelector(selector);
const html = (strings, ...values) => strings.reduce((result, string, index) => result + string + (values[index] ?? ""), "");
const escapeHtml = value => String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
const requirementName = type => ({ workouts: "Workouts", hiit: "HIIT", steps: "Steps" })[type] || type;
const formatDate = value => new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const formatLoggedAt = value => new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function gymPactDay(value) {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
    const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${map.year}-${map.month}-${map.day}`;
}

function weekStart(day) {
    const date = new Date(`${day}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
    return date.toISOString().slice(0, 10);
}

function weeklyWorkoutStreak(workouts, target) {
    if (!target) return 0;
    const counts = new Map();
    workouts.forEach(workout => { const key = weekStart(gymPactDay(workout.logged_at)); counts.set(key, (counts.get(key) || 0) + 1); });
    let cursor = weekStart(gymPactDay(new Date()));
    let streak = 0;
    for (let index = 0; index < 104; index += 1) {
        if ((counts.get(cursor) || 0) >= target) streak += 1;
        else if (index > 0) break;
        const date = new Date(`${cursor}T00:00:00Z`); date.setUTCDate(date.getUTCDate() - 7); cursor = date.toISOString().slice(0, 10);
    }
    return streak;
}

function measurements(workout) {
    if (Array.isArray(workout.measurements)) return workout.measurements.filter(item => Number(item?.amount) > 0).map(item => `${item.amount} ${item.unit}`);
    return Number(workout.duration_minutes) > 0 ? [`${workout.duration_minutes} minutes`] : [];
}

function renderRequirements(requirements = []) {
    return requirements.map(requirement => {
        const total = Number(requirement.targetAmount || requirement.target_amount || 0);
        const complete = Number(requirement.completed || 0);
        const percent = total ? Math.min(100, (complete / total) * 100) : 0;
        return html`<div class="preview-requirement"><span>${escapeHtml(requirementName(requirement.type))}</span><strong>${complete.toLocaleString()} / ${total.toLocaleString()}</strong><progress max="100" value="${percent}"></progress></div>`;
    }).join("");
}

function renderHome() {
    $("#preview-greeting").textContent = `Hi, ${athleteName}`;
    const pact = state.pact;
    const own = pact?.progress?.find(person => person.userId === athleteId);
    $("#preview-week-summary").innerHTML = pact?.status === "active" && own
        ? html`<article class="preview-card"><h4>${formatDate(pact.startDate)} – ${formatDate(pact.endDate)}</h4>${renderRequirements(own.requirements)}<a href="preview-layout.html?tab=pacts">Open weekly Pact →</a></article>`
        : html`<article class="preview-empty"><h4>No active weekly Pact</h4><a href="create-pact.html">+ Create weekly Pact</a></article>`;
    const month = state.month;
    $("#preview-month-summary").innerHTML = month
        ? html`<article class="preview-card"><h4>${escapeHtml(month.monthLabel)}</h4><p>${escapeHtml(month.status === "completed" ? "Pact complete" : month.status === "active" ? "In progress" : "Upcoming")}</p><a href="preview-layout.html?tab=pacts&view=monthly">Open monthly Pact →</a></article>`
        : html`<article class="preview-empty"><h4>No Month Pact</h4><a href="dashboard.html?tab=month">+ Create Month Pact</a></article>`;
    const reminder = pact?.status === "active" ? `Weekly Pact ends ${formatDate(pact.endDate)}.` : month?.status === "active" ? `Month Pact ends ${formatDate(month.monthEnd)}.` : "";
    $("#preview-reminders").innerHTML = reminder ? `<div class="preview-reminder">${escapeHtml(reminder)}</div>` : "";
}

function renderActivity() {
    const container = $("#preview-activity");
    if (!state.workouts.length) { container.innerHTML = '<article class="preview-empty"><h4>No activity yet</h4><a href="dashboard.html?action=workout">+ Log workout</a></article>'; return; }
    container.innerHTML = "";
    state.workouts.forEach(workout => {
        const card = document.createElement("article");
        const muscles = (() => { try { return JSON.parse(workout.muscles).join(" · "); } catch { return workout.muscles || "Workout"; } })();
        const detail = [workout.activity_name || muscles, ...measurements(workout)].join(" · ");
        card.className = "preview-activity-card";
        card.innerHTML = html`<div><strong>${escapeHtml(workout.athlete_name || "Athlete")}</strong><h3>${escapeHtml(detail)}</h3><p class="preview-activity-meta">${escapeHtml(formatLoggedAt(workout.logged_at))}</p>${workout.notes ? `<p class="preview-activity-meta">${escapeHtml(workout.notes)}</p>` : ""}</div>`;
        if (workout.photo_url) { const image = new Image(); image.className = "preview-photo"; image.src = workout.photo_url; image.alt = "Workout proof"; image.addEventListener("click", () => openPhoto(image.src)); card.appendChild(image); }
        container.appendChild(card);
    });
}

function renderProgress() {
    const pactContainer = $("#preview-pact-progress");
    pactContainer.innerHTML = state.pact?.status === "active" ? state.pact.progress.map(person => html`<article class="preview-progress-person"><h4>${escapeHtml(person.displayName)}</h4>${renderRequirements(person.requirements)}</article>`).join("") : '<article class="preview-empty"><h4>No active Pact</h4><a href="create-pact.html">+ Create weekly Pact</a></article>';
    const trackerContainer = $("#preview-trackers");
    trackerContainer.innerHTML = state.trackers.length ? state.trackers.map(tracker => {
        const steps = tracker.exerciseName === "Steps";
        const total = steps ? tracker.totalSteps : tracker.totalReps;
        const target = steps ? tracker.targetSteps : tracker.targetReps;
        return html`<article class="preview-tracker"><div class="preview-tracker-head"><div><h4>${escapeHtml(tracker.exerciseName)}</h4><p>${Number(total || 0).toLocaleString()} / ${Number(target || 0).toLocaleString()} ${steps ? "steps" : "reps"}</p></div><a href="dashboard.html?tab=pact">${steps ? "Log steps" : "Log set"}</a></div><progress max="100" value="${target ? Math.min(100, total / target * 100) : 0}"></progress></article>`;
    }).join("") : '<article class="preview-empty"><h4>No tracker</h4><a href="dashboard.html?tab=pact">+ Add tracker</a></article>';
    const ownWorkouts = state.workouts.filter(workout => workout.user_id === athleteId);
    const weeklyGoal = state.pact?.requirements?.find(item => item.type === "workouts")?.targetAmount;
    const streak = weeklyWorkoutStreak(ownWorkouts, weeklyGoal);
    $("#preview-lifetime").innerHTML = html`<div class="preview-stat"><span>Lifetime workouts</span><strong>${ownWorkouts.length}</strong></div><div class="preview-stat"><span>Successful weeks</span><strong>${weeklyGoal ? `${streak} ${streak === 1 ? "week" : "weeks"}` : "—"}</strong></div>`;
}

function renderPacts() {
    const pact = state.pact;
    $("#preview-weekly-pact").innerHTML = pact ? html`<article class="preview-card"><h3>${pact.status === "active" ? "Active weekly Pact" : "Weekly Pact"}</h3><p>${formatDate(pact.startDate)} – ${formatDate(pact.endDate)}</p>${pact.progress ? pact.progress.map(person => `<h4>${escapeHtml(person.displayName)}</h4>${renderRequirements(person.requirements)}`).join("") : renderRequirements(pact.requirements)}<p><strong>Consequence</strong><br>${escapeHtml(pact.wagerDescription || "—")}</p></article>` : '<article class="preview-empty"><h4>No weekly Pact</h4><a href="create-pact.html">+ Create weekly Pact</a></article>';
    const month = state.month;
    $("#preview-monthly-pact").innerHTML = month ? html`<article class="preview-card"><h3>${escapeHtml(month.monthLabel)}</h3><p>${escapeHtml(month.status)}</p>${(month.commitments || []).map(commitment => `<div class="preview-requirement"><span>${escapeHtml(commitment.displayName || "Athlete")}</span><strong>${commitment.completedAt ? "✓ Achieved" : "In progress"}</strong><span>${escapeHtml(commitment.goal)}</span></div>`).join("")}<p><strong>Shared consequence</strong><br>${escapeHtml(month.consequence)}</p><a href="dashboard.html?tab=month">Open calendar & check-ins →</a></article>` : '<article class="preview-empty"><h4>No Month Pact</h4><a href="dashboard.html?tab=month">+ Create Month Pact</a></article>';
}

function openPhoto(src) { const dialog = $("#preview-photo-dialog"); dialog.querySelector("img").src = src; dialog.showModal(); }
$("#preview-photo-dialog button").addEventListener("click", () => $("#preview-photo-dialog").close());
$("#preview-photo-dialog").addEventListener("click", event => { if (event.target === $("#preview-photo-dialog")) event.currentTarget.close(); });

function showTab(tab) {
    document.querySelectorAll("[data-preview-screen]").forEach(screen => { const active = screen.dataset.previewScreen === tab; screen.hidden = !active; screen.classList.toggle("is-active", active); });
    document.querySelectorAll("[data-preview-tab]").forEach(button => button.classList.toggle("is-active", button.dataset.previewTab === tab));
    $("#preview-main").scrollTo?.({ top: 0, behavior: "instant" });
}

document.querySelectorAll("[data-preview-tab]").forEach(button => button.addEventListener("click", () => showTab(button.dataset.previewTab)));
document.querySelectorAll("[data-pact-view]").forEach(button => button.addEventListener("click", () => { document.querySelectorAll("[data-pact-view]").forEach(item => item.classList.toggle("is-active", item === button)); $("#preview-weekly-pact").hidden = button.dataset.pactView !== "weekly"; $("#preview-monthly-pact").hidden = button.dataset.pactView !== "monthly"; }));

async function loadPreview() {
    const supabase = GymPactSupabase.getClient();
    const [pactResult, workoutResult, trackerResult, monthResult] = await Promise.all([
        supabase.functions.invoke("get-current-pact", { body: { sessionToken: token } }),
        supabase.functions.invoke("list-workouts", { body: { sessionToken: token } }),
        supabase.functions.invoke("get-exercise-progress", { body: { sessionToken: token, userId: athleteId } }),
        supabase.functions.invoke("monthly-pacts", { body: { action: "get", sessionToken: token } })
    ]);
    state.pact = pactResult.data?.pact || null;
    state.workouts = Array.isArray(workoutResult.data?.workouts) ? workoutResult.data.workouts : [];
    state.trackers = [...(trackerResult.data?.trackers || []), ...(trackerResult.data?.stepTracker ? [trackerResult.data.stepTracker] : [])];
    state.month = monthResult.data?.pact || null;
    renderHome(); renderActivity(); renderProgress(); renderPacts();
}

loadPreview().catch(error => { console.error("Unable to load preview layout", error); document.querySelectorAll(".preview-screen").forEach(screen => { if (!screen.hidden) screen.insertAdjacentHTML("beforeend", '<p class="preview-reminder">Couldn’t load current data. Your original layout remains available.</p>'); }); });
const params = new URLSearchParams(location.search); showTab(["activity", "progress", "pacts"].includes(params.get("tab")) ? params.get("tab") : "home");
if (params.get("view") === "monthly") document.querySelector('[data-pact-view="monthly"]').click();
