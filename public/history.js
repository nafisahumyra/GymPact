const historyContainer =
    document.getElementById("workout-history");


const challengeHistoryContainer =
    document.getElementById("challenge-history");

const historyLoadFeedback =
    document.getElementById("history-load-feedback");
const backToPactButton =
    document.getElementById("back-to-pact");
const historyPageTitle =
    document.getElementById("history-page-title");
const requestedHistoryView = new URLSearchParams(window.location.search).get("view");
const activeHistoryTab = requestedHistoryView === "pacts" ? "challenges" : "workouts";
let activePactHistory = new URLSearchParams(window.location.search).get("category") === "monthly" ? "monthly" : "weekly";
const pactHistoryTabs = document.getElementById("pact-history-tabs");
const weeklyPactHistoryTab = document.getElementById("weekly-pact-history-tab");
const monthlyPactHistoryTab = document.getElementById("monthly-pact-history-tab");
const historyPhotoDialog = document.getElementById("history-photo-dialog");
const historyPhotoFull = document.getElementById("history-photo-full");
const closeHistoryPhotoButton = document.getElementById("close-history-photo");
const historyQuickActionToggle = document.getElementById("history-quick-action-toggle");
const historyQuickActionMenu = document.getElementById("history-quick-action-menu");
const historyQuickActionBackdrop = document.getElementById("history-quick-action-backdrop");
let historyRefreshInFlight = null;
let historyQuickActionPreviousFocus = null;

historyPageTitle.textContent = activeHistoryTab === "challenges" ? "Pact History" : "Workout History";
document.title = `GymPact ${historyPageTitle.textContent}`;
const historyNavigationTarget = activeHistoryTab === "challenges" ? "pact" : "activity";
document.querySelector(`[data-history-nav="${historyNavigationTarget}"]`)?.classList.add("is-active");
document.querySelector(`[data-history-nav="${historyNavigationTarget}"]`)?.setAttribute("aria-current", "page");

function closeHistoryQuickActionMenu({ restoreFocus = false } = {}) {

    historyQuickActionMenu.hidden = true;
    historyQuickActionBackdrop.hidden = true;
    historyQuickActionToggle.setAttribute("aria-expanded", "false");
    historyQuickActionToggle.setAttribute("aria-label", "Open quick actions");

    if (restoreFocus && historyQuickActionPreviousFocus instanceof HTMLElement) {
        historyQuickActionPreviousFocus.focus();
    }

    historyQuickActionPreviousFocus = null;

}

function openHistoryQuickActionMenu() {

    historyQuickActionPreviousFocus = document.activeElement;
    historyQuickActionMenu.hidden = false;
    historyQuickActionBackdrop.hidden = false;
    historyQuickActionToggle.setAttribute("aria-expanded", "true");
    historyQuickActionToggle.setAttribute("aria-label", "Close quick actions");
    historyQuickActionMenu.querySelector("button")?.focus();

}

historyQuickActionToggle.addEventListener("click", () => {

    if (historyQuickActionMenu.hidden) openHistoryQuickActionMenu();
    else closeHistoryQuickActionMenu({ restoreFocus: true });

});

historyQuickActionBackdrop.addEventListener("click", () => closeHistoryQuickActionMenu({ restoreFocus: true }));

document.querySelectorAll("[data-history-quick-action]").forEach(button => {

    button.addEventListener("click", () => {

        const action = button.dataset.historyQuickAction;
        const destinations = {
            exercise: "dashboard.html?quickAction=exercise",
            tracker: "dashboard.html?tab=track&quickAction=tracker",
            "week-pact": "dashboard.html?tab=pact&quickAction=week-pact",
            "month-pact": "dashboard.html?tab=pact&quickAction=month-pact",
            "dev-view": "preview-layout.html"
        };

        window.location.href = destinations[action];

    });

});

document.addEventListener("keydown", event => {

    if (event.key === "Escape" && !historyQuickActionMenu.hidden) {
        event.preventDefault();
        closeHistoryQuickActionMenu({ restoreFocus: true });
    }

});

function openHistoryPhoto(photo) {
    historyPhotoFull.src = photo.src;
    historyPhotoFull.alt = photo.alt;
    historyPhotoDialog.showModal();
}

closeHistoryPhotoButton.addEventListener("click", () => historyPhotoDialog.close());
historyPhotoDialog.addEventListener("click", event => {
    if (event.target === historyPhotoDialog) historyPhotoDialog.close();
});


function renderEmptyState() {

    const emptyState = document.createElement("div");
    const message = document.createElement("p");
    const description = document.createElement("p");
    const logWorkoutButton = document.createElement("button");

    emptyState.classList.add("history-empty-state");
    message.textContent = "No workouts logged yet.";
    description.textContent =
        "Log your first workout to start building your history.";
    logWorkoutButton.textContent = "+ Log Workout";

    logWorkoutButton.addEventListener("click", () => {

        window.location.href = "dashboard.html";

    });

    historyContainer.innerHTML = "";
    emptyState.append(message, description, logWorkoutButton);
    historyContainer.appendChild(emptyState);

}


function parseMuscles(muscles) {

    try {

        const parsedMuscles = JSON.parse(muscles);

        if (Array.isArray(parsedMuscles)) {

            return parsedMuscles;

        }

    } catch {

        return muscles.split(", ");

    }

    return [muscles];

}


function getWorkoutMeasurements(workout) {

    if (Array.isArray(workout.measurements) && workout.measurements.length > 0) {

        return workout.measurements.filter(measurement => {

            return (
                measurement &&
                typeof measurement.amount === "number" &&
                measurement.amount > 0 &&
                ["minutes", "reps", "sets", "miles", "steps"].includes(measurement.unit)
            );

        });

    }

    if (Number(workout.duration_minutes) > 0) {

        return [{
            amount: Number(workout.duration_minutes),
            unit: "minutes"
        }];

    }

    return [];

}


function formatMeasurement(measurement) {

    return `${measurement.amount} ${measurement.unit}`;

}


async function renderWorkoutHistory({ preserveOnError = false } = {}) {

    const sessionToken = sessionStorage.getItem("gymPactSessionToken");

    if (!sessionToken) {

        renderEmptyState();

        return;

    }

    const supabase = GymPactSupabase.getClient();
    const { data, error } = await supabase.functions.invoke(
        "list-workouts",
        { body: { sessionToken } }
    );

    if (error || !data?.workouts) {

        console.error("Unable to load workout history.", error);

        if (preserveOnError) {

            throw error || new Error("Workout history was unavailable.");

        }

        renderEmptyState();

        return;

    }

    if (data.workouts.length === 0) {

        renderEmptyState();

        return;

    }

    historyContainer.innerHTML = "";

    data.workouts.forEach(workout => {

        const muscles = parseMuscles(workout.muscles);
        const activityName = workout.activity_name || muscles.join(" • ");
        const measurements = getWorkoutMeasurements(workout);
        const card = document.createElement("div");

        card.classList.add("workout-card");
        card.innerHTML = `

            <h3>
                🏋️ ${workout.athlete_name}
            </h3>

            <p>${[activityName, ...measurements.map(formatMeasurement)].join(" · ")}</p>

            <p>
                📅 ${new Date(workout.logged_at).toLocaleString()}
            </p>


            ${
                workout.notes
                ? `<p>📝 ${workout.notes}</p>`
                : ""
            }

        `;

        if (workout.photo_url) {

            const photo = document.createElement("img");

            photo.classList.add("workout-history-photo");
            photo.src = workout.photo_url;
            photo.alt = `Workout proof for ${activityName}`;
            photo.tabIndex = 0;
            photo.setAttribute("role", "button");
            photo.setAttribute("aria-label", `Open proof photo for ${activityName}`);
            photo.addEventListener("click", () => openHistoryPhoto(photo));
            photo.addEventListener("keydown", event => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openHistoryPhoto(photo);
                }
            });

            card.appendChild(photo);

        }

        historyContainer.appendChild(card);

    });

}


function formatDateRange(startDate, endDate) {

    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);
    const sameYear = start.getFullYear() === end.getFullYear();
    const sameMonth = sameYear && start.getMonth() === end.getMonth();
    const shortMonth = new Intl.DateTimeFormat(undefined, { month: "short" });
    const year = new Intl.DateTimeFormat(undefined, { year: "numeric" });

    if (sameMonth) {
        return `${shortMonth.format(start)} ${start.getDate()} – ${end.getDate()}, ${year.format(end)}`;
    }

    if (sameYear) {
        return `${shortMonth.format(start)} ${start.getDate()} – ${shortMonth.format(end)} ${end.getDate()}, ${year.format(end)}`;
    }

    return `${shortMonth.format(start)} ${start.getDate()}, ${year.format(start)} – ${shortMonth.format(end)} ${end.getDate()}, ${year.format(end)}`;

}

function getRequirementDetails(type) {

    const requirements = {
        workouts: { label: "Workouts", icon: "assets/gp-images/Workout.png" },
        hiit: { label: "HIIT", icon: "assets/gp-images/HIIT.png" },
        steps: { label: "Steps", icon: "assets/gp-images/steps.png" }
    };

    return requirements[type] || {
        label: String(type || "Requirement").replace(/\b\w/g, letter => letter.toUpperCase()),
        icon: null
    };

}

function sortRequirementsForDisplay(requirements) {

    const order = { hiit: 0, steps: 1, workouts: 2 };

    return [...requirements].sort((first, second) => {

        return (order[first.type] ?? 99) - (order[second.type] ?? 99);

    });

}

function createRequirementScore(requirement) {

    const row = document.createElement("div");
    const label = document.createElement("div");
    const identity = document.createElement("span");
    const text = document.createElement("span");
    const score = document.createElement("span");
    const details = getRequirementDetails(requirement.type);

    row.classList.add("pact-requirement", "pact-history-requirement");
    label.classList.add("pact-requirement-label");
    identity.classList.add("pact-history-requirement-identity");
    if (details.icon) {
        const icon = document.createElement("img");
        icon.className = "pact-history-requirement-icon";
        icon.src = details.icon;
        icon.alt = "";
        identity.appendChild(icon);
    }
    text.textContent = details.label;
    score.textContent = `${Number(requirement.completed || 0).toLocaleString()} / ${Number(requirement.targetAmount || 0).toLocaleString()}`;
    identity.appendChild(text);
    label.append(identity, score);
    row.appendChild(label);
    return row;

}


function getChallengeResultText(challenge) {

    if (challenge.result === "winner") {

        return `${challenge.winnerName} won`;

    }

    if (challenge.result === "both_completed") {

        return "Both completed";

    }

    return "Both failed";

}


function renderEmptyChallengeState() {

    challengeHistoryContainer.innerHTML = `
        <div class="history-empty-state">
            <p>No completed Pacts yet.</p>
            <p>Finish a Pact to see its final score here.</p>
        </div>
    `;

}

function renderEmptyMonthlyPactState() {
    challengeHistoryContainer.innerHTML = `
        <div class="history-empty-state month-history-empty-state">
            <p>No Month Pacts yet</p>
        </div>
    `;
}

function renderMonthlyPactHistoryError() {
    challengeHistoryContainer.innerHTML = `<div class="history-empty-state"><p>We couldn’t load Month Pact History.</p><p>Your completed Month Pacts will appear here when the connection is available.</p></div>`;
}

function createHistoryStatus(successful, label, { iconOnly = false } = {}) {

    const result = document.createElement("span");
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");

    result.className = `pact-history-status ${successful ? "is-success" : "is-unsuccessful"}${iconOnly ? " is-icon-only" : ""}`;
    if (iconOnly) result.setAttribute("aria-label", label);
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("fill", "none");
    icon.setAttribute("stroke", "currentColor");
    icon.setAttribute("stroke-width", "2.5");
    icon.setAttribute("stroke-linecap", "round");
    icon.setAttribute("stroke-linejoin", "round");
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = successful
        ? '<path d="m5 12 4.2 4.2L19 6.5"></path>'
        : '<path d="m7 7 10 10M17 7 7 17"></path>';
    result.append(icon);
    if (!iconOnly) result.append(document.createTextNode(label));
    return result;

}

function createPactHistoryHeader(titleText, successful, statusText) {

    const header = document.createElement("header");
    const title = document.createElement("h3");

    header.className = "pact-history-card-header";
    title.textContent = titleText;
    header.append(title, createHistoryStatus(successful, statusText));
    return header;

}

function createPactHistoryParticipant(nameText, outcome, { outcomeBeforeName = false } = {}) {

    const participant = document.createElement("section");
    const header = document.createElement("div");
    const name = document.createElement("h4");

    participant.className = "pact-history-participant";
    header.className = "pact-history-participant-header";
    name.textContent = nameText;
    if (outcomeBeforeName && outcome) header.appendChild(outcome);
    header.appendChild(name);
    if (!outcomeBeforeName && outcome) header.appendChild(outcome);
    participant.appendChild(header);
    return participant;

}

function createMonthlyHistoryCard(pact) {

    const card = document.createElement("article");
    const people = document.createElement("div");
    const commitments = new Map((pact.commitments || []).map(item => [item.userId, item]));
    const participants = (pact.participants?.length ? pact.participants : pact.commitments || []);
    const complete = participants.length === 2 && participants.every(participant => {

        return Boolean(commitments.get(participant.userId)?.completedByDeadline);

    });

    card.className = "challenge-history-card pact-history-card monthly-history-card";
    people.className = "pact-history-participants monthly-history-people";

    participants.forEach(participant => {

        const commitment = commitments.get(participant.userId);
        const goal = document.createElement("p");
        const achieved = Boolean(commitment?.completedByDeadline);

        const person = createPactHistoryParticipant(
            participant.displayName,
            createHistoryStatus(achieved, achieved ? "Achieved" : "Failed", { iconOnly: true }),
            { outcomeBeforeName: true }
        );
        goal.className = "pact-history-goal";
        goal.textContent = commitment?.goal || "No goal submitted";
        person.appendChild(goal);
        people.appendChild(person);

    });

    card.append(createPactHistoryHeader(pact.monthLabel, complete, complete ? "Completed" : "Incomplete"), people);
    return card;

}

async function renderMonthlyPactHistory({ preserveOnError = false } = {}) {
    const sessionToken = sessionStorage.getItem("gymPactSessionToken");
    if (!sessionToken) { renderEmptyMonthlyPactState(); return; }

    // Clear the previous category before loading so weekly cards can never be
    // mistaken for Month Pact history while this request is in flight.
    challengeHistoryContainer.innerHTML = "";

    const { data, error } = await GymPactSupabase.getClient().functions.invoke("monthly-pacts", { body: { action: "list", sessionToken, dataEnvironment: "production" } });
    if (error || !Array.isArray(data?.pacts)) {
        console.error("Unable to load Month Pact history.", error);
        renderMonthlyPactHistoryError();
        return;
    }
    if (!data.pacts.length) { renderEmptyMonthlyPactState(); return; }
    challengeHistoryContainer.innerHTML = "";
    data.pacts.forEach(pact => challengeHistoryContainer.appendChild(createMonthlyHistoryCard(pact)));
}


async function renderChallengeHistory({ preserveOnError = false } = {}) {

    const sessionToken = sessionStorage.getItem("gymPactSessionToken");

    if (!sessionToken) {

        renderEmptyChallengeState();

        return;

    }

    const supabase = GymPactSupabase.getClient();
    const { data, error } = await supabase.functions.invoke(
        "list-completed-pacts",
        { body: { sessionToken } }
    );

    if (error || !Array.isArray(data?.pacts)) {

        console.error("Unable to load Pact history.", error);

        if (preserveOnError) {

            throw error || new Error("Pact history was unavailable.");

        }

        renderEmptyChallengeState();

        return;

    }

    if (data.pacts.length === 0) {

        renderEmptyChallengeState();

        return;

    }

    challengeHistoryContainer.innerHTML = "";

    data.pacts.forEach(challenge => {

        const card = document.createElement("article");
        const people = document.createElement("div");
        const wagerHeading = document.createElement("h4");
        const wager = document.createElement("p");
        const wagerType = document.createElement("p");
        const resultText = getChallengeResultText(challenge);
        const successful = challenge.result !== "both_failed";

        card.classList.add("challenge-history-card", "pact-history-card", "weekly-history-card");
        people.className = "pact-history-participants";
        wagerHeading.textContent = "Wager";
        wagerHeading.className = "pact-history-section-label";
        wager.textContent = challenge.wagerDescription;
        wager.className = "pact-history-wager-description";
        if (challenge.wagerType) {
            wagerType.className = "pact-history-wager-type";
            wagerType.textContent = challenge.wagerType === "reward" ? "Reward" : "Punishment";
        }

        challenge.participants.forEach(participant => {

            const score = createPactHistoryParticipant(participant.displayName);
            sortRequirementsForDisplay(participant.requirements || []).forEach(requirement => {
                score.appendChild(createRequirementScore(requirement));
            });
            people.appendChild(score);

        });

        const wagerSection = document.createElement("section");
        wagerSection.className = "pact-history-wager";
        wagerSection.append(wagerHeading);
        if (challenge.wagerType) wagerSection.appendChild(wagerType);
        wagerSection.appendChild(wager);
        card.append(
            createPactHistoryHeader(
                formatDateRange(challenge.startDate, challenge.endDate),
                successful,
                resultText
            ),
            people,
            wagerSection
        );
        challengeHistoryContainer.appendChild(card);

    });

}


function showHistoryTab(tab) {

    const showWorkouts = tab === "workouts";

    historyContainer.hidden = !showWorkouts;
    challengeHistoryContainer.hidden = showWorkouts;
    pactHistoryTabs.hidden = showWorkouts;
    weeklyPactHistoryTab.classList.toggle("is-active", activePactHistory === "weekly");
    monthlyPactHistoryTab.classList.toggle("is-active", activePactHistory === "monthly");

}


function setHistoryRefreshFeedback(message = "") {

    historyLoadFeedback.textContent = message;
    historyLoadFeedback.hidden = !message;

}


async function refreshHistory() {

    if (historyRefreshInFlight) {

        return historyRefreshInFlight;

    }

    historyRefreshInFlight = (async () => {

        setHistoryRefreshFeedback();

        try {

            if (activeHistoryTab === "workouts") {

                await renderWorkoutHistory({ preserveOnError: true });

            } else if (activePactHistory === "monthly") {

                await renderMonthlyPactHistory({ preserveOnError: true });

            } else {

                await renderChallengeHistory({ preserveOnError: true });

            }

        } catch (error) {

            console.error("Unable to refresh history.", error);
            setHistoryRefreshFeedback(
                "Couldn't refresh right now. Your current history is still shown."
            );

        } finally {

        }

    })();

    try {

        await historyRefreshInFlight;

    } finally {

        historyRefreshInFlight = null;

    }

}


backToPactButton.addEventListener("click", () => {

    window.location.href = "dashboard.html";

});

weeklyPactHistoryTab.addEventListener("click", () => { activePactHistory = "weekly"; showHistoryTab("challenges"); refreshHistory(); });
monthlyPactHistoryTab.addEventListener("click", () => { activePactHistory = "monthly"; showHistoryTab("challenges"); refreshHistory(); });

document.addEventListener("visibilitychange", () => {

    if (document.visibilityState === "visible") {

        refreshHistory();

    }

});


showHistoryTab(activeHistoryTab);
refreshHistory();
