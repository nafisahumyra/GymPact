const currentUser = localStorage.getItem("currentUser") || "Athlete";

// Welcome message

const welcomeMessage = document.getElementById("welcome-message");
welcomeMessage.textContent =
    `Welcome back, ${currentUser}!`;





let currentChallenge = null;
let currentChallengeLoaded = false;
let currentChallengeLoadError = false;
let progressSelectedRequirementType = null;
let progressDayParticipantId = null;
let progressSelectedDay = null;
const PROGRESS_RUNNER_ASSETS_BY_ID = Object.freeze({
    "4a1a21a1-0000-4000-8000-000000000001": "assets/progress-runners/nafisa-runner-sheet.png",
    "4a1a21a1-0000-4000-8000-000000000002": "assets/progress-runners/mahfuzur-runner-sheet.png"
});
const PROGRESS_RACE_STATE_PREFIX = "gymPactProgressRace:";
const progressRunnerSprites = new Map();
const progressRunnerLoads = new Map();
const progressRunnerAnimationFrames = new Set();
const currentChallengeContainer =
    document.getElementById("current-challenge");
const workoutCount =
    document.getElementById("workout-count");
const streakCount =
    document.getElementById("streak-count");
const dashboardRefreshButton =
    document.getElementById("dashboard-refresh");
const dashboardRefreshFeedback =
    document.getElementById("dashboard-refresh-feedback");
const dashboardTabs = document.querySelectorAll(".dashboard-tab");
const dashboardTabContent = document.querySelectorAll("[data-dashboard-tab-content]");
const quickActionToggle = document.getElementById("quick-action-toggle");
const quickActionMenu = document.getElementById("quick-action-menu");
const quickActionBackdrop = document.getElementById("quick-action-backdrop");
const quickExerciseModal = document.getElementById("quick-exercise-modal");
const quickExerciseTitle = document.getElementById("quick-exercise-title");
const quickExerciseOptions = document.getElementById("quick-exercise-options");
const cancelQuickExerciseButton = document.getElementById("cancel-quick-exercise");
const activityWorkoutsContainer = document.getElementById("activity-workouts");
const progressRaceContainer = document.getElementById("progress-race");
const activityPhotoDialog = document.getElementById("activity-photo-dialog");
const activityPhotoFull = document.getElementById("activity-photo-full");
const closeActivityPhotoButton = document.getElementById("close-activity-photo");
const editWorkoutModal = document.getElementById("edit-workout-modal");
const editWorkoutDateTime = document.getElementById("edit-workout-date-time");
const editWorkoutMuscles = document.getElementById("edit-workout-muscles");
const editWorkoutMeasurements = document.getElementById("edit-workout-measurements");
const editWorkoutNotes = document.getElementById("edit-workout-notes");
const editWorkoutError = document.getElementById("edit-workout-error");
const cancelEditWorkoutButton = document.getElementById("cancel-edit-workout");
const saveEditWorkoutButton = document.getElementById("save-edit-workout");
const profileMenuButton = document.getElementById("profile-menu-button");
const profileMenuInitials = document.getElementById("profile-menu-initials");
const profileMenuImage = document.getElementById("profile-menu-image");
const profileActionsMenu = document.getElementById("profile-actions-menu");
const openProfilePageButton = document.getElementById("open-profile-page");
const openProfileHistoryButton = document.getElementById("open-profile-history");
const profilePage = document.getElementById("profile-page");
const closeProfilePageButton = document.getElementById("close-profile-page");
const profilePageInitials = document.getElementById("profile-page-initials");
const profilePageImage = document.getElementById("profile-page-image");
const profilePageForm = document.getElementById("profile-page-form");
const profileDisplayNameInput = document.getElementById("profile-display-name");
const profilePageError = document.getElementById("profile-page-error");
const openProfilePhotoButton = document.getElementById("open-profile-photo");
const profilePhotoInput = document.getElementById("profile-photo-input");
const clearProfilePhotoButton = document.getElementById("clear-profile-photo");
const saveProfileChangesButton = document.getElementById("save-profile-changes");
const ACTIVITY_MUSCLES = ["Abs", "Back", "Biceps", "Boxing", "Cardio", "Chest", "HIIT", "Legs", "Pullups", "Pushups", "Shoulders", "Triceps"];
const ACTIVITY_PAGE_SIZE = 10;
let activityWorkouts = [];
let activityWorkoutsLoaded = false;
let activityWorkoutsLoading = false;
let activityHasMore = true;
let activityNextCursor = null;
let activityLoadError = false;
let activityLoadObserver = null;
let editingWorkout = null;
let profilePhotoUrl = null;
let profileDisplayName = currentUser;
let profileDraftPhoto = null;
let profileDraftPhotoUrl = "";
let profileDraftPhotoRemoved = false;
let monthlyCompletionBrandAssetsPromise = null;
let activeDashboardTab = "overview";
let dashboardRefreshInFlight = null;
const monthPactContent = document.getElementById("month-pact-content");
const pactMonthPactContent = document.getElementById("pact-month-pact-content");
const homeMonthPactContent = document.getElementById("home-month-pact");
let monthlyPact = null;
let monthlyCandidate = null;
let monthlyCheckinDate = null;
let monthlySelectedDate = null;
let monthlySelectedPactId = null;
let monthlyCheckinPopover = null;
let monthlyCheckinPopoverDismiss = null;
const exerciseTrackersContainer = document.getElementById("exercise-trackers");
const removeExerciseTrackerModal = document.getElementById("remove-exercise-tracker-modal");
const removeExerciseTrackerCopy = document.getElementById("remove-exercise-tracker-copy");
const keepExerciseTrackerButton = document.getElementById("keep-exercise-tracker");
const confirmRemoveExerciseTrackerButton = document.getElementById("confirm-remove-exercise-tracker");
const TRACKED_EXERCISES = ["Pushups", "Pullups"];
const EXERCISE_ICONS = {
    Pushups: "assets/gp-images/pushup.png",
    Pullups: "assets/gp-images/Pullup.png",
    Steps: "assets/gp-images/steps.png"
};
let exerciseTrackers = [];
let exerciseTrackersLoaded = false;
let pendingExerciseTrackerRemoval = null;


const GYMPACT_TIME_ZONE = "America/New_York";


function getCalendarDayInGymPactTimeZone(value = new Date()) {

    const date = value instanceof Date ? value : new Date(value);
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: GYMPACT_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));

    return `${values.year}-${values.month}-${values.day}`;

}


function addCalendarDays(date, days) {

    const value = new Date(`${date}T00:00:00.000Z`);

    value.setUTCDate(value.getUTCDate() + days);

    return value.toISOString().slice(0, 10);

}


function calculatePactStreak(weeklyPacts, monthlyPacts, athleteId) {

    const outcomes = [
        ...weeklyPacts.map(pact => ({
            completedAt: pact.completedAt,
            successful: pact.result === "both_completed" || (pact.result === "winner" && pact.winnerId === athleteId)
        })),
        ...monthlyPacts.map(pact => {

            const commitment = (pact.commitments || []).find(item => item.userId === athleteId);
            return {
                completedAt: pact.finalizedAt || `${pact.monthEnd}T23:59:59-05:00`,
                successful: Boolean(commitment?.completedByDeadline)
            };

        })
    ].filter(outcome => outcome.completedAt)
        .sort((left, right) => new Date(right.completedAt) - new Date(left.completedAt));

    let streak = 0;

    for (const outcome of outcomes) {

        if (!outcome.successful) break;
        streak += 1;

    }

    return streak;

}


async function loadDashboardMetrics({ preserveOnError = false } = {}) {

    const sessionToken = sessionStorage.getItem("gymPactSessionToken");
    const athleteId = sessionStorage.getItem("gymPactSelectedAthleteId");

    if (!sessionToken || !athleteId) {

        return;

    }

    try {

        const supabase = GymPactSupabase.getClient();
        const [workoutResponse, weeklyHistoryResponse, monthlyHistoryResponse] = await Promise.all([
            supabase.functions.invoke("list-workouts", { body: { sessionToken, dataEnvironment: "production" } }),
            supabase.functions.invoke("list-completed-pacts", { body: { sessionToken, dataEnvironment: "production" } }),
            supabase.functions.invoke("monthly-pacts", { body: { action: "list", sessionToken, dataEnvironment: "production" } })
        ]);
        const { data, error } = workoutResponse;

        if (error || !Array.isArray(data?.workouts)) {

            throw error || new Error("Workout data was unavailable.");

        }

        if (weeklyHistoryResponse.error || !Array.isArray(weeklyHistoryResponse.data?.pacts)) {

            throw weeklyHistoryResponse.error || new Error("Weekly Pact history was unavailable.");

        }

        if (monthlyHistoryResponse.error || !Array.isArray(monthlyHistoryResponse.data?.pacts)) {

            throw monthlyHistoryResponse.error || new Error("Month Pact history was unavailable.");

        }

        const athleteWorkouts = data.workouts.filter(workout => {

            return workout.user_id === athleteId;

        });
        const streak = calculatePactStreak(weeklyHistoryResponse.data.pacts, monthlyHistoryResponse.data.pacts, athleteId);

        workoutCount.textContent = athleteWorkouts.length;
        streakCount.textContent = `${streak} 🔥`;

    } catch (error) {

        console.error("Unable to load dashboard workout metrics.", error);
        streakCount.textContent = "Unavailable";

        if (preserveOnError) {

            throw error;

        }

    }

}


function getExerciseTracker(exerciseName) {

    return exerciseTrackers.find(tracker => {

        return tracker.exerciseName === exerciseName;

    }) || null;

}


function createExerciseIcon(exerciseName) {

    const image = document.createElement("img");

    image.src = EXERCISE_ICONS[exerciseName];
    image.alt = "";

    return image;

}

function closeExerciseTrackerMenus() {

    document.querySelectorAll(".exercise-tracker-menu").forEach(menu => {

        menu.hidden = true;
        menu.closest(".exercise-tracker-overflow")
            ?.querySelector(".exercise-tracker-overflow-button")
            ?.setAttribute("aria-expanded", "false");

    });

}

function getTrackerOrderStorageKey() {

    const athleteId = sessionStorage.getItem("gymPactSelectedAthleteId");

    return athleteId ? `gymPactTrackerOrder:production:${athleteId}` : null;

}

function getSavedTrackerOrder() {

    const key = getTrackerOrderStorageKey();

    if (!key) return [];

    try {

        const order = JSON.parse(localStorage.getItem(key) || "[]");

        return Array.isArray(order) ? order.filter(name => typeof name === "string") : [];

    } catch {

        return [];

    }

}

function sortExerciseTrackers(trackers) {

    const order = getSavedTrackerOrder();

    return [...trackers].sort((first, second) => {

        const firstPosition = order.indexOf(first.exerciseName);
        const secondPosition = order.indexOf(second.exerciseName);
        const normalizedFirst = firstPosition === -1 ? order.length : firstPosition;
        const normalizedSecond = secondPosition === -1 ? order.length : secondPosition;

        if (normalizedFirst !== normalizedSecond) return normalizedFirst - normalizedSecond;
        return first.exerciseName.localeCompare(second.exerciseName);

    });

}

function saveTrackerOrder(trackers = exerciseTrackers) {

    const key = getTrackerOrderStorageKey();

    if (!key) return;

    localStorage.setItem(key, JSON.stringify(trackers.map(tracker => tracker.exerciseName)));

}

function moveExerciseTracker(exerciseName, direction) {

    const index = exerciseTrackers.findIndex(tracker => tracker.exerciseName === exerciseName);
    const nextIndex = index + direction;

    if (index < 0 || nextIndex < 0 || nextIndex >= exerciseTrackers.length) return;

    [exerciseTrackers[index], exerciseTrackers[nextIndex]] = [exerciseTrackers[nextIndex], exerciseTrackers[index]];
    saveTrackerOrder();
    renderExerciseTrackers();

}


function renderExerciseTrackers() {

    const exerciseTrackingSection = exerciseTrackersContainer.closest(
        ".exercise-tracking-section"
    );

    exerciseTrackersContainer.innerHTML = "";

    if (exerciseTrackers.length === 0) {

        exerciseTrackingSection.hidden = activeDashboardTab !== "track";

        const emptyState = document.createElement("div");
        const message = document.createElement("p");
        const choices = document.createElement("div");

        emptyState.className = "exercise-tracker-empty";
        message.textContent = "Choose a tracker to get started.";
        choices.className = "exercise-tracker-setup-options";

        ["Steps", "Pullups", "Pushups"].forEach(exerciseName => {

            const choice = document.createElement("button");
            const identity = document.createElement("span");
            const copy = document.createElement("span");
            const label = document.createElement("strong");
            const detail = document.createElement("small");

            choice.type = "button";
            choice.className = "exercise-tracker-setup-option";
            identity.className = "exercise-tracker-setup-identity";
            copy.className = "exercise-tracker-setup-copy";
            label.textContent = `Add ${exerciseName} tracker`;
            detail.textContent = "Set a target to begin";
            identity.append(createExerciseIcon(exerciseName), copy);
            copy.append(label, detail);
            choice.append(identity);
            choice.addEventListener("click", () => openExerciseTargetModal(exerciseName));
            choices.appendChild(choice);

        });

        emptyState.append(message, choices);
        exerciseTrackersContainer.appendChild(emptyState);

        return;

    }

    exerciseTrackingSection.hidden = activeDashboardTab !== "track";

    exerciseTrackers.forEach((tracker, trackerIndex) => {

        const isStepsTracker = tracker.exerciseName === "Steps";
        const target = isStepsTracker ? tracker.targetSteps : tracker.targetReps;
        const total = isStepsTracker ? tracker.totalSteps : tracker.totalReps;
        const progress = Math.min((total / target) * 100, 100);

        const card = document.createElement("article");
        const header = document.createElement("div");
        const title = document.createElement("div");
        const heading = document.createElement("h4");
        const score = document.createElement("p");
        const bar = document.createElement("div");
        const fill = document.createElement("div");
        const marker = document.createElement("span");
        const actions = document.createElement("div");
        const overflow = document.createElement("div");
        const overflowButton = document.createElement("button");
        const overflowMenu = document.createElement("div");

        card.classList.add("exercise-tracker-card");
        if (tracker.status === "completed") {

            card.classList.add("is-completed");

        }

        header.classList.add("exercise-tracker-header");
        title.classList.add("exercise-tracker-title");
        heading.textContent = tracker.exerciseName;
        score.textContent = isStepsTracker
            ? `${total.toLocaleString()} / ${target.toLocaleString()} steps`
            : `${tracker.totalReps} / ${tracker.targetReps} reps · ${tracker.totalSets} ${tracker.totalSets === 1 ? "set" : "sets"}`;
        title.append(heading, score);
        header.appendChild(title);

        if (tracker.status === "completed") {

            const completed = document.createElement("span");

            completed.classList.add("exercise-tracker-complete");
            completed.textContent = isStepsTracker ? "✓ Requirement Complete" : "Complete";
            header.appendChild(completed);

        }

        overflow.classList.add("exercise-tracker-overflow");
        overflowButton.type = "button";
        overflowButton.classList.add("exercise-tracker-overflow-button");
        overflowButton.textContent = "•••";
        overflowButton.setAttribute("aria-label", `${tracker.exerciseName} tracker options`);
        overflowButton.setAttribute("aria-expanded", "false");
        overflowButton.addEventListener("click", () => {

            const isOpen = !overflowMenu.hidden;

            closeExerciseTrackerMenus();
            overflowMenu.hidden = isOpen;
            overflowButton.setAttribute("aria-expanded", String(!isOpen));

        });

        overflowMenu.classList.add("exercise-tracker-menu");
        overflowMenu.hidden = true;

        const changeTarget = document.createElement("button");
        const reset = document.createElement("button");
        const moveUp = document.createElement("button");
        const moveDown = document.createElement("button");
        const remove = document.createElement("button");

        changeTarget.type = "button";
        changeTarget.textContent = "Change target";
        changeTarget.addEventListener("click", () => {

            closeExerciseTrackerMenus();
            openExerciseTargetModal(tracker.exerciseName, target, false);

        });

        reset.type = "button";
        reset.textContent = "Reset";
        reset.addEventListener("click", () => {

            closeExerciseTrackerMenus();
            resetExerciseTracker(tracker);

        });

        moveUp.type = "button";
        moveUp.textContent = "Move up";
        moveUp.disabled = trackerIndex === 0;
        moveUp.addEventListener("click", () => {

            closeExerciseTrackerMenus();
            moveExerciseTracker(tracker.exerciseName, -1);

        });

        moveDown.type = "button";
        moveDown.textContent = "Move down";
        moveDown.disabled = trackerIndex === exerciseTrackers.length - 1;
        moveDown.addEventListener("click", () => {

            closeExerciseTrackerMenus();
            moveExerciseTracker(tracker.exerciseName, 1);

        });

        remove.type = "button";
        remove.classList.add("is-destructive");
        remove.textContent = "Remove tracker";
        remove.addEventListener("click", () => {

            closeExerciseTrackerMenus();
            openRemoveExerciseTrackerModal(tracker);

        });

        overflowMenu.append(changeTarget, reset, moveUp, moveDown, remove);
        overflow.append(overflowButton, overflowMenu);
        header.appendChild(overflow);

        bar.classList.add("exercise-progress-bar");
        if (isStepsTracker) {

            bar.classList.add("steps-progress-bar");

            for (let index = 1; index <= 7; index += 1) {

                const checkpoint = document.createElement("span");
                const checkpointProgress = (index / 7) * 100;

                checkpoint.classList.add("steps-progress-checkpoint");
                if (progress >= checkpointProgress) {

                    checkpoint.classList.add("is-passed");

                }
                checkpoint.style.left = `${checkpointProgress}%`;
                bar.appendChild(checkpoint);

            }

        }
        bar.style.setProperty("--progress", `${progress}%`);
        fill.classList.add("exercise-progress-fill");
        marker.classList.add("exercise-progress-marker");
        marker.appendChild(createExerciseIcon(tracker.exerciseName));
        bar.append(fill, marker);

        actions.classList.add("exercise-tracker-actions");

        if (tracker.status === "active") {

            const logSet = document.createElement("button");

            logSet.type = "button";
            logSet.textContent = isStepsTracker ? "+ Log Steps" : "+ Log Set";
            logSet.addEventListener("click", () => {

                openExerciseSetModal(tracker.exerciseName);

            });
            actions.appendChild(logSet);

        } else if (!isStepsTracker) {

            const logWorkout = document.createElement("button");

            logWorkout.type = "button";
            logWorkout.textContent = "Log Workout";
            logWorkout.addEventListener("click", () => {

                openCompletedExerciseWorkout(tracker.exerciseName);

            });
            actions.appendChild(logWorkout);

        }

        card.append(header, bar);
        if (actions.childElementCount) card.appendChild(actions);
        exerciseTrackersContainer.appendChild(card);

    });

}

document.addEventListener("click", event => {

    if (!event.target.closest(".exercise-tracker-overflow")) {

        closeExerciseTrackerMenus();

    }

});

document.addEventListener("keydown", event => {

    if (event.key === "Escape") closeExerciseTrackerMenus();

});


function closeRemoveExerciseTrackerModal() {

    pendingExerciseTrackerRemoval = null;
    removeExerciseTrackerModal.style.display = "none";

}


function openRemoveExerciseTrackerModal(tracker) {

    pendingExerciseTrackerRemoval = tracker;
    removeExerciseTrackerCopy.textContent = tracker.exerciseName === "Steps"
        ? "Remove your Steps target and logged steps? You can start a new target later from Add Workout."
        : `Remove your ${tracker.exerciseName} target and ${tracker.totalSets} logged ${tracker.totalSets === 1 ? "set" : "sets"}? You can start a new target later from Add Workout.`;
    removeExerciseTrackerModal.style.display = "flex";

}


async function removeExerciseTracker() {

    const tracker = pendingExerciseTrackerRemoval;
    const sessionToken = sessionStorage.getItem("gymPactSessionToken");
    const athleteId = sessionStorage.getItem("gymPactSelectedAthleteId");

    if (!tracker || !sessionToken || !athleteId) {

        return;

    }

    confirmRemoveExerciseTrackerButton.disabled = true;

    try {

        const supabase = GymPactSupabase.getClient();
        const { data, error } = await supabase.functions.invoke(
            tracker.exerciseName === "Steps" ? "remove-step-tracker" : "remove-exercise-goal",
            { body: { sessionToken, userId: athleteId, exerciseName: tracker.exerciseName } }
        );

        if (error || !data?.removed) {

            throw error || new Error("Exercise tracker was not removed.");

        }

        exerciseTrackers = exerciseTrackers.filter(item => item.id !== tracker.id);
        renderExerciseTrackers();
        closeRemoveExerciseTrackerModal();

    } catch (error) {

        console.error("Unable to remove exercise tracker.", error);
        removeExerciseTrackerCopy.textContent = "We couldn't remove that tracker. Please try again.";

    } finally {

        confirmRemoveExerciseTrackerButton.disabled = false;

    }

}


async function loadExerciseTrackers({ preserveOnError = false } = {}) {

    const sessionToken = sessionStorage.getItem("gymPactSessionToken");
    const athleteId = sessionStorage.getItem("gymPactSelectedAthleteId");

    if (!sessionToken || !athleteId) {

        exerciseTrackers = [];
        exerciseTrackersLoaded = true;
        renderExerciseTrackers();

        return;

    }

    try {

        const supabase = GymPactSupabase.getClient();
        const { data, error } = await supabase.functions.invoke(
            "get-exercise-progress",
            { body: { sessionToken, userId: athleteId } }
        );

        if (error || !Array.isArray(data?.trackers)) {

            throw error || new Error("Exercise progress was unavailable.");

        }

        exerciseTrackers = sortExerciseTrackers([
            ...data.trackers,
            ...(data.stepTracker ? [data.stepTracker] : [])
        ]);
        exerciseTrackersLoaded = true;
        renderExerciseTrackers();

    } catch (error) {

        console.error("Unable to load exercise progress.", error);

        if (preserveOnError) {

            throw error;

        }

    }

}


function showPactCelebration(messageText = "🎉 Goal reached!") {

    const celebration = document.createElement("div");
    const message = document.createElement("div");
    const colors = ["#22C55E", "#FCD34D", "#60A5FA", "#F472B6"];

    celebration.classList.add("pact-celebration");
    message.classList.add("pact-celebration-message");
    message.textContent = messageText;
    celebration.appendChild(message);

    for (let index = 0; index < 30; index += 1) {

        const piece = document.createElement("span");

        piece.classList.add("confetti-piece");
        piece.style.left = `${(index / 29) * 100}%`;
        piece.style.backgroundColor = colors[index % colors.length];
        piece.style.animationDelay = `${(index % 6) * 0.08}s`;
        celebration.appendChild(piece);

    }

    document.body.appendChild(celebration);

    window.setTimeout(() => {

        celebration.remove();

    }, 3500);

}


function celebratePactCompletion(challenge) {

    const athleteId = sessionStorage.getItem("gymPactSelectedAthleteId");
    const athleteProgress = challenge.progress?.find(participant => {

        return participant.userId === athleteId;

    });

    if (!athleteId || !athleteProgress || athleteProgress.isComplete !== true) {

        return;

    }

    showPactCompletionCelebration(challenge.id, athleteId);

}


function showPactCompletionCelebration(pactId, athleteId = sessionStorage.getItem("gymPactSelectedAthleteId")) {

    if (!pactId || !athleteId) return;

    const celebrationKey =
        `gymPactCelebration:${pactId}:${athleteId}`;

    if (localStorage.getItem(celebrationKey)) {

        return;

    }

    localStorage.setItem(celebrationKey, "shown");
    showPactCelebration();

}


function formatChallengeDate(date) {

    if (!date) {

        return "Not set";

    }

    return new Date(`${date}T00:00:00`).toLocaleDateString();

}

function formatShortPactDate(date) {

    return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric"
    });

}

function getNextWeekPactRange() {

    const today = currentMonthDate();
    const start = new Date(Date.UTC(today.year, Number(today.month) - 1, today.day, 12));
    const end = new Date(start);

    end.setUTCDate(end.getUTCDate() + 7);

    return `${formatShortPactDate(start.toISOString().slice(0, 10))} → ${formatShortPactDate(end.toISOString().slice(0, 10))}`;

}

function renderNextWeekPactCard() {

    const range = document.createElement("h4");
    const create = document.createElement("button");

    currentChallengeContainer.classList.add("home-cycle-empty", "home-cycle-compact");
    range.className = "home-cycle-date";
    range.textContent = getNextWeekPactRange();
    create.className = "home-cycle-action";
    create.type = "button";
    create.textContent = "+ Create Week Pact";
    create.addEventListener("click", startWeeklyPact);
    currentChallengeContainer.append(range, create);

}

function getChallengeStatusText(status, challenge) {

    if (status === "pending") {

        const selectedAthleteId = sessionStorage.getItem(
            "gymPactSelectedAthleteId"
        );

        if (challenge.createdBy !== selectedAthleteId) {

            return "This Pact is waiting for your response.";

        }

        const otherAthlete = challenge.participantDetails?.find(participant => {

            return participant.userId !== selectedAthleteId;

        });

        return `Waiting for ${otherAthlete?.displayName || "your partner"} to accept.`;

    }

    const statusText = {
        active: "Pact in progress.",
        completed: "Pact completed.",
        expired: "Pact expired."
    };

    return statusText[status] || "Pact status unavailable.";

}


function isChallengeCreator(challenge) {

    return challenge.createdBy === sessionStorage.getItem(
        "gymPactSelectedAthleteId"
    );

}


async function respondToPendingChallenge(action, actionButtons) {

    const sessionToken = sessionStorage.getItem("gymPactSessionToken");
    const athleteId = sessionStorage.getItem("gymPactSelectedAthleteId");

    if (!sessionToken || !athleteId || !currentChallenge) {

        return;

    }

    const buttons = actionButtons.querySelectorAll("button");

    buttons.forEach(button => {

        button.disabled = true;

    });

    try {

        const supabase = GymPactSupabase.getClient();
        const { error } = await supabase.functions.invoke(
            action,
            {
                body: {
                    sessionToken,
                    pactId: currentChallenge.id,
                    athleteId
                }
            }
        );

        if (error) {

            throw error;

        }

        await loadCurrentChallenge();

    } catch (error) {

        console.error("Unable to respond to Pact.", error);
        alert("We couldn't update that Pact. Please try again.");

        buttons.forEach(button => {

            button.disabled = false;

        });

    }

}


function appendPendingChallengeActions(container) {

    const actionButtons = document.createElement("div");
    const acceptButton = document.createElement("button");
    const declineButton = document.createElement("button");

    actionButtons.classList.add("challenge-actions");
    acceptButton.textContent = "Accept";
    declineButton.textContent = "Decline";

    acceptButton.addEventListener("click", () => {

        respondToPendingChallenge("accept-pact", actionButtons);

    });

    declineButton.addEventListener("click", () => {

        respondToPendingChallenge("decline-pact", actionButtons);

    });

    actionButtons.append(acceptButton, declineButton);
    container.appendChild(actionButtons);

}


function createChallengeStatusPill(status) {

    const labels = {
        pending: "⏳ Pending",
        active: "● Active",
        completed: "🏆 Completed",
        expired: "Expired"
    };

    const pill = document.createElement("span");

    pill.classList.add("challenge-status-pill", `status-${status}`);
    pill.textContent = labels[status] || status;

    return pill;

}


function appendChallengeDetail(container, title, value) {

    const detail = document.createElement("div");
    const heading = document.createElement("h4");
    const content = document.createElement("p");

    detail.classList.add("challenge-detail");
    heading.textContent = title;
    content.textContent = value;

    detail.append(heading, content);
    container.appendChild(detail);

}


function getRequirementLabel(type) {

    return { workouts: "🏋️ Workouts", hiit: "⚡ HIIT", steps: "👟 Steps" }[type] || type;

}

function getRequirementText(type) {

    return { workouts: "Workouts", hiit: "HIIT", steps: "Steps" }[type] || type;

}

function getRequirementIconPath(type) {

    return {
        workouts: "assets/gp-images/workout-label.png",
        hiit: "assets/gp-images/hiit-label.png",
        steps: "assets/gp-images/steps-label.png"
    }[type] || "";

}

function sortRequirementsForDisplay(requirements) {

    const order = { hiit: 0, steps: 1, workouts: 2 };

    return [...requirements].sort((first, second) => {

        return (order[first.type] ?? 99) - (order[second.type] ?? 99);

    });

}


function appendRequirementProgress(container, requirement, displayMode = "default") {

    const row = document.createElement("div");
    const label = document.createElement("div");
    const text = document.createElement("span");
    const score = document.createElement("span");
    const meter = document.createElement("div");
    const fill = document.createElement("span");
    const percentage = Math.min((requirement.completed / requirement.targetAmount) * 100, 100);

    row.classList.add("pact-requirement");
    label.classList.add("pact-requirement-label");
    score.textContent = `${requirement.completed.toLocaleString()} / ${requirement.targetAmount.toLocaleString()}`;

    if (displayMode === "pact") {

        const identity = document.createElement("span");
        const iconFrame = document.createElement("span");
        const icon = document.createElement("img");

        identity.classList.add("pact-requirement-identity");
        iconFrame.classList.add("pact-requirement-icon-frame");
        icon.classList.add("pact-requirement-icon", `type-${requirement.type}`);
        icon.src = getRequirementIconPath(requirement.type);
        icon.alt = "";
        text.textContent = getRequirementText(requirement.type);
        iconFrame.appendChild(icon);
        identity.append(iconFrame, text);
        label.append(identity, score);

    } else {

        text.textContent = getRequirementLabel(requirement.type);
        label.append(text, score);

    }
    row.appendChild(label);

    if (displayMode === "pact" && (requirement.type === "hiit" || requirement.type === "workouts")) {

        const markers = document.createElement("div");

        markers.classList.add("pact-requirement-markers", `type-${requirement.type}`);
        markers.setAttribute("aria-label", `${requirement.completed} of ${requirement.targetAmount} ${getRequirementText(requirement.type).toLowerCase()} completed`);
        for (let index = 0; index < requirement.targetAmount; index += 1) {

            const marker = document.createElement("span");
            const image = document.createElement("img");

            marker.classList.add("pact-requirement-marker");
            if (index < requirement.completed) marker.classList.add("is-complete");
            image.src = requirement.type === "hiit" ? "assets/gp-images/HIIT.png" : "assets/gp-images/Workout.png";
            image.alt = "";
            marker.appendChild(image);
            markers.appendChild(marker);

        }
        row.appendChild(markers);

    } else if (displayMode !== "pact" && requirement.type === "hiit") {

        const icons = document.createElement("div");

        icons.classList.add("hiit-icons");
        for (let index = 0; index < requirement.targetAmount; index += 1) {

            const icon = document.createElement("span");
            const image = document.createElement("img");

            icon.classList.add("hiit-icon");
            if (index < requirement.completed) icon.classList.add("is-complete");
            image.src = "assets/gp-images/HIIT.png";
            image.alt = "";
            icon.appendChild(image);
            icons.appendChild(icon);

        }
        row.appendChild(icons);

    } else {

        meter.classList.add("pact-requirement-meter");
        fill.style.width = `${percentage}%`;
        meter.appendChild(fill);
        row.appendChild(meter);

    }

    container.appendChild(row);

}

function appendRequirementTarget(container, requirement, timeframe) {

    const row = document.createElement("div");
    const label = document.createElement("div");
    const text = document.createElement("span");
    const target = document.createElement("span");

    row.classList.add("pact-requirement", "pact-requirement-target");
    label.classList.add("pact-requirement-label");
    text.textContent = getRequirementLabel(requirement.type);
    target.textContent = `${requirement.targetAmount.toLocaleString()} / ${timeframe}`;
    label.append(text, target);
    row.appendChild(label);
    container.appendChild(row);

}


function createPactProgressOverview(challenge) {

    const progress = document.createElement("section");
    const title = document.createElement("h4");

    progress.className = "home-pact-progress";
    title.className = "challenge-progress-title";
    title.textContent = "Pact Progress";
    progress.appendChild(title);

    const details = document.createElement("div");
    details.className = "pact-progress-detail";

    (challenge.progress || []).forEach(participant => {

        const card = document.createElement("article");
        const heading = document.createElement("h4");

        card.classList.add("pact-progress-athlete");
        heading.textContent = participant.displayName;
        card.appendChild(heading);
        participant.requirements.forEach(requirement => appendRequirementProgress(card, requirement, "pact"));
        details.appendChild(card);

    });

    progress.appendChild(details);
    return progress;

}


function showDashboardTab(tab) {

    activeDashboardTab = tab;
    document.body.classList.toggle("is-progress-tab", tab === "progress");
    document.body.classList.toggle("is-pact-tab", tab === "pact");
    const dashboardContent = document.getElementById("dashboard-content");

    if (dashboardContent) dashboardContent.scrollTop = 0;

    dashboardTabs.forEach(button => {

        const active = button.id === `${tab}-tab`;

        button.classList.toggle("is-active", active);
        button.setAttribute("aria-selected", String(active));

    });
    dashboardTabContent.forEach(content => {

        content.hidden = content.dataset.dashboardTabContent !== tab;

    });
    welcomeMessage.hidden = tab !== "overview";

    renderExerciseTrackers();

    if (tab === "activity") loadActivityWorkouts();
    if (tab === "progress") {
        renderProgressRace();
    }
    if (tab === "pact") showPactType();

}

function showPactType() {

    if (pactMonthPactContent && monthPactContent.parentElement !== pactMonthPactContent) {

        pactMonthPactContent.appendChild(monthPactContent);

    }

    renderMonthPact();
    loadMonthlyPact();

}

function getActivityDateKey(value) {

    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: GYMPACT_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(new Date(value));
    const parsed = Object.fromEntries(parts.map(part => [part.type, part.value]));

    return `${parsed.year}-${parsed.month}-${parsed.day}`;

}

function formatActivityTimestamp(value) {

    const date = new Date(value);
    const dateKey = getActivityDateKey(date);
    const today = getCalendarDayInGymPactTimeZone();
    const time = new Intl.DateTimeFormat("en-US", {
        timeZone: GYMPACT_TIME_ZONE,
        hour: "numeric",
        minute: "2-digit"
    }).format(date);

    if (dateKey === today) return `Today at ${time}`;
    if (dateKey === addCalendarDays(today, -1)) return `Yesterday at ${time}`;

    const dateLabel = new Intl.DateTimeFormat("en-US", {
        timeZone: GYMPACT_TIME_ZONE,
        month: "short",
        day: "numeric"
    }).format(date);

    const workoutYear = new Intl.DateTimeFormat("en-US", {
        timeZone: GYMPACT_TIME_ZONE,
        year: "numeric"
    }).format(date);
    const currentYear = new Intl.DateTimeFormat("en-US", {
        timeZone: GYMPACT_TIME_ZONE,
        year: "numeric"
    }).format(new Date());

    return `${dateLabel}${workoutYear === currentYear ? "" : `, ${workoutYear}`} at ${time}`;

}

function formatActivityMonth(value) {

    return new Intl.DateTimeFormat("en-US", {
        timeZone: GYMPACT_TIME_ZONE,
        month: "long",
        year: "numeric"
    }).format(new Date(value));

}

function formatMonthlyPactMonth(value) {

    if (!value) return "";
    return new Intl.DateTimeFormat("en-US", {
        timeZone: GYMPACT_TIME_ZONE,
        month: "long",
        year: "numeric"
    }).format(new Date(`${value}T12:00:00Z`));

}

function parseActivityMuscles(muscles) {

    try {

        const parsed = JSON.parse(muscles);

        if (Array.isArray(parsed)) return parsed.filter(item => typeof item === "string" && item.trim());

    } catch {

        return typeof muscles === "string" ? muscles.split(", ").filter(Boolean) : [];

    }

    return [];

}

function getActivityMeasurements(workout) {

    if (Array.isArray(workout.measurements)) {

        return workout.measurements.filter(measurement => (
            measurement && Number(measurement.amount) > 0 && typeof measurement.unit === "string"
        ));

    }

    return Number(workout.duration_minutes) > 0
        ? [{ amount: Number(workout.duration_minutes), unit: "minutes" }]
        : [];

}

function formatActivityMeasurement(measurement) {

    const unit = { minutes: "min", reps: "reps", sets: "sets", miles: "mi", steps: "steps" }[measurement.unit] || measurement.unit;

    return `${Number(measurement.amount).toLocaleString()} ${unit}`;

}

function getActivityInitials(name) {

    return String(name || "GymPact athlete")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0])
        .join("")
        .toUpperCase();

}

function renderAvatarImage(image, initialsElement, displayName, photoUrl = null) {

    const initials = getActivityInitials(displayName);

    initialsElement.textContent = initials;
    initialsElement.hidden = false;
    image.hidden = true;
    image.removeAttribute("src");
    delete image.dataset.photoUrl;

    if (!photoUrl) return;

    image.dataset.photoUrl = photoUrl;
    image.onload = () => {

        if (image.dataset.photoUrl !== photoUrl) return;
        image.hidden = false;
        initialsElement.hidden = true;

    };
    image.onerror = () => {

        if (image.dataset.photoUrl !== photoUrl) return;
        image.hidden = true;
        initialsElement.hidden = false;

    };
    image.src = photoUrl;

}

function renderProfileAvatar({ displayName = currentUser, photoUrl = null } = {}) {

    profileDisplayName = displayName;
    profilePhotoUrl = photoUrl;
    localStorage.setItem("currentUser", displayName);
    welcomeMessage.textContent = `Welcome back, ${displayName}!`;
    renderAvatarImage(profileMenuImage, profileMenuInitials, displayName, photoUrl);
    renderProfileDraftAvatar();

}

function renderProfileDraftAvatar() {

    const draftPhotoUrl = profileDraftPhotoRemoved
        ? null
        : profileDraftPhotoUrl || profilePhotoUrl;
    renderAvatarImage(
        profilePageImage,
        profilePageInitials,
        profileDisplayNameInput?.value?.trim() || profileDisplayName,
        draftPhotoUrl
    );

}

function closeProfileMenu({ restoreFocus = false } = {}) {

    if (profileActionsMenu.hidden) return;
    profileActionsMenu.hidden = true;
    profileMenuButton.setAttribute("aria-expanded", "false");
    if (restoreFocus) profileMenuButton.focus();

}

function openProfileMenu() {

    profileActionsMenu.hidden = false;
    profileMenuButton.setAttribute("aria-expanded", "true");

}

function openProfilePage() {

    closeProfileMenu();
    resetProfileDraft();
    profilePage.hidden = false;
    closeProfilePageButton.focus();

}

function closeProfilePage() {

    resetProfileDraft();
    profilePage.hidden = true;
    profileMenuButton.focus();


}

function setProfilePageError(message = "") {

    profilePageError.textContent = message;
    profilePageError.hidden = !message;

}

function discardProfileDraftPhoto() {

    if (profileDraftPhotoUrl) URL.revokeObjectURL(profileDraftPhotoUrl);
    profileDraftPhoto = null;
    profileDraftPhotoUrl = "";
    profileDraftPhotoRemoved = false;

}

function profileHasChanges() {

    return profileDisplayNameInput.value.trim() !== profileDisplayName ||
        Boolean(profileDraftPhoto) || profileDraftPhotoRemoved;

}

function updateProfileSaveState() {

    const hasName = Boolean(profileDisplayNameInput.value.trim());
    saveProfileChangesButton.disabled = !hasName || !profileHasChanges() || saveProfileChangesButton.dataset.saving === "true";

}

function resetProfileDraft() {

    discardProfileDraftPhoto();
    profilePhotoInput.value = "";
    profileDisplayNameInput.value = profileDisplayName;
    clearProfilePhotoButton.hidden = !profilePhotoUrl;
    setProfilePageError();
    renderProfileDraftAvatar();
    updateProfileSaveState();

}

function handleProfilePhotoSelection() {

    const photo = profilePhotoInput.files?.[0];

    if (!photo) return;

    if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(photo.type) || photo.size > 5 * 1024 * 1024) {

        setProfilePageError("Choose a JPEG, PNG, or WebP photo smaller than 5 MB.");
        profilePhotoInput.value = "";
        return;

    }

    if (profileDraftPhotoUrl) URL.revokeObjectURL(profileDraftPhotoUrl);
    profileDraftPhoto = photo;
    profileDraftPhotoUrl = URL.createObjectURL(photo);
    profileDraftPhotoRemoved = false;
    clearProfilePhotoButton.hidden = false;
    setProfilePageError();
    renderProfileDraftAvatar();
    updateProfileSaveState();

}

async function loadProfilePhoto() {

    const sessionToken = sessionStorage.getItem("gymPactSessionToken");
    const userId = sessionStorage.getItem("gymPactSelectedAthleteId");

    if (!sessionToken || !userId) return;

    try {

        const selection = await GymPactSupabase.getClient().functions.invoke("select-gympact-athlete", {
            body: { sessionToken, userId }
        });

        if (selection.error || selection.data?.error) {

            throw selection.error || new Error(selection.data.error);

        }

        const { data, error } = await GymPactSupabase.getClient().functions.invoke("profile", {
            body: { action: "get", sessionToken }
        });

        if (error || data?.error) throw error || new Error(data.error);
        renderProfileAvatar({ displayName: data.displayName || currentUser, photoUrl: data.photoUrl || null });

    } catch (error) {

        console.error("Unable to load profile photo.", error);
        renderProfileAvatar();

    }

}

async function saveProfileChanges(event) {

    event.preventDefault();
    const displayName = profileDisplayNameInput.value.trim();
    const sessionToken = sessionStorage.getItem("gymPactSessionToken");
    const userId = sessionStorage.getItem("gymPactSelectedAthleteId");

    if (!displayName) {

        setProfilePageError("Enter a display name.");
        updateProfileSaveState();
        return;

    }

    if (!sessionToken || !userId) return;

    saveProfileChangesButton.dataset.saving = "true";
    saveProfileChangesButton.textContent = "Saving…";
    updateProfileSaveState();
    setProfilePageError();

    try {

        const form = new FormData();
        form.append("action", "save");
        form.append("sessionToken", sessionToken);
        form.append("displayName", displayName);
        if (profileDraftPhoto) form.append("photo", profileDraftPhoto);
        if (profileDraftPhotoRemoved) form.append("removePhoto", "true");
        const { data, error } = await GymPactSupabase.getClient().functions.invoke("profile", { body: form });

        if (error || data?.error) throw error || new Error(data.error);
        renderProfileAvatar({ displayName: data.displayName || currentUser, photoUrl: data.photoUrl || null });
        resetProfileDraft();
        if (currentChallengeLoaded) loadCurrentChallenge({ preserveOnError: true });
        if (monthlyPact) loadMonthlyPact();
        if (activityWorkoutsLoaded) loadActivityWorkouts({ reset: true });

    } catch (error) {

        setProfilePageError(error?.message || "Unable to save your profile changes.");

    } finally {

        delete saveProfileChangesButton.dataset.saving;
        saveProfileChangesButton.textContent = "Save changes";
        updateProfileSaveState();

    }

}

function closeActivityMenus() {

    document.querySelectorAll(".activity-card-menu").forEach(menu => { menu.hidden = true; });
    document.querySelectorAll(".activity-card-menu-toggle").forEach(button => {

        button.setAttribute("aria-expanded", "false");

    });

}

function openActivityPhoto(photo) {

    activityPhotoFull.src = photo.src;
    activityPhotoFull.alt = photo.alt;
    activityPhotoDialog.showModal();

}

function createActivityText(tagName, className, text) {

    const element = document.createElement(tagName);
    element.className = className;
    element.textContent = text;
    return element;

}

function createActivityIcon(svg) {

    const icon = document.createElement("span");
    icon.className = "activity-inline-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = svg;
    return icon;

}

function getMonthlyCompletionMessage(completion) {

    const athlete = completion.athlete_name || "An athlete";
    return `${athlete} completed their Month-long goal on GymPact!`;

}

function getMonthlyCompletionBrandAssets() {

    if (!monthlyCompletionBrandAssetsPromise) {

        monthlyCompletionBrandAssetsPromise = Promise.all([
            fetch(new URL("assets/gp-images/logo.png", window.location.href)).then(response => {

                if (!response.ok) throw new Error("The GymPact logo is unavailable.");
                return response.blob();

            }).then(blob => createImageBitmap(blob)),
            fetch(new URL("assets/gp-images/gympact-wordmark.png", window.location.href)).then(response => {

                if (!response.ok) throw new Error("The GymPact wordmark is unavailable.");
                return response.blob();

            }).then(blob => createImageBitmap(blob))
        ]);

    }

    return monthlyCompletionBrandAssetsPromise;

}

function drawShareRoundedRect(context, x, y, width, height, radius) {

    const corner = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + corner, y);
    context.arcTo(x + width, y, x + width, y + height, corner);
    context.arcTo(x + width, y + height, x, y + height, corner);
    context.arcTo(x, y + height, x, y, corner);
    context.arcTo(x, y, x + width, y, corner);
    context.closePath();

}

function drawShareWrappedText(context, text, x, y, width, lineHeight) {

    const words = String(text || "").split(/\s+/).filter(Boolean);
    let line = "";
    let cursorY = y;

    words.forEach(word => {

        const nextLine = line ? `${line} ${word}` : word;
        if (line && context.measureText(nextLine).width > width) {

            context.fillText(line, x, cursorY);
            cursorY += lineHeight;
            line = word;

        } else {

            line = nextLine;

        }

    });

    if (line) context.fillText(line, x, cursorY);
    return cursorY;

}

async function createMonthlyCompletionShareImage(completion) {

    if (!completion.photo_url) throw new Error("The proof photo is unavailable.");

    const [response, [brandIcon, brandWordmark]] = await Promise.all([
        fetch(completion.photo_url),
        getMonthlyCompletionBrandAssets()
    ]);
    if (!response.ok) throw new Error("The proof photo is unavailable.");
    const image = await createImageBitmap(await response.blob());
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1350;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser cannot prepare this share image.");

    context.fillStyle = "#101312";
    context.fillRect(0, 0, canvas.width, canvas.height);
    drawShareRoundedRect(context, 24, 24, 1032, 1302, 38);
    context.fillStyle = "#171b1a";
    context.fill();
    context.lineWidth = 15;
    context.strokeStyle = "#c9a64d";
    context.stroke();

    const confetti = [[84, 104, 18, 7], [172, 150, 7, 20], [272, 88, 20, 8], [398, 126, 8, 19], [502, 76, 20, 8], [658, 142, 8, 20], [786, 90, 19, 8], [914, 132, 8, 20], [976, 84, 19, 8]];
    context.fillStyle = "#d7b85b";
    confetti.forEach(([x, y, width, height], index) => {

        context.save();
        context.translate(x, y);
        context.rotate((index % 2 ? 1 : -1) * .52);
        context.fillRect(-width / 2, -height / 2, width, height);
        context.restore();

    });

    context.fillStyle = "#d8b85b";
    context.font = "700 28px system-ui, sans-serif";
    context.letterSpacing = "4px";
    context.fillText("MONTH PACT COMPLETE", 88, 154);
    context.letterSpacing = "0px";
    context.fillStyle = "#f1f3f2";
    context.font = "800 48px system-ui, sans-serif";
    context.fillText(completion.month_label || "GymPact", 88, 220);

    const frame = { x: 88, y: 270, width: 904, height: 650 };
    drawShareRoundedRect(context, frame.x, frame.y, frame.width, frame.height, 25);
    context.save();
    context.clip();
    const scale = Math.min(frame.width / image.width, frame.height / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    context.fillStyle = "#070909";
    context.fillRect(frame.x, frame.y, frame.width, frame.height);
    context.drawImage(image, frame.x + (frame.width - width) / 2, frame.y + (frame.height - height) / 2, width, height);
    context.restore();
    image.close();

    context.fillStyle = "#f5f6f5";
    context.font = "800 42px system-ui, sans-serif";
    const lastTextY = drawShareWrappedText(context, getMonthlyCompletionMessage(completion), 88, 1005, 904, 55);
    context.fillStyle = "#c7cecb";
    context.font = "500 30px system-ui, sans-serif";
    context.fillText(completion.monthly_goal ? `Goal: ${completion.monthly_goal}` : "GymPact", 88, Math.min(lastTextY + 64, 1234));
    const logoSize = 48;
    const wordmarkWidth = 316;
    const wordmarkHeight = wordmarkWidth * (brandWordmark.height / brandWordmark.width);
    const logoY = 1237;
    context.drawImage(brandIcon, 88, logoY, logoSize, logoSize);
    context.drawImage(brandWordmark, 153, logoY + (logoSize - wordmarkHeight) / 2, wordmarkWidth, wordmarkHeight);

    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("Your browser could not create the share image.");
    return new File([blob], "gympact-month-pact-complete.png", { type: "image/png" });

}

async function shareMonthlyCompletion(completion, button) {

    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = "Preparing…";
    const text = `${getMonthlyCompletionMessage(completion)} ${completion.month_label || ""}`.trim();

    try {

        const file = await createMonthlyCompletionShareImage(completion);
        const payload = { title: "GymPact Month Pact complete", text, files: [file] };

        if (navigator.share && (!navigator.canShare || navigator.canShare(payload))) {

            await navigator.share(payload);

        } else if (navigator.clipboard?.writeText) {

            await navigator.clipboard.writeText(text);
            button.textContent = "Copied";
            window.setTimeout(() => { button.textContent = originalLabel; }, 1600);

        } else {

            throw new Error("Sharing is not available in this browser.");

        }

    } catch (error) {

        if (error?.name !== "AbortError") {

            console.error("Unable to share Month Pact completion.", error);
            button.textContent = "Try again";
            window.setTimeout(() => { button.textContent = originalLabel; }, 1600);

        }

    } finally {

        button.disabled = false;

    }

}

function renderActivityWorkouts() {

    activityWorkoutsContainer.innerHTML = "";

    if (!activityWorkouts.length) {

        const emptyState = document.createElement("div");
        emptyState.className = "activity-empty-state";
        emptyState.appendChild(createActivityText("p", "", activityLoadError ? "Unable to load shared workouts." : "No shared workouts yet."));
        if (activityLoadError) {

            const retry = document.createElement("button");
            retry.type = "button";
            retry.textContent = "Retry";
            retry.addEventListener("click", () => loadActivityWorkouts({ reset: true }));
            emptyState.appendChild(retry);

        }
        activityWorkoutsContainer.appendChild(emptyState);
        return;

    }

    const grouped = new Map();

    activityWorkouts.forEach(workout => {

        const group = formatActivityMonth(workout.logged_at);
        if (!grouped.has(group)) grouped.set(group, []);
        grouped.get(group).push(workout);

    });

    const selectedAthleteId = sessionStorage.getItem("gymPactSelectedAthleteId");

    let renderedPhotoCount = 0;

    grouped.forEach((workouts, month) => {

        const section = document.createElement("section");
        section.className = "activity-month-group";
        const heading = document.createElement("h4");
        heading.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2"></rect><path d="M8 3v4M16 3v4M3.5 10h17M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01M16 17.5h.01"></path></svg><span></span>';
        heading.querySelector("span").textContent = month;
        section.appendChild(heading);

        workouts.forEach(workout => {

            const isMonthlyCompletion = workout.activity_type === "monthly_goal_completion";
            const completionMonthLabel = isMonthlyCompletion ? formatMonthlyPactMonth(workout.month_start) : "";
            const card = document.createElement("article");
            card.className = `activity-card${isMonthlyCompletion ? " activity-month-pact-completion" : ""}`;
            const header = document.createElement("header");
            header.className = "activity-card-header";
            const avatar = createActivityText("span", "activity-avatar", getActivityInitials(workout.athlete_name));
            const identity = document.createElement("div");
            identity.className = "activity-identity";
            identity.append(
                createActivityText("h5", "activity-athlete-name", workout.athlete_name || "GymPact athlete"),
                createActivityText("p", "activity-timestamp", formatActivityTimestamp(workout.logged_at)),
            );
            header.append(avatar, identity);

            if (isMonthlyCompletion) {

                const badge = document.createElement("span");
                badge.className = "activity-month-pact-badge";
                badge.append(
                    createActivityIcon('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3M5.64 5.64l2.12 2.12M3 12h3M5.64 18.36l2.12-2.12M12 18v3M18.36 18.36l-2.12-2.12M18 12h3M18.36 5.64l-2.12 2.12"></path><circle cx="12" cy="12" r="3"></circle></svg>'),
                    document.createTextNode("Month Pact")
                );
                header.appendChild(badge);

            } else if (workout.user_id === selectedAthleteId) {

                const menuWrap = document.createElement("div");
                menuWrap.className = "activity-card-menu-wrap";
                const toggle = document.createElement("button");
                toggle.type = "button";
                toggle.className = "activity-card-menu-toggle";
                toggle.setAttribute("aria-label", `Actions for ${workout.athlete_name}'s workout`);
                toggle.setAttribute("aria-expanded", "false");
                toggle.textContent = "•••";
                const menu = document.createElement("div");
                menu.className = "activity-card-menu";
                menu.hidden = true;
                const edit = document.createElement("button");
                edit.type = "button";
                edit.textContent = "Edit";
                edit.addEventListener("click", () => openWorkoutEditor(workout));
                menu.appendChild(edit);
                toggle.addEventListener("click", event => {

                    event.stopPropagation();
                    const willOpen = menu.hidden;
                    closeActivityMenus();
                    menu.hidden = !willOpen;
                    toggle.setAttribute("aria-expanded", String(willOpen));

                });
                menuWrap.append(toggle, menu);
                header.appendChild(menuWrap);

            }

            card.appendChild(header);

            if (workout.photo_url) {

                const photo = document.createElement("img");
                photo.className = "activity-workout-photo";
                photo.src = workout.photo_url;
                photo.loading = renderedPhotoCount < 2 ? "eager" : "lazy";
                photo.decoding = "async";
                if (renderedPhotoCount < 2) photo.fetchPriority = "high";
                renderedPhotoCount += 1;
                photo.alt = isMonthlyCompletion
                    ? `Month Pact proof for ${workout.athlete_name}`
                    : `Workout proof for ${workout.activity_name || workout.athlete_name}`;
                photo.tabIndex = 0;
                photo.setAttribute("role", "button");
                photo.addEventListener("click", () => openActivityPhoto(photo));
                photo.addEventListener("keydown", event => {

                    if (event.key === "Enter" || event.key === " ") {

                        event.preventDefault();
                        openActivityPhoto(photo);

                    }

                });
                card.appendChild(photo);

            }

            if (isMonthlyCompletion) {

                card.appendChild(createActivityText("p", "activity-summary activity-month-pact-message", getMonthlyCompletionMessage(workout)));
                if (completionMonthLabel) card.appendChild(createActivityText("p", "activity-details", completionMonthLabel));
                if (workout.monthly_goal) card.appendChild(createActivityText("p", "activity-notes activity-month-pact-goal", `Goal: ${workout.monthly_goal}`));

                if (workout.user_id === selectedAthleteId) {

                    const share = document.createElement("button");
                    share.type = "button";
                    share.className = "activity-month-pact-share";
                    share.setAttribute("aria-label", `Share ${workout.athlete_name}'s ${completionMonthLabel || "Month Pact"} completion`);
                    share.append(
                        createActivityIcon('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m21 3-7.5 18-3.7-7.8L2 9.5 21 3Z"></path><path d="m9.8 13.2 4.7-4.7"></path></svg>'),
                        document.createTextNode("Share")
                    );
                    share.addEventListener("click", () => shareMonthlyCompletion({ ...workout, month_label: completionMonthLabel }, share));
                    card.appendChild(share);

                }

            } else {

                const measurements = getActivityMeasurements(workout);
                if (measurements.length) card.appendChild(createActivityText("p", "activity-summary", measurements.map(formatActivityMeasurement).join(" · ")));

                const muscles = parseActivityMuscles(workout.muscles);
                if (muscles.length) card.appendChild(createActivityText("p", "activity-details", muscles.join(" · ")));
                if (workout.notes) card.appendChild(createActivityText("p", "activity-notes", workout.notes));

            }

            section.appendChild(card);

        });

        activityWorkoutsContainer.appendChild(section);

    });

    if (activityHasMore || activityLoadError) {

        const controls = document.createElement("div");
        controls.className = "activity-load-more";
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = activityLoadError ? "Retry loading workouts" : activityWorkoutsLoading ? "Loading workouts…" : "Load more workouts";
        button.disabled = activityWorkoutsLoading;
        button.addEventListener("click", () => loadActivityWorkouts({ nextPage: true }));
        controls.appendChild(button);
        activityWorkoutsContainer.appendChild(controls);

        activityLoadObserver?.disconnect();
        if (activityHasMore && !activityLoadError && "IntersectionObserver" in window) {

            activityLoadObserver = new IntersectionObserver(entries => {

                if (entries.some(entry => entry.isIntersecting)) loadActivityWorkouts({ nextPage: true });

            }, { rootMargin: "400px 0px" });
            activityLoadObserver.observe(controls);

        }

    }

}

async function loadActivityWorkouts({ reset = false, nextPage = false } = {}) {

    const sessionToken = sessionStorage.getItem("gymPactSessionToken");
    if (!sessionToken || !activityWorkoutsContainer) return;
    if (activityWorkoutsLoading || (!reset && !nextPage && activityWorkoutsLoaded) || (nextPage && !activityHasMore)) return;

    activityWorkoutsLoading = true;
    activityLoadError = false;
    if (nextPage) renderActivityWorkouts();

    try {

        const { data, error } = await GymPactSupabase.getClient().functions.invoke("list-workouts", {
            body: {
                sessionToken,
                dataEnvironment: "production",
                activityFeed: true,
                limit: ACTIVITY_PAGE_SIZE,
                cursor: reset ? null : activityNextCursor
            }
        });
        if (error || !Array.isArray(data?.workouts)) throw error || new Error("Workout history was unavailable.");
        const pageWorkouts = data.workouts;
        const existingIds = reset ? new Set() : new Set(activityWorkouts.map(workout => workout.id));
        activityWorkouts = (reset ? pageWorkouts : [...activityWorkouts, ...pageWorkouts.filter(workout => !existingIds.has(workout.id))])
            .sort((a, b) => new Date(b.logged_at) - new Date(a.logged_at));
        activityNextCursor = data.nextCursor || null;
        activityHasMore = Boolean(data.hasMore);
        activityWorkoutsLoaded = true;

    } catch (error) {

        console.error("Unable to load Activity.", error);
        activityLoadError = true;

    } finally {

        activityWorkoutsLoading = false;
        renderActivityWorkouts();

    }

}

function formatGymPactDateTimeInput(value) {

    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: GYMPACT_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23"
    }).formatToParts(new Date(value));
    const parsed = Object.fromEntries(parts.map(part => [part.type, part.value]));

    return `${parsed.year}-${parsed.month}-${parsed.day}T${parsed.hour}:${parsed.minute}`;

}

function gymPactDateTimeToISOString(value) {

    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
    if (!match) return null;

    const [, year, month, day, hour, minute] = match;
    const wallClock = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
    const zoneParts = new Intl.DateTimeFormat("en-CA", {
        timeZone: GYMPACT_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23"
    }).formatToParts(new Date(wallClock));
    const parsed = Object.fromEntries(zoneParts.map(part => [part.type, part.value]));
    const displayedAsUtc = Date.UTC(
        Number(parsed.year),
        Number(parsed.month) - 1,
        Number(parsed.day),
        Number(parsed.hour),
        Number(parsed.minute)
    );

    return new Date(wallClock - (displayedAsUtc - wallClock)).toISOString();

}

function setEditWorkoutError(message = "") {

    editWorkoutError.textContent = message;
    editWorkoutError.hidden = !message;

}

function createEditMeasurementRow(measurement) {

    const row = document.createElement("div");
    row.className = "edit-workout-measurement";
    const amount = document.createElement("input");
    amount.type = "number";
    amount.min = "1";
    amount.step = "1";
    amount.inputMode = "numeric";
    amount.value = String(measurement.amount);
    amount.setAttribute("aria-label", "Measurement amount");
    const unit = document.createElement("select");
    unit.setAttribute("aria-label", "Measurement unit");
    ["minutes", "reps", "sets", "miles", "steps"].forEach(value => {

        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        option.selected = value === measurement.unit;
        unit.appendChild(option);

    });
    row.append(amount, unit);
    editWorkoutMeasurements.appendChild(row);

}

function openWorkoutEditor(workout) {

    closeActivityMenus();
    editingWorkout = workout;
    editWorkoutDateTime.value = formatGymPactDateTimeInput(workout.logged_at);
    editWorkoutNotes.value = workout.notes || "";
    editWorkoutMuscles.innerHTML = "";
    const selectedMuscles = new Set(parseActivityMuscles(workout.muscles));

    ACTIVITY_MUSCLES.forEach(muscle => {

        const label = document.createElement("label");
        const input = document.createElement("input");
        input.type = "checkbox";
        input.value = muscle;
        input.checked = selectedMuscles.has(muscle);
        label.append(input, document.createTextNode(muscle));
        editWorkoutMuscles.appendChild(label);

    });

    editWorkoutMeasurements.innerHTML = "";
    getActivityMeasurements(workout).forEach(createEditMeasurementRow);
    setEditWorkoutError();
    editWorkoutModal.style.display = "flex";

}

function closeWorkoutEditor() {

    editingWorkout = null;
    editWorkoutModal.style.display = "none";
    setEditWorkoutError();

}

async function saveWorkoutEdit() {

    if (!editingWorkout) return;

    const muscles = Array.from(editWorkoutMuscles.querySelectorAll("input:checked"))
        .map(input => input.value);
    const measurements = Array.from(editWorkoutMeasurements.querySelectorAll(".edit-workout-measurement"))
        .map(row => ({
            amount: Number(row.querySelector("input").value),
            unit: row.querySelector("select").value
        }));
    const loggedAt = gymPactDateTimeToISOString(editWorkoutDateTime.value);

    if (!loggedAt || new Date(loggedAt) > new Date()) {

        setEditWorkoutError("Choose a valid workout date and time that is not in the future.");
        return;

    }

    if (!muscles.length) {

        setEditWorkoutError("Select at least one muscle group.");
        return;

    }

    if (!measurements.length || measurements.some(item => !Number.isInteger(item.amount) || item.amount <= 0)) {

        setEditWorkoutError("Each measurement needs a whole number greater than zero.");
        return;

    }

    const sessionToken = sessionStorage.getItem("gymPactSessionToken");
    const userId = sessionStorage.getItem("gymPactSelectedAthleteId");
    if (!sessionToken || !userId) {

        setEditWorkoutError("Please unlock GymPact and choose your athlete first.");
        return;

    }

    saveEditWorkoutButton.disabled = true;
    setEditWorkoutError();

    try {

        const { data, error } = await GymPactSupabase.getClient().functions.invoke("update-workout", {
            body: {
                sessionToken,
                userId,
                workoutId: editingWorkout.id,
                activityName: muscles.join(" · "),
                muscles,
                measurements,
                notes: editWorkoutNotes.value,
                loggedAt,
                dataEnvironment: "production"
            }
        });
        if (error || data?.error) throw error || new Error(data?.error || "Unable to save workout.");

        closeWorkoutEditor();
        await Promise.all([loadActivityWorkouts({ reset: true }), refreshDashboard()]);

    } catch (error) {

        console.error("Unable to edit workout.", error);
        setEditWorkoutError("We couldn’t save that workout. Please try again.");

    } finally {

        saveEditWorkoutButton.disabled = false;

    }

}

closeActivityPhotoButton.addEventListener("click", () => activityPhotoDialog.close());
activityPhotoDialog.addEventListener("click", event => {

    if (event.target === activityPhotoDialog) activityPhotoDialog.close();

});
cancelEditWorkoutButton.addEventListener("click", closeWorkoutEditor);
editWorkoutModal.addEventListener("click", event => {

    if (event.target === editWorkoutModal) closeWorkoutEditor();

});
saveEditWorkoutButton.addEventListener("click", saveWorkoutEdit);
document.addEventListener("click", event => {

    if (!event.target.closest(".activity-card-menu-wrap")) closeActivityMenus();

});


function addProgressDays(startDate, endDate) {

    const days = [];
    const cursor = new Date(`${startDate}T12:00:00Z`);
    const end = new Date(`${endDate}T12:00:00Z`);

    while (cursor <= end && days.length < 7) {

        days.push(cursor.toISOString().slice(0, 10));
        cursor.setUTCDate(cursor.getUTCDate() + 1);

    }

    return days;

}

function formatProgressDay(date, style = "short") {

    return new Intl.DateTimeFormat(undefined, {
        timeZone: "America/New_York",
        weekday: style === "narrow" ? "narrow" : "short",
        month: "short",
        day: "numeric"
    }).format(new Date(`${date}T12:00:00Z`));

}

function formatProgressDayInitial(date) {

    return new Intl.DateTimeFormat(undefined, {
        timeZone: "America/New_York",
        weekday: "narrow"
    }).format(new Date(`${date}T12:00:00Z`));

}

function formatPactTimeRemaining(challenge) {

    const endsAt = challenge.endsAt ? new Date(challenge.endsAt) : null;
    const milliseconds = endsAt ? endsAt.getTime() - Date.now() : 0;

    if (!Number.isFinite(milliseconds) || milliseconds <= 0) return "Deadline reached";

    const hours = Math.ceil(milliseconds / (60 * 60 * 1000));
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;

    if (days > 0) return `${days}d ${remainingHours}h remaining`;
    return `${Math.max(hours, 1)}h remaining`;

}

function getRaceParticipants(challenge) {

    return (challenge.progress || []).map(participant => ({
        ...participant,
        profile: (challenge.participantDetails || []).find(detail => detail.userId === participant.userId) || null,
        workoutDays: challenge.workoutDays?.[participant.userId] || []
    }));

}

function scanProgressRunnerFrame(canvas) {

    const { width, height } = canvas;
    const pixels = canvas.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, width, height).data;
    let left = width, top = height, right = -1, bottom = -1;

    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const alpha = pixels[(y * width + x) * 4 + 3];
            if (alpha <= 12) continue;
            left = Math.min(left, x);
            top = Math.min(top, y);
            right = Math.max(right, x);
            bottom = Math.max(bottom, y);
        }
    }

    return {
        left,
        top,
        right,
        bottom,
        width: Math.max(0, right - left + 1),
        height: Math.max(0, bottom - top + 1),
        groundGap: Math.max(0, height - 1 - bottom)
    };

}

function medianProgressValue(values) {

    const sorted = [...values].sort((first, second) => first - second);
    return sorted[Math.floor(sorted.length / 2)] || 0;

}

function loadProgressRunnerSprite(userId) {

    const source = PROGRESS_RUNNER_ASSETS_BY_ID[userId];
    if (!source) return Promise.resolve(null);
    if (progressRunnerSprites.has(userId)) return Promise.resolve(progressRunnerSprites.get(userId));
    if (progressRunnerLoads.has(userId)) return progressRunnerLoads.get(userId);

    const load = new Promise(resolve => {
        const image = new Image();
        image.onload = () => {
            const frames = [];

            for (let row = 0; row < 3; row += 1) {
                for (let column = 0; column < 3; column += 1) {
                    const left = Math.round(column * image.naturalWidth / 3);
                    const right = Math.round((column + 1) * image.naturalWidth / 3);
                    const top = Math.round(row * image.naturalHeight / 3);
                    const bottom = Math.round((row + 1) * image.naturalHeight / 3);
                    const frame = document.createElement("canvas");

                    frame.width = right - left;
                    frame.height = bottom - top;
                    frame.getContext("2d").drawImage(image, left, top, frame.width, frame.height, 0, 0, frame.width, frame.height);
                    frames.push({ canvas: frame, bounds: scanProgressRunnerFrame(frame) });
                }
            }

            const sprite = {
                frames,
                maxHeight: Math.max(...frames.map(frame => frame.bounds.height)),
                referenceGap: medianProgressValue(frames.map(frame => frame.bounds.groundGap))
            };

            progressRunnerSprites.set(userId, sprite);
            resolve(sprite);
        };
        image.onerror = () => resolve(null);
        image.src = source;
    });

    progressRunnerLoads.set(userId, load);
    return load;

}

function drawProgressRunner(canvas, sprite, frameIndex = 0) {

    if (!canvas || !sprite) return;
    const context = canvas.getContext("2d");
    const frame = sprite.frames[frameIndex] || sprite.frames[0];
    const { bounds } = frame;
    const scale = Math.min((canvas.width * .76) / sprite.maxHeight, (canvas.height * .84) / sprite.maxHeight);
    const width = bounds.width * scale;
    const height = bounds.height * scale;
    const bounce = Math.max(-5, Math.min(5, (sprite.referenceGap - bounds.groundGap) * scale));
    const baseline = canvas.height * .9 + bounce;

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(
        frame.canvas,
        bounds.left,
        bounds.top,
        bounds.width,
        bounds.height,
        (canvas.width - width) / 2,
        baseline - height,
        width,
        height
    );

}

function createProgressRunnerCanvas(userId, className) {

    const canvas = document.createElement("canvas");

    const isSceneRunner = className === "progress-scene-runner";

    canvas.className = className;
    canvas.width = isSceneRunner ? 296 : 64;
    canvas.height = isSceneRunner ? 368 : 64;
    canvas.setAttribute("aria-hidden", "true");
    loadProgressRunnerSprite(userId).then(sprite => {

        if (!sprite || !canvas.isConnected) return;
        drawProgressRunner(canvas, sprite, 0);

    });
    return canvas;

}

function animateProgressRunner(canvas, userId, duration = 2400) {

    if (!canvas || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    loadProgressRunnerSprite(userId).then(sprite => {

        if (!sprite || !canvas.isConnected) return;
        const startedAt = performance.now();
        let frameId = null;

        const tick = now => {

            if (frameId) progressRunnerAnimationFrames.delete(frameId);

            if (!canvas.isConnected || document.visibilityState === "hidden") {
                return;
            }

            const elapsed = now - startedAt;
            drawProgressRunner(canvas, sprite, 1 + Math.floor(elapsed / 100) % 8);
            if (elapsed < duration) {
                frameId = requestAnimationFrame(tick);
                progressRunnerAnimationFrames.add(frameId);
                return;
            }

            drawProgressRunner(canvas, sprite, 0);
            if (frameId) progressRunnerAnimationFrames.delete(frameId);

        };

        frameId = requestAnimationFrame(tick);
        progressRunnerAnimationFrames.add(frameId);

    });

}

function stopProgressRunnerAnimations() {

    progressRunnerAnimationFrames.forEach(frameId => cancelAnimationFrame(frameId));
    progressRunnerAnimationFrames.clear();

}

function createRaceAvatar(participant, lane) {

    const avatar = document.createElement("span");

    avatar.className = `progress-race-avatar lane-${lane}`;
    avatar.setAttribute("aria-label", participant.displayName || "GymPact athlete");
    avatar.appendChild(createProgressRunnerCanvas(participant.userId, "progress-road-runner"));
    return avatar;

}

function requirementTotal(participant, type) {

    const requirement = participant.requirements?.find(item => item.type === type);

    return {
        completed: Math.max(0, Number(requirement?.rawCompleted ?? requirement?.completed ?? 0)),
        target: Math.max(0, Number(requirement?.targetAmount ?? 0))
    };

}

function requirementCopy(type, count) {

    const unit = type === "steps" ? "steps" : type === "hiit" ? "HIIT session" : "workout";

    if (type === "steps") return unit;
    return `${unit}${count === 1 ? "" : "s"}`;

}

function createProgressScene({ idle = false, userId = null } = {}) {

    const scene = document.createElement("div");

    scene.className = `progress-scene${idle ? " is-idle" : ""}`;
    scene.setAttribute("aria-hidden", "true");
    scene.innerHTML = `
        <svg viewBox="0 0 360 360" preserveAspectRatio="none">
            <defs><linearGradient id="progress-sky" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#10251e"/><stop offset="1" stop-color="#0a1110"/></linearGradient></defs>
            <rect width="360" height="360" fill="url(#progress-sky)"/>
            <path d="M0 190c45-28 79-20 116-3 43-42 88-36 126-11 44-27 76-20 118 1v183H0z" fill="#102e22" opacity=".86"/>
            <path d="M0 226c58-8 99-2 138 15 41-20 98-23 150-2 27-4 50-2 72 5v116H0z" fill="#17201e"/>
            <rect y="286" width="360" height="17" fill="#3b4b43"/>
            <rect y="303" width="360" height="57" fill="#293632"/>
        </svg>
        <span class="progress-scene-runner-slot"></span>`;

    if (userId) scene.querySelector(".progress-scene-runner-slot").appendChild(createProgressRunnerCanvas(userId, "progress-scene-runner"));

    return scene;

}

function createProgressRoad({ empty = false } = {}) {

    const area = document.createElement("section");
    const labels = document.createElement("div");
    const road = document.createElement("div");

    area.className = "progress-road-area";
    labels.className = "progress-road-labels";
    labels.innerHTML = "<span>Start</span><span>Finish</span>";
    road.className = `progress-road${empty ? " is-empty" : ""}`;
    road.innerHTML = '<span class="progress-road-dashes" aria-hidden="true"></span>';
    area.append(labels, road);

    return { area, road };

}

function progressRaceStateKey(challenge, viewerId) {

    return `${PROGRESS_RACE_STATE_PREFIX}${viewerId}:${challenge.id}`;

}

function readProgressRaceState(challenge, viewerId) {

    try {

        return JSON.parse(sessionStorage.getItem(progressRaceStateKey(challenge, viewerId)) || "null") || { requirements: {}, initialized: false };

    } catch {

        return { requirements: {}, initialized: false };

    }

}

function getProgressRaceMotion(challenge, viewerId, requirementType, participants, sceneParticipantId = null) {

    const state = readProgressRaceState(challenge, viewerId);
    const next = Object.fromEntries(participants.map(participant => {

        const total = requirementTotal(participant, requirementType);
        const position = total.target > 0 ? Math.min(1, Math.max(0, total.completed / total.target)) : 0;
        return [participant.userId, position];

    }));
    const previous = state.requirements?.[requirementType];
    const motion = {};

    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {

        // Each requirement earns its own first-view entrance. This lets Steps and
        // HIIT race to their actual positions too, without replaying on every tab switch.
        if (!previous) {

            Object.entries(next).forEach(([userId, position]) => {

                if (position > 0) motion[userId] = { from: 0, to: position };

            });

        } else if (previous) {

            Object.entries(next).forEach(([userId, position]) => {

                const prior = Number(previous[userId] ?? position);
                if (position > prior) motion[userId] = { from: prior, to: position };

            });

        }

    }

    const sceneViews = state.sceneViews?.[requirementType] || {};
    const scenePosition = sceneParticipantId ? Number(next[sceneParticipantId] || 0) : 0;
    const sceneMotion = Boolean(
        sceneParticipantId && scenePosition > 0 &&
        (!sceneViews[sceneParticipantId] || motion[sceneParticipantId])
    );
    const nextState = {
        initialized: true,
        requirements: { ...(state.requirements || {}), [requirementType]: next },
        sceneViews: {
            ...(state.sceneViews || {}),
            [requirementType]: { ...sceneViews, ...(sceneParticipantId ? { [sceneParticipantId]: true } : {}) }
        }
    };

    sessionStorage.setItem(progressRaceStateKey(challenge, viewerId), JSON.stringify(nextState));
    return { next, motion, sceneMotion };

}

function positionToRoadPercent(position) {

    return 8 + Math.min(1, Math.max(0, position)) * 84;

}

function startProgressRaceMotion({ motion, roadAvatars, sceneRunner, viewerId, sceneMotion = false }) {

    const movingIds = Object.keys(motion);
    if ((!movingIds.length && !sceneMotion) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    requestAnimationFrame(() => requestAnimationFrame(() => {

        roadAvatars.forEach(({ participant, avatar }) => {

            const movement = motion[participant.userId];
            if (!movement) return;
            avatar.classList.add("is-racing");
            avatar.style.setProperty("--race-position", `${positionToRoadPercent(movement.to)}%`);
            animateProgressRunner(avatar.querySelector("canvas"), participant.userId);

        });

        if (sceneMotion) animateProgressRunner(sceneRunner, viewerId);

    }));

}

function renderProgressRace() {

    if (!progressRaceContainer) return;

    progressRaceContainer.innerHTML = "";

    if (currentChallengeLoadError) {

        progressRaceContainer.innerHTML = '<section class="progress-race-empty"><h3>Progress is unavailable</h3><p>We couldn’t load the active weekly Pact.</p></section>';
        const retry = document.createElement("button");
        retry.type = "button";
        retry.textContent = "Retry";
        retry.addEventListener("click", () => loadCurrentChallenge());
        progressRaceContainer.querySelector(".progress-race-empty").appendChild(retry);
        return;

    }

    const challenge = currentChallenge?.status === "active" ? currentChallenge : null;
    if (challenge) {

        const heading = document.createElement("header");
        const dateLine = document.createElement("p");
        const timeRemaining = document.createElement("span");

        heading.className = "progress-race-heading";
        dateLine.textContent = `${formatChallengeDate(challenge.startDate)} → ${formatChallengeDate(challenge.endDate)}`;
        timeRemaining.textContent = formatPactTimeRemaining(challenge);
        heading.append(dateLine, timeRemaining);
        progressRaceContainer.appendChild(heading);

    }

    const participants = challenge ? getRaceParticipants(challenge) : [];
    const viewerId = sessionStorage.getItem("gymPactSelectedAthleteId");
    const viewer = participants.find(participant => participant.userId === viewerId) || participants[0] || null;
    const stripParticipant = participants.find(participant => participant.userId === progressDayParticipantId) || viewer || participants[0] || null;

    if (challenge && !progressDayParticipantId && stripParticipant) progressDayParticipantId = stripParticipant.userId;

    // The participant switch controls the complete individual view: workout days,
    // headline totals, and the large scene runner. The road remains shared.
    const selectedParticipant = stripParticipant;

    const days = challenge ? addProgressDays(challenge.startDate, challenge.endDate) : Array.from({ length: 7 }, (_, index) => {

        const date = new Date();
        date.setDate(date.getDate() + index);
        return date.toISOString().slice(0, 10);

    });
    const strip = document.createElement("section");
    const stripHeader = document.createElement("div");
    const switcher = document.createElement("div");
    const dayButtons = document.createElement("div");
    const summary = document.createElement("div");

    strip.className = `progress-week-strip${challenge ? "" : " is-empty"}`;
    stripHeader.className = "progress-week-strip-header";
    switcher.className = "progress-person-switch";
    dayButtons.className = "progress-day-buttons";
    summary.className = "progress-day-summary";
    summary.setAttribute("role", "status");

    participants.forEach(participant => {

        const button = document.createElement("button");

        button.type = "button";
        button.textContent = participant.userId === viewerId ? "You" : participant.displayName;
        button.classList.toggle("is-active", participant.userId === stripParticipant?.userId);
        button.setAttribute("aria-pressed", String(participant.userId === stripParticipant?.userId));
        button.addEventListener("click", () => {

            progressDayParticipantId = participant.userId;
            progressSelectedDay = null;
            renderProgressRace();

        });
        switcher.appendChild(button);

    });

    days.forEach(date => {

        const button = document.createElement("button");
        const initial = document.createElement("span");
        const ring = document.createElement("span");
        const today = getCalendarDayInGymPactTimeZone() === date;
        const future = date > getCalendarDayInGymPactTimeZone();
        const workouts = stripParticipant?.workoutDays?.filter(workout => workout.date === date) || [];

        button.type = "button";
        button.className = "progress-day";
        button.classList.toggle("is-complete", workouts.length > 0);
        button.classList.toggle("is-today", today);
        button.classList.toggle("is-future", future);
        button.classList.toggle("is-selected", progressSelectedDay === date);
        button.disabled = !challenge;
        button.setAttribute("aria-label", `${formatProgressDay(date)}: ${workouts.length ? `${workouts.length} qualifying workout${workouts.length === 1 ? "" : "s"}` : "No qualifying workouts"}`);
        initial.textContent = formatProgressDayInitial(date);
        ring.setAttribute("aria-hidden", "true");
        button.append(initial, ring);
        button.addEventListener("click", () => {

            progressSelectedDay = date;
            renderProgressRace();

        });
        dayButtons.appendChild(button);

    });

    if (challenge && progressSelectedDay) {

        const workouts = stripParticipant?.workoutDays?.filter(workout => workout.date === progressSelectedDay) || [];
        const label = stripParticipant?.userId === viewerId ? "You" : stripParticipant?.displayName || "Your partner";

        summary.innerHTML = "";
        const title = document.createElement("strong");
        title.textContent = `${label} · ${formatProgressDay(progressSelectedDay)}`;
        const text = document.createElement("p");
        text.textContent = workouts.length
            ? workouts.map(workout => workout.activityName).join(" · ")
            : "No qualifying workout recorded for this day.";
        summary.append(title, text);

    }

    stripHeader.append(switcher);
    strip.append(stripHeader, dayButtons);
    if (challenge && progressSelectedDay) strip.appendChild(summary);
    progressRaceContainer.appendChild(strip);

    if (!challenge || !viewer || !challenge.requirements?.length) {

        const copy = document.createElement("div");
        const title = document.createElement("h3");
        const action = document.createElement("button");
        const { area: roadArea } = createProgressRoad({ empty: true });

        copy.className = "progress-race-empty-copy progress-race-idle-copy";
        title.textContent = "No active weekly Pact";
        action.type = "button";
        action.textContent = "+ Create Pact";
        action.addEventListener("click", startWeeklyPact);
        copy.append(title, action);
        progressRaceContainer.append(createProgressScene({ idle: true, userId: viewerId }), copy, roadArea);
        return;

    }

    if (!challenge.requirements.some(requirement => requirement.type === progressSelectedRequirementType)) {

        progressSelectedRequirementType = challenge.requirements[0].type;

    }

    const selectedType = progressSelectedRequirementType;
    const selectedRequirement = challenge.requirements.find(requirement => requirement.type === selectedType);
    const selector = document.createElement("div");
    const summaryCard = document.createElement("section");
    const value = requirementTotal(selectedParticipant, selectedType);
    const remaining = Math.max(0, value.target - value.completed);

    selector.className = "progress-goal-selector";
    selector.setAttribute("role", "tablist");
    challenge.requirements.forEach(requirement => {

        const button = document.createElement("button");

        button.type = "button";
        button.setAttribute("role", "tab");
        button.setAttribute("aria-selected", String(requirement.type === selectedType));
        button.classList.toggle("is-active", requirement.type === selectedType);
        const icon = document.createElement("img");
        icon.src = getRequirementIconPath(requirement.type);
        icon.alt = "";
        button.append(icon, document.createTextNode(getRequirementText(requirement.type)));
        button.addEventListener("click", () => {

            progressSelectedRequirementType = requirement.type;
            renderProgressRace();

        });
        selector.appendChild(button);

    });
    progressRaceContainer.appendChild(selector);

    summaryCard.className = "progress-goal-summary";
    summaryCard.innerHTML = `<p>${getRequirementText(selectedType)}</p><strong>${value.completed.toLocaleString()} / ${value.target.toLocaleString()}</strong><span>${remaining === 0 ? "Goal complete." : `${remaining.toLocaleString()} ${requirementCopy(selectedType, remaining)} to the finish.`}</span>`;
    progressRaceContainer.appendChild(summaryCard);

    const race = getProgressRaceMotion(challenge, viewerId, selectedType, participants, selectedParticipant.userId);
    const { area: roadArea, road } = createProgressRoad();
    const roadAvatars = [];

    participants.forEach((participant, index) => {

        const total = requirementTotal(participant, selectedType);
        const position = race.next[participant.userId] || 0;
        const avatar = createRaceAvatar(participant, index % 2);
        const movement = race.motion[participant.userId];

        // Keep the whole avatar inside the rounded road at both endpoints.
        avatar.style.setProperty("--race-position", `${positionToRoadPercent(movement?.from ?? position)}%`);
        road.appendChild(avatar);
        roadAvatars.push({ participant, avatar });

    });

    const scene = createProgressScene({ userId: selectedParticipant.userId });
    const sceneRunner = scene.querySelector("canvas");

    progressRaceContainer.append(scene, roadArea);
    startProgressRaceMotion({
        motion: race.motion,
        roadAvatars,
        sceneRunner,
        viewerId: selectedParticipant.userId,
        sceneMotion: race.sceneMotion
    });

}


function renderCurrentChallenge(challenge) {

    currentChallengeContainer.innerHTML = "";
    currentChallengeContainer.classList.remove("home-cycle-empty");


    if (!challenge) {

        renderNextWeekPactCard();
        if (activeDashboardTab === "progress") renderProgressRace();

        return;

    }


    const pactMeta = document.createElement("div");
    const timePeriod = document.createElement("p");

    pactMeta.classList.add("pact-card-meta");
    timePeriod.classList.add("challenge-period", "pact-card-period");
    timePeriod.textContent = `${formatChallengeDate(challenge.startDate)} → ${formatChallengeDate(challenge.endDate)}`;
    pactMeta.append(createChallengeStatusPill(challenge.status), timePeriod);
    currentChallengeContainer.appendChild(pactMeta);

    if (challenge.status === "active" && Array.isArray(challenge.progress)) {

        currentChallengeContainer.appendChild(createPactProgressOverview(challenge));
        celebratePactCompletion(challenge);

    }

    if (challenge.status === "pending" && Array.isArray(challenge.requirements)) {

        const requirements = document.createElement("div");
        const requirementsTitle = document.createElement("h4");

        requirements.classList.add("challenge-progress", "pact-requirements-preview");
        requirementsTitle.classList.add("challenge-progress-title");
        requirementsTitle.textContent = "Pact requirements";
        requirements.appendChild(requirementsTitle);
        sortRequirementsForDisplay(challenge.requirements).forEach(requirement => {
            appendRequirementTarget(requirements, requirement, challenge.timeframe);
        });
        currentChallengeContainer.appendChild(requirements);

    }

    appendChallengeDetail(
        currentChallengeContainer,
        "Wager",
        `${challenge.wagerType === "reward" ? "Reward" : "Punishment"}: ${challenge.wagerDescription}`
    );

    if (challenge.status !== "active") {

        appendChallengeDetail(
            currentChallengeContainer,
            "Pact status",
            getChallengeStatusText(challenge.status, challenge)
        );

    }

    if (challenge.status === "pending" && !isChallengeCreator(challenge)) {

        appendPendingChallengeActions(currentChallengeContainer);

    }

    if (activeDashboardTab === "progress") renderProgressRace();

}


async function loadCurrentChallenge({ preserveOnError = false } = {}) {

    const sessionToken = sessionStorage.getItem("gymPactSessionToken");

    if (!sessionToken) {

        currentChallenge = null;
        currentChallengeLoaded = true;
        currentChallengeLoadError = false;
        renderCurrentChallenge(currentChallenge);

        return;

    }

    const supabase = GymPactSupabase.getClient();
    const { data, error } = await supabase.functions.invoke(
        "get-current-pact",
        { body: { sessionToken } }
    );

    if (error) {

        console.error("Unable to load the current Pact.", error);

        currentChallengeLoadError = true;

        if (preserveOnError) {

            throw error;

        }

        currentChallenge = null;

    } else {

        currentChallenge = data?.pact || null;
        currentChallengeLoadError = false;

    }

    currentChallengeLoaded = true;
    renderCurrentChallenge(currentChallenge);

}


function setDashboardRefreshFeedback(message = "") {

    dashboardRefreshFeedback.textContent = message;
    dashboardRefreshFeedback.hidden = !message;

}


async function refreshDashboard() {

    if (dashboardRefreshInFlight) {

        return dashboardRefreshInFlight;

    }

    dashboardRefreshInFlight = (async () => {

        if (dashboardRefreshButton) {

            dashboardRefreshButton.disabled = true;
            dashboardRefreshButton.classList.add("is-loading");
            dashboardRefreshButton.setAttribute("aria-busy", "true");
            dashboardRefreshButton.textContent = "Refreshing";

        }
        setDashboardRefreshFeedback();

        try {

            await Promise.all([
                loadCurrentChallenge({ preserveOnError: true }),
                loadDashboardMetrics({ preserveOnError: true }),
                loadExerciseTrackers({ preserveOnError: true }),
                loadMonthlyPact({ preserveOnError: true })
            ]);

        } catch (error) {

            console.error("Unable to refresh the dashboard.", error);
            setDashboardRefreshFeedback(
                "Couldn't refresh right now. Your current data is still shown."
            );

        } finally {

            if (dashboardRefreshButton) {

                dashboardRefreshButton.disabled = false;
                dashboardRefreshButton.classList.remove("is-loading");
                dashboardRefreshButton.removeAttribute("aria-busy");
                dashboardRefreshButton.textContent = "↻ Refresh";

            }

        }

    })();

    try {

        await dashboardRefreshInFlight;

    } finally {

        dashboardRefreshInFlight = null;

    }

}

function monthlyRequest(action, extra = {}) {
    const sessionToken = sessionStorage.getItem("gymPactSessionToken");
    const userId = sessionStorage.getItem("gymPactSelectedAthleteId");
    return GymPactSupabase.getClient().functions.invoke("monthly-pacts", {
        body: { action, sessionToken, userId, ...extra }
    });
}

function formatMonthDate(date) {
    return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatMonthPactCompletion(timestamp) {
    if (!timestamp) return "Completed";
    return new Intl.DateTimeFormat(undefined, {
        timeZone: "America/New_York", month: "long", day: "numeric", year: "numeric"
    }).format(new Date(timestamp));
}

function currentMonthDate() {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" })
        .formatToParts().reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
}

function getMonthlyDefaultSelectedDate(pact) {
    const parts = currentMonthDate();
    const today = `${parts.year}-${parts.month}-${parts.day}`;
    const checkins = pact.checkins || [];
    const latestCheckin = [...checkins].sort((first, second) => second.date.localeCompare(first.date))[0];

    if (pact.status === "active" && today >= pact.monthStart && today <= pact.monthEnd) {
        return today;
    }

    return latestCheckin?.date || pact.monthStart;
}

function closeMonthlyCheckinPopover() {
    if (monthlyCheckinPopoverDismiss) {
        document.removeEventListener("pointerdown", monthlyCheckinPopoverDismiss, true);
        document.removeEventListener("keydown", monthlyCheckinPopoverDismiss, true);
    }
    monthlyCheckinPopoverDismiss = null;
    monthlyCheckinPopover?.remove();
    monthlyCheckinPopover = null;
}

function openMonthlyCheckinPopover(pact, date, anchor) {
    closeMonthlyCheckinPopover();

    const entries = (pact.checkins || []).filter(entry => entry.date === date);
    const popover = document.createElement("aside");
    popover.className = "monthly-checkin-popover";
    popover.setAttribute("role", "dialog");
    popover.setAttribute("aria-label", `Check-ins for ${formatMonthDate(date)}`);

    const title = document.createElement("strong");
    title.textContent = formatMonthDate(date);
    popover.appendChild(title);

    if (entries.length) {
        entries.forEach(entry => {
            const entryNode = document.createElement("div");
            entryNode.className = "monthly-checkin-popover-entry";
            const author = document.createElement("span");
            author.textContent = entry.displayName;
            const body = document.createElement("p");
            body.textContent = entry.body;
            entryNode.append(author, body);
            popover.appendChild(entryNode);
        });
    } else {
        const empty = document.createElement("p");
        empty.className = "monthly-checkin-popover-empty";
        empty.textContent = "No check-in yet.";
        popover.appendChild(empty);
    }

    const parts = currentMonthDate();
    const today = `${parts.year}-${parts.month}-${parts.day}`;
    if (pact.status === "active" && date <= today) {
        const addCheckin = document.createElement("button");
        addCheckin.type = "button";
        addCheckin.className = "monthly-checkin-popover-action";
        addCheckin.textContent = entries.length ? "+ Add another check-in" : "+ Add check-in";
        addCheckin.addEventListener("click", () => {
            closeMonthlyCheckinPopover();
            openMonthlyCheckin(date);
        });
        popover.appendChild(addCheckin);
    }

    document.body.appendChild(popover);
    const anchorRect = anchor.getBoundingClientRect();
    const width = Math.min(280, window.innerWidth - 32);
    const left = Math.max(16, Math.min(anchorRect.left + (anchorRect.width / 2) - (width / 2), window.innerWidth - width - 16));
    popover.style.width = `${width}px`;
    popover.style.left = `${left}px`;
    let top = anchorRect.bottom + 8;
    if (top + popover.offsetHeight > window.innerHeight - 16) top = Math.max(16, anchorRect.top - popover.offsetHeight - 8);
    popover.style.top = `${top}px`;

    monthlyCheckinPopover = popover;
    monthlyCheckinPopoverDismiss = event => {
        if (event.type === "keydown") {
            if (event.key === "Escape") closeMonthlyCheckinPopover();
            return;
        }
        if (!popover.contains(event.target) && !anchor.contains(event.target)) closeMonthlyCheckinPopover();
    };
    requestAnimationFrame(() => {
        if (monthlyCheckinPopover !== popover) return;
        document.addEventListener("pointerdown", monthlyCheckinPopoverDismiss, true);
        document.addEventListener("keydown", monthlyCheckinPopoverDismiss, true);
    });
}

function renderMonthlyCalendar(pact, container, { interactive = true } = {}) {
    const calendar = document.createElement("div");
    calendar.className = "monthly-calendar";
    ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach(day => {
        const label = document.createElement("span"); label.className = "monthly-calendar-weekday"; label.textContent = day; calendar.appendChild(label);
    });
    const start = new Date(`${pact.monthStart}T12:00:00`);
    const days = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    const checkinDates = new Set((pact.checkins || []).map(checkin => checkin.date));
    const parts = currentMonthDate();
    const today = `${parts.year}-${parts.month}-${parts.day}`;
    for (let index = 0; index < start.getDay(); index += 1) calendar.appendChild(document.createElement("span"));
    for (let day = 1; day <= days; day += 1) {
        const date = `${pact.monthStart.slice(0, 8)}${String(day).padStart(2, "0")}`;
        const button = document.createElement("button"); button.type = "button"; button.className = "monthly-calendar-day"; button.textContent = day;
        if (date === today) button.classList.add("is-today");
        if (checkinDates.has(date)) button.classList.add("has-checkin");
        if (interactive && date === monthlySelectedDate) button.classList.add("is-selected");
        if (!interactive || (pact.status === "active" && date > today)) button.disabled = true;
        if (interactive) {
            button.addEventListener("click", () => {
                monthlySelectedDate = date;
                calendar.querySelectorAll(".monthly-calendar-day.is-selected").forEach(dayButton => dayButton.classList.remove("is-selected"));
                button.classList.add("is-selected");
                openMonthlyCheckinPopover(pact, date, button);
            });
        }
        calendar.appendChild(button);
    }
    container.appendChild(calendar);
}

function renderHomeMonthPact() {

    if (!homeMonthPactContent) return;

    homeMonthPactContent.innerHTML = "";
    const card = document.createElement("article");
    const title = document.createElement("h3");
    const action = document.createElement("button");

    card.className = "home-month-card";

    if (!monthlyPact) {

        const label = monthlyCandidate?.candidateLabel || new Intl.DateTimeFormat(undefined, {
            timeZone: "America/New_York",
            month: "long",
            year: "numeric"
        }).format(new Date(`${currentMonthDate().year}-${currentMonthDate().month}-01T12:00:00Z`));
        const monthName = new Intl.DateTimeFormat(undefined, {
            timeZone: "America/New_York",
            month: "long"
        }).format(new Date(`${currentMonthDate().year}-${currentMonthDate().month}-01T12:00:00Z`));

        card.classList.add("home-cycle-empty", "home-cycle-compact");
        title.className = "home-cycle-date";
        title.textContent = label;
        action.className = "home-cycle-action";
        action.type = "button";
        action.textContent = `+ Create ${monthName} Pact`;
        action.addEventListener("click", openMonthlyCreate);
        card.append(title, action);

    } else {

        const statusLabels = {
            active: "Active",
            pending: "Pending",
            upcoming: "Upcoming",
            completed: "Pact Complete",
            failed: "Pact Failed"
        };

        card.classList.add("home-cycle-compact");
        title.className = "home-cycle-date";
        title.textContent = monthlyPact.monthLabel;
        action.className = "home-cycle-secondary-action";
        action.type = "button";
        action.textContent = `${statusLabels[monthlyPact.status] || "View Pact"} →`;
        action.addEventListener("click", () => {
            showDashboardTab("pact");
            showPactType("monthly");
        });
        card.append(title, action);

    }

    homeMonthPactContent.appendChild(card);

}

function renderMonthPact() {
    if (!monthPactContent) return;
    closeMonthlyCheckinPopover();
    monthPactContent.innerHTML = "";
    const card = document.createElement("article"); card.className = "month-pact-card";
    const athleteId = sessionStorage.getItem("gymPactSelectedAthleteId");
    if (!monthlyPact) {
        const candidateMonth = monthlyCandidate?.candidateMonth || `${currentMonthDate().year}-${currentMonthDate().month}-01`;
        const label = monthlyCandidate?.candidateLabel || new Intl.DateTimeFormat(undefined, { timeZone: "America/New_York", month: "long", year: "numeric" }).format(new Date(`${candidateMonth}T12:00:00Z`));
        const monthName = new Intl.DateTimeFormat(undefined, { timeZone: "America/New_York", month: "long" }).format(new Date(`${candidateMonth}T12:00:00Z`));

        card.innerHTML = `<p class="month-pact-kicker">This Month’s Pact</p><h3>${label}</h3>`;
        const create = document.createElement("button"); create.type = "button"; create.className = "month-pact-action"; create.textContent = `+ Create ${monthName} Pact`; create.addEventListener("click", openMonthlyCreate); card.appendChild(create);
        renderMonthlyCalendar({ monthStart: candidateMonth, checkins: [], status: "unavailable" }, card, { interactive: false });
        monthPactContent.appendChild(card); return;
    }
    const creator = monthlyPact.createdBy === athleteId;
    const own = monthlyPact.commitments.find(item => item.userId === athleteId);
    const isFinalized = ["completed", "failed"].includes(monthlyPact.status);
    if (monthlySelectedPactId !== monthlyPact.id) {
        monthlySelectedPactId = monthlyPact.id;
        monthlySelectedDate = getMonthlyDefaultSelectedDate(monthlyPact);
    }
    const statusLabel = monthlyPact.status === "completed" ? `✓ Completed ${formatMonthPactCompletion(monthlyPact.finalizedAt)}`
        : monthlyPact.status === "failed" ? "Pact Failed"
        : `Month Pact · ${monthlyPact.status}`;
    const statusCopy = monthlyPact.status === "pending"
        ? (creator ? "Waiting for your partner to add their goal and sign." : "Review the pledge, add your goal, and sign to begin.")
        : monthlyPact.status === "upcoming" ? "Both athletes have signed the Pact."
            : monthlyPact.status === "completed" ? ""
                : monthlyPact.status === "failed" ? "The month ended before both individual goals were achieved."
                    : "";
    if (monthlyPact.status === "active") {
        const heading = document.createElement("div");
        const title = document.createElement("h3");

        heading.className = "month-pact-active-heading";
        title.textContent = monthlyPact.monthLabel;
        heading.append(title, createChallengeStatusPill("active"));
        card.appendChild(heading);
    } else {
        card.innerHTML = `<p class="month-pact-kicker ${isFinalized ? "month-pact-final-status" : ""}">${statusLabel}</p><h3>${monthlyPact.monthLabel}</h3>${statusCopy ? `<p class="month-pact-copy">${statusCopy}</p>` : ""}`;
    }
    const people = document.createElement("div"); people.className = "month-pact-people";
    monthlyPact.commitments.forEach(item => {
        const person = document.createElement("div"); person.className = "month-pact-person";
        const label = isFinalized ? (item.userId === athleteId ? "Your goal" : `${item.displayName}'s goal`) : item.displayName;
        const achieved = item.completedByDeadline ?? Boolean(item.completedAt);
        const result = achieved ? (isFinalized ? "✓ Achieved" : "✓ Goal achieved") : (monthlyPact.status === "failed" ? "Not achieved" : "");
        person.innerHTML = `<strong>${label}</strong><span>${item.goal}</span>${result ? `<span class="${achieved ? "month-pact-complete" : "month-pact-incomplete"}">${result}</span>` : ""}`;
        people.appendChild(person);
    });
    card.appendChild(people);
    const consequence = document.createElement("div"); consequence.className = "month-pact-detail";
    consequence.innerHTML = `<h4>${isFinalized ? "The consequence" : "Shared consequence"}</h4><p>${monthlyPact.consequence}</p>${monthlyPact.status === "completed" ? '<span class="month-pact-complete">Avoided ✓</span>' : monthlyPact.status === "failed" ? '<span class="month-pact-incomplete">Applies</span>' : ""}`;
    card.appendChild(consequence);
    if (monthlyPact.status === "pending" && !creator) { const sign = document.createElement("button"); sign.type = "button"; sign.className = "month-pact-action"; sign.textContent = "Review & sign"; sign.addEventListener("click", openMonthlySign); card.appendChild(sign); }
    if (["active", "completed", "failed"].includes(monthlyPact.status)) {
        renderMonthlyCalendar(monthlyPact, card);
        if (monthlyPact.status === "active" && own && !own.completedAt) { const complete = document.createElement("button"); complete.type = "button"; complete.className = "month-pact-action"; complete.textContent = "✓ I Achieved My Goal"; complete.addEventListener("click", openMonthlyCompletion); card.appendChild(complete); }
    }
    monthPactContent.appendChild(card);
}

async function loadMonthlyPact({ preserveOnError = false } = {}) {
    if (!monthPactContent) return;
    try { const { data, error } = await monthlyRequest("get"); if (error) throw error; monthlyPact = data?.pact || null; monthlyCandidate = data || null; renderMonthPact(); renderHomeMonthPact(); }
    catch (error) { console.error("Unable to load Month Pact.", error); if (preserveOnError) throw error; monthPactContent.innerHTML = '<p class="month-pact-copy">We couldn’t load the Month Pact. Please refresh and try again.</p>'; homeMonthPactContent.innerHTML = '<p class="month-pact-copy">We couldn’t load the Month Pact. Please refresh and try again.</p>'; }
}

const modal = id => document.getElementById(id);
function setMonthlyError(id, message = "") { const element = modal(id); element.textContent = message; element.hidden = !message; }
function showMonthlyStep(detailsId, pledgeId, showPledge) { modal(detailsId).hidden = showPledge; modal(pledgeId).hidden = !showPledge; }
function monthPactDeadline(pact) { return new Date(`${pact.monthEnd}T12:00:00`).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }); }
function monthEndForStart(monthStart) { const date = new Date(`${monthStart}T12:00:00`); return new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().slice(0, 10); }
function openMonthlyCreate() {
    modal("monthly-pact-create-modal").style.display = "flex";
    modal("monthly-create-copy").textContent = monthlyCandidate?.candidateLabel || "Upcoming month";
    modal("monthly-goal").value = ""; modal("monthly-consequence").value = ""; modal("monthly-signature").value = "";
    showMonthlyStep("monthly-create-details-step", "monthly-create-pledge-step", false); setMonthlyError("monthly-create-error"); setMonthlyError("monthly-create-pledge-error");
}
function openMonthlySign() {
    modal("monthly-pact-sign-modal").style.display = "flex";
    const sender = monthlyPact.commitments.find(item => item.userId === monthlyPact.createdBy);
    modal("monthly-sign-copy").textContent = `${sender?.displayName || "Your partner"}’s goal: ${sender?.goal || "Not available"}. Shared consequence: ${monthlyPact.consequence}`;
    modal("monthly-sign-goal").value = ""; modal("monthly-signature-input").value = "";
    showMonthlyStep("monthly-sign-goal-step", "monthly-sign-pledge-step", false); setMonthlyError("monthly-sign-error"); setMonthlyError("monthly-sign-pledge-error");
}
function openMonthlyCheckin(date) { monthlyCheckinDate = date; modal("monthly-checkin-date").textContent = formatMonthDate(date); modal("monthly-checkin-text").value = ""; setMonthlyError("monthly-checkin-error"); modal("monthly-checkin-modal").style.display = "flex"; }
function openMonthlyCompletion() { modal("monthly-completion-photo").value = ""; setMonthlyError("monthly-completion-error"); modal("monthly-completion-modal").style.display = "flex"; }

modal("cancel-monthly-create").addEventListener("click", () => { modal("monthly-pact-create-modal").style.display = "none"; });
modal("next-monthly-create").addEventListener("click", () => {
    const goal = modal("monthly-goal").value.trim(), consequence = modal("monthly-consequence").value.trim();
    if (!goal || !consequence) return setMonthlyError("monthly-create-error", "Add your goal and shared consequence.");
    const deadline = monthPactDeadline({ monthEnd: monthEndForStart(monthlyCandidate.candidateMonth) });
    modal("monthly-create-pledge").textContent = `I, ${profileDisplayName}, commit to achieving ${goal} by ${deadline}.`;
    modal("monthly-create-pledge-consequence").textContent = consequence;
    showMonthlyStep("monthly-create-details-step", "monthly-create-pledge-step", true); setMonthlyError("monthly-create-pledge-error");
});
modal("back-monthly-create").addEventListener("click", () => { showMonthlyStep("monthly-create-details-step", "monthly-create-pledge-step", false); });
modal("save-monthly-create").addEventListener("click", async () => {
    const button = modal("save-monthly-create"), goal = modal("monthly-goal").value.trim(), consequence = modal("monthly-consequence").value.trim(), signature = modal("monthly-signature").value.trim();
    if (!signature) return setMonthlyError("monthly-create-pledge-error", "Add your initials to send this Pact.");
    button.disabled = true; try { const { error } = await monthlyRequest("create", { goal, consequence, signature }); if (error) throw error; modal("monthly-pact-create-modal").style.display = "none"; await loadMonthlyPact(); } catch (error) { setMonthlyError("monthly-create-error", "We couldn’t create that Month Pact. Please try again."); } finally { button.disabled = false; }
});
modal("decline-monthly-pact").addEventListener("click", async () => { const button = modal("decline-monthly-pact"); button.disabled = true; try { const { error } = await monthlyRequest("decline", { pactId: monthlyPact.id }); if (error) throw error; modal("monthly-pact-sign-modal").style.display = "none"; await loadMonthlyPact(); } catch { setMonthlyError("monthly-sign-error", "We couldn’t decline that Pact. Please try again."); } finally { button.disabled = false; } });
modal("next-monthly-sign").addEventListener("click", () => {
    const goal = modal("monthly-sign-goal").value.trim();
    if (!goal) return setMonthlyError("monthly-sign-error", "Add your individual goal.");
    modal("monthly-sign-pledge").textContent = `I, ${profileDisplayName}, commit to achieving ${goal} by ${monthPactDeadline(monthlyPact)}.`;
    modal("monthly-sign-pledge-consequence").textContent = monthlyPact.consequence;
    showMonthlyStep("monthly-sign-goal-step", "monthly-sign-pledge-step", true); setMonthlyError("monthly-sign-pledge-error");
});
modal("back-monthly-sign").addEventListener("click", () => { showMonthlyStep("monthly-sign-goal-step", "monthly-sign-pledge-step", false); });
modal("save-monthly-sign").addEventListener("click", async () => {
    const button = modal("save-monthly-sign"), goal = modal("monthly-sign-goal").value.trim(), signature = modal("monthly-signature-input").value.trim();
    if (!signature) return setMonthlyError("monthly-sign-pledge-error", "Add your initials to sign and accept.");
    button.disabled = true; try { const { error } = await monthlyRequest("sign", { pactId: monthlyPact.id, goal, signature }); if (error) throw error; modal("monthly-pact-sign-modal").style.display = "none"; await loadMonthlyPact(); } catch { setMonthlyError("monthly-sign-error", "We couldn’t sign that Pact. Please try again."); } finally { button.disabled = false; }
});
modal("cancel-monthly-checkin").addEventListener("click", () => { modal("monthly-checkin-modal").style.display = "none"; });
modal("save-monthly-checkin").addEventListener("click", async () => {
    const button = modal("save-monthly-checkin"), body = modal("monthly-checkin-text").value.trim(); if (!body) return setMonthlyError("monthly-checkin-error", "Write a short check-in first.");
    button.disabled = true; try { const { error } = await monthlyRequest("checkin", { pactId: monthlyPact.id, date: monthlyCheckinDate, body }); if (error) throw error; modal("monthly-checkin-modal").style.display = "none"; await loadMonthlyPact(); } catch { setMonthlyError("monthly-checkin-error", "We couldn’t save that check-in. Please try again."); } finally { button.disabled = false; }
});
modal("cancel-monthly-completion").addEventListener("click", () => { modal("monthly-completion-modal").style.display = "none"; });
modal("save-monthly-completion").addEventListener("click", async () => {
    const button = modal("save-monthly-completion"), photo = modal("monthly-completion-photo").files[0], sessionToken = sessionStorage.getItem("gymPactSessionToken"), userId = sessionStorage.getItem("gymPactSelectedAthleteId");
    if (!photo) return setMonthlyError("monthly-completion-error", "Choose a proof photo.");
    button.disabled = true;
    try {
        const photoData = await prepareWorkoutPhoto(photo);

        if (!photoData) throw new Error("We couldn’t prepare that photo. Please choose it again.");

        const photoBlob = await fetch(photoData).then(response => response.blob());
        const form = new FormData(); form.append("sessionToken", sessionToken); form.append("pactId", monthlyPact.id); form.append("userId", userId); form.append("photo", photoBlob, "monthly-pact-proof.jpg");
        const { error } = await GymPactSupabase.getClient().functions.invoke("complete-monthly-goal", { body: form });

        if (error) {
            const details = await error.context?.json().catch(() => null);

            throw new Error(details?.error || "We couldn’t save your proof. Please try again.");
        }

        modal("monthly-completion-modal").style.display = "none";
        activityWorkoutsLoaded = false;
        activityHasMore = true;
        activityNextCursor = null;
        if (activeDashboardTab === "activity") await loadActivityWorkouts({ reset: true });
        await loadMonthlyPact();

    } catch (error) {

        console.error("Unable to save Month Pact proof.", error);
        setMonthlyError("monthly-completion-error", error.message || "We couldn’t save your proof. Please try again.");

    } finally { button.disabled = false; }
});


renderCurrentChallenge(currentChallenge);
dashboardTabs.forEach(button => {

    button.addEventListener("click", () => {

        showDashboardTab(button.id.replace("-tab", ""));

    });

});
const requestedDashboardTab = new URLSearchParams(window.location.search).get("tab");

showDashboardTab(["activity", "progress", "pact", "track"].includes(requestedDashboardTab) ? requestedDashboardTab : requestedDashboardTab === "month" ? "pact" : "overview");
if (requestedDashboardTab === "month") showPactType();
if (dashboardRefreshButton) {

    dashboardRefreshButton.addEventListener("click", refreshDashboard);

}

document.addEventListener("visibilitychange", () => {

    if (document.visibilityState === "hidden") {

        stopProgressRunnerAnimations();
        return;

    }

    if (document.visibilityState === "visible") {

        refreshDashboard();

    }

});

refreshDashboard();
renderProfileAvatar();
loadProfilePhoto();

profileMenuButton.addEventListener("click", () => {
    if (profileActionsMenu.hidden) openProfileMenu();
    else closeProfileMenu({ restoreFocus: true });
});
openProfilePageButton.addEventListener("click", openProfilePage);
openProfileHistoryButton.addEventListener("click", () => {
    window.location.href = "history.html?view=pacts";
});
closeProfilePageButton.addEventListener("click", closeProfilePage);
openProfilePhotoButton.addEventListener("click", () => profilePhotoInput.click());
profilePhotoInput.addEventListener("change", handleProfilePhotoSelection);
profileDisplayNameInput.addEventListener("input", () => {
    setProfilePageError(profileDisplayNameInput.value.trim() ? "" : "Enter a display name.");
    renderProfileDraftAvatar();
    updateProfileSaveState();
});
clearProfilePhotoButton.addEventListener("click", () => {
    if (profileDraftPhotoUrl) URL.revokeObjectURL(profileDraftPhotoUrl);
    profileDraftPhoto = null;
    profileDraftPhotoUrl = "";
    profileDraftPhotoRemoved = true;
    profilePhotoInput.value = "";
    clearProfilePhotoButton.hidden = true;
    setProfilePageError();
    renderProfileDraftAvatar();
    updateProfileSaveState();
});
profilePageForm.addEventListener("submit", saveProfileChanges);
document.addEventListener("pointerdown", event => {
    if (!profileActionsMenu.hidden && !event.target.closest(".profile-menu-wrapper")) closeProfileMenu();
});
document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        if (!profileActionsMenu.hidden) closeProfileMenu({ restoreFocus: true });
        else if (!profilePage.hidden) closeProfilePage();
    }
});

const challengeActiveModal =
    document.getElementById("challenge-active-modal");

const cancelChallengeModal =
    document.getElementById("cancel-challenge-modal");

const openCancelChallengeModalButton =
    document.getElementById("open-cancel-challenge-modal");

const confirmCancelChallengeButton =
    document.getElementById("confirm-cancel-challenge");

const keepChallengeButton =
    document.getElementById("keep-challenge");
const newPactChoiceModal = document.getElementById("new-pact-choice-modal");
let quickActionPreviousFocus = null;

function closeQuickActionMenu({ restoreFocus = false } = {}) {

    if (!quickActionMenu || !quickActionToggle || !quickActionBackdrop) return;

    quickActionMenu.hidden = true;
    quickActionBackdrop.hidden = true;
    quickActionToggle.setAttribute("aria-expanded", "false");
    quickActionToggle.setAttribute("aria-label", "Open quick actions");

    if (restoreFocus && quickActionPreviousFocus instanceof HTMLElement) {

        quickActionPreviousFocus.focus();

    }

    quickActionPreviousFocus = null;

}

function openQuickActionMenu() {

    if (!quickActionMenu || !quickActionToggle || !quickActionBackdrop) return;

    quickActionPreviousFocus = document.activeElement;
    quickActionMenu.hidden = false;
    quickActionBackdrop.hidden = false;
    quickActionToggle.setAttribute("aria-expanded", "true");
    quickActionToggle.setAttribute("aria-label", "Close quick actions");
    quickActionMenu.querySelector("button")?.focus();

}

function toggleQuickActionMenu() {

    if (quickActionMenu?.hidden) openQuickActionMenu();
    else closeQuickActionMenu({ restoreFocus: true });

}

function closeQuickExerciseModal() {

    quickExerciseModal.style.display = "none";
    quickExerciseOptions.innerHTML = "";

}

function addQuickExerciseChoice(label, onChoose) {

    const button = document.createElement("button");

    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", onChoose);
    quickExerciseOptions.appendChild(button);

}

async function openQuickExercise() {

    closeQuickActionMenu();

    try {

        if (!exerciseTrackersLoaded) await loadExerciseTrackers({ preserveOnError: true });

        quickExerciseOptions.innerHTML = "";
        const activeTrackers = exerciseTrackers.filter(
            tracker => tracker.status === "active"
        );
        const activeTrackerNames = new Set(
            activeTrackers.map(tracker => tracker.exerciseName)
        );
        const availableTrackers = ["Pushups", "Pullups", "Steps"].filter(
            exerciseName => !activeTrackerNames.has(exerciseName)
        );

        if (availableTrackers.length) {

            quickExerciseTitle.textContent = "Set up a tracker";

            availableTrackers.forEach(exerciseName => {

                addQuickExerciseChoice(`Track ${exerciseName}`, () => {

                    closeQuickExerciseModal();
                    openExerciseTargetModal(exerciseName);

                });

            });

        } else {

            quickExerciseTitle.textContent = "Update a tracker";

            activeTrackers.forEach(tracker => {

                const target = tracker.exerciseName === "Steps"
                    ? tracker.targetSteps
                    : tracker.targetReps;

                addQuickExerciseChoice(`Update ${tracker.exerciseName}`, () => {

                    closeQuickExerciseModal();
                    openExerciseTargetModal(tracker.exerciseName, target, false);

                });

            });

        }

        quickExerciseModal.style.display = "flex";

    } catch (error) {

        console.error("Unable to open exercise logging.", error);
        alert("We couldn't load your trackers. Please try again.");

    }

}

async function openQuickMonthlyPact() {

    closeQuickActionMenu();
    await loadMonthlyPact();

    showDashboardTab("pact");
    showPactType("monthly");

    if (!monthlyPact) openMonthlyCreate();

}

function dismissSheet(sheet) {

    sheet.style.display = "none";
    const content = sheet.querySelector(".modal-content");

    if (content) {

        content.style.transform = "";

    }

}

function makeSheetDismissible(sheet) {

    const content = sheet.querySelector(".modal-content");
    let startY = null;

    sheet.addEventListener("click", event => {

        if (event.target === sheet) {

            dismissSheet(sheet);

        }

    });

    content.addEventListener("pointerdown", event => {

        startY = event.clientY;

    });

    content.addEventListener("pointermove", event => {

        if (startY === null) return;

        const distance = Math.max(0, event.clientY - startY);

        if (distance > 0) {

            content.style.transform = `translateY(${distance}px)`;

        }

    });

    content.addEventListener("pointerup", event => {

        if (startY !== null && event.clientY - startY > 72) {

            dismissSheet(sheet);

        } else {

            content.style.transform = "";

        }

        startY = null;

    });

    content.addEventListener("pointercancel", () => {

        startY = null;
        content.style.transform = "";

    });

}

makeSheetDismissible(newPactChoiceModal);
makeSheetDismissible(challengeActiveModal);


async function startWeeklyPact() {

    if (!currentChallengeLoaded) {

        await loadCurrentChallenge();

    }

    if (!currentChallenge) {

        window.location.href = `create-pact.html?returnTab=${encodeURIComponent(activeDashboardTab)}`;

        return;

    }

    challengeActiveModal.style.display = "flex";

}

quickActionToggle.addEventListener("click", toggleQuickActionMenu);
quickActionBackdrop.addEventListener("click", () => closeQuickActionMenu({ restoreFocus: true }));

document.querySelectorAll("[data-quick-action]").forEach(button => {

    button.addEventListener("click", async () => {

        const action = button.dataset.quickAction;

        if (action === "exercise") {

            closeQuickActionMenu();
            workoutModal.style.display = "flex";

        }
        if (action === "tracker") await openQuickExercise();
        if (action === "week-pact") {

            closeQuickActionMenu();
            await startWeeklyPact();

        }
        if (action === "month-pact") await openQuickMonthlyPact();
        if (action === "dev-view") {

            closeQuickActionMenu();
            window.location.href = "preview-layout.html";

        }

    });

});

cancelQuickExerciseButton.addEventListener("click", closeQuickExerciseModal);
quickExerciseModal.addEventListener("click", event => {

    if (event.target === quickExerciseModal) closeQuickExerciseModal();

});

document.addEventListener("keydown", event => {

    if (event.key === "Escape" && !quickActionMenu.hidden) {

        event.preventDefault();
        closeQuickActionMenu({ restoreFocus: true });

    }

});

document.getElementById("choose-weekly-pact").addEventListener("click", async () => {
    newPactChoiceModal.style.display = "none";
    await startWeeklyPact();
});

document.getElementById("choose-monthly-pact").addEventListener("click", async () => {
    newPactChoiceModal.style.display = "none";
    showDashboardTab("pact");
    showPactType("monthly");
    await loadMonthlyPact();
    if (!monthlyPact) openMonthlyCreate();
});

openCancelChallengeModalButton.addEventListener("click", () => {

    challengeActiveModal.style.display = "none";
    cancelChallengeModal.style.display = "flex";

});


keepChallengeButton.addEventListener("click", () => {

    cancelChallengeModal.style.display = "none";

});


confirmCancelChallengeButton.addEventListener("click", async () => {

    const sessionToken = sessionStorage.getItem("gymPactSessionToken");

    if (!sessionToken || !currentChallenge) {

        return;

    }

    confirmCancelChallengeButton.disabled = true;

    try {

        const supabase = GymPactSupabase.getClient();
        const { error } = await supabase.functions.invoke(
            "cancel-pact",
            { body: { sessionToken, pactId: currentChallenge.id } }
        );

        if (error) {

            throw error;

        }

        cancelChallengeModal.style.display = "none";
        await loadCurrentChallenge();

    } catch (error) {

        console.error("Unable to cancel Pact.", error);
        alert("We couldn't cancel that Pact. Please try again.");

    } finally {

        confirmCancelChallengeButton.disabled = false;

    }

});

const openModalButton =
    document.getElementById("open-workout-modal");

const closeModalButton =
    document.getElementById("close-workout-modal");

const workoutModal =
    document.getElementById("workout-modal");


if (openModalButton) {

    openModalButton.addEventListener("click", () => {

        workoutModal.style.display = "flex";

    });

}

if (new URLSearchParams(window.location.search).get("action") === "workout") {

    workoutModal.style.display = "flex";

}


closeModalButton.addEventListener("click", () => {

    workoutModal.style.display = "none";

});

workoutModal.addEventListener("click", event => {

    if (event.target === workoutModal) {

        workoutModal.style.display = "none";

    }

});

const muscleChips =
    document.querySelectorAll(".muscle-chip");

const measurementRows =
    document.getElementById("measurement-rows");

const addMeasurementButton =
    document.getElementById("add-measurement");

const MEASUREMENT_UNITS = ["minutes", "reps", "sets", "miles", "steps"];

const workoutPhotoInput =
    document.getElementById("workout-photo");

const workoutPhotoPreview =
    document.getElementById("workout-photo-preview");

let selectedPhotoData = "";
let selectedPhotoDataReady = Promise.resolve("");
const MAX_PHOTO_DIMENSION = 1024;
const MAX_PHOTO_DATA_LENGTH = 500 * 1024;
const exerciseTrackingChoiceModal = document.getElementById(
    "exercise-tracking-choice-modal"
);
const exerciseTrackingChoiceTitle = document.getElementById(
    "exercise-tracking-choice-title"
);
const exerciseTargetModal = document.getElementById("exercise-target-modal");
const logExerciseSetModal = document.getElementById("log-exercise-set-modal");
const trackingExerciseName = document.getElementById("tracking-exercise-name");
const exerciseTargetTitle = document.getElementById("exercise-target-title");
const exerciseTargetLabel = document.getElementById("exercise-target-label");
const exerciseTargetReps = document.getElementById("exercise-target-reps");
const exerciseTargetError = document.getElementById("exercise-target-error");
const exerciseSetTitlePrefix = document.getElementById("exercise-set-title-prefix");
const exerciseSetName = document.getElementById("set-exercise-name");
const exerciseSetTitleSuffix = document.getElementById("exercise-set-title-suffix");
const exerciseSetLabel = document.getElementById("exercise-set-label");
const exerciseSetReps = document.getElementById("exercise-set-reps");
const exerciseSetError = document.getElementById("exercise-set-error");
const skipExerciseTrackingButton = document.getElementById("skip-exercise-tracking");
const startExerciseTrackingButton = document.getElementById("start-exercise-tracking");
const cancelExerciseTargetButton = document.getElementById("cancel-exercise-target");
const saveExerciseTargetButton = document.getElementById("save-exercise-target");
const cancelExerciseSetButton = document.getElementById("cancel-exercise-set");
const saveExerciseSetButton = document.getElementById("save-exercise-set");
let pendingTrackedExercise = null;
let targetModalResetsProgress = false;
let returnToDashboardAfterTarget = false;


function setExerciseFormError(element, message = "") {

    element.textContent = message;
    element.hidden = !message;

}


function openExerciseTrackingChoice(exerciseName) {

    pendingTrackedExercise = exerciseName;
    const isStepsTracker = exerciseName === "Steps";

    exerciseTrackingChoiceTitle.textContent = isStepsTracker
        ? "Are you tracking your step count?"
        : "Track this exercise?";
    trackingExerciseName.textContent = isStepsTracker ? "" : exerciseName;
    exerciseTrackingChoiceModal.style.display = "flex";

}


function openExerciseTargetModal(
    exerciseName,
    target = "",
    resetsProgress = false,
    returnToDashboard = false
) {

    pendingTrackedExercise = exerciseName;
    targetModalResetsProgress = resetsProgress;
    returnToDashboardAfterTarget = returnToDashboard;
    const isStepsTracker = exerciseName === "Steps";

    exerciseTargetTitle.textContent = target
        ? `Change ${isStepsTracker ? "weekly step" : exerciseName} target`
        : `Set ${isStepsTracker ? "weekly step" : exerciseName} target`;
    exerciseTargetLabel.textContent = isStepsTracker ? "Weekly step target" : "Target reps";
    exerciseTargetReps.placeholder = isStepsTracker ? "e.g. 50000" : "e.g. 50";
    exerciseTargetReps.value = target;
    setExerciseFormError(exerciseTargetError);
    exerciseTargetModal.style.display = "flex";

    window.setTimeout(() => exerciseTargetReps.focus(), 0);

}


function openExerciseSetModal(exerciseName) {

    pendingTrackedExercise = exerciseName;
    const isStepsTracker = exerciseName === "Steps";

    exerciseSetName.textContent = isStepsTracker ? "Steps" : exerciseName;
    exerciseSetTitlePrefix.textContent = "Log ";
    exerciseSetTitleSuffix.textContent = isStepsTracker ? "" : " set";
    exerciseSetLabel.textContent = isStepsTracker ? "Steps to add" : "Reps in this set";
    exerciseSetReps.placeholder = isStepsTracker ? "e.g. 8000" : "e.g. 12";
    saveExerciseSetButton.textContent = isStepsTracker ? "Log steps" : "Log set";
    exerciseSetReps.value = "";
    setExerciseFormError(exerciseSetError);
    logExerciseSetModal.style.display = "flex";

    window.setTimeout(() => exerciseSetReps.focus(), 0);

}


async function saveExerciseGoal(exerciseName, targetReps, reset = false) {

    const sessionToken = sessionStorage.getItem("gymPactSessionToken");
    const athleteId = sessionStorage.getItem("gymPactSelectedAthleteId");

    if (!sessionToken || !athleteId) {

        throw new Error("GymPact is locked.");

    }

    const supabase = GymPactSupabase.getClient();
    const isStepsTracker = exerciseName === "Steps";
    const { data, error } = await supabase.functions.invoke(
        isStepsTracker ? "save-step-goal" : "save-exercise-goal",
        {
            body: isStepsTracker
                ? { sessionToken, userId: athleteId, targetSteps: targetReps, reset }
                : { sessionToken, userId: athleteId, exerciseName, targetReps, reset }
        }
    );

    if (error || !data?.tracker) {

        throw error || new Error("Exercise goal was unavailable.");

    }

    exerciseTrackers = sortExerciseTrackers([
        ...exerciseTrackers.filter(tracker => {

            return tracker.exerciseName !== data.tracker.exerciseName;

        }),
        data.tracker
    ]);
    exerciseTrackersLoaded = true;
    renderExerciseTrackers();

}


async function resetExerciseTracker(tracker) {

    try {

        await saveExerciseGoal(
            tracker.exerciseName,
            tracker.exerciseName === "Steps" ? tracker.targetSteps : tracker.targetReps,
            true
        );

        if (tracker.exerciseName === "Steps") {

            await loadCurrentChallenge({ preserveOnError: true });

        }

    } catch (error) {

        console.error("Unable to reset exercise tracker.", error);
        alert("We couldn't reset that goal. Please try again.");

    }

}


function autoFillTrackedWorkout(exerciseName) {

    const tracker = getExerciseTracker(exerciseName);

    if (!tracker || tracker.status !== "completed") {

        return;

    }

    measurementRows.innerHTML = "";
    addMeasurementRow({ amount: tracker.totalSets, unit: "sets" });
    addMeasurementRow({ amount: tracker.totalReps, unit: "reps" });

}


function openCompletedExerciseWorkout(exerciseName) {

    workoutModal.style.display = "flex";

    const chip = Array.from(muscleChips).find(item => {

        return item.dataset.muscle === exerciseName;

    });

    if (chip) {

        chip.classList.add("selected");

    }

    autoFillTrackedWorkout(exerciseName);

}


skipExerciseTrackingButton.addEventListener("click", () => {

    exerciseTrackingChoiceModal.style.display = "none";

});


keepExerciseTrackerButton.addEventListener("click", closeRemoveExerciseTrackerModal);


confirmRemoveExerciseTrackerButton.addEventListener("click", removeExerciseTracker);


startExerciseTrackingButton.addEventListener("click", () => {

    exerciseTrackingChoiceModal.style.display = "none";
    openExerciseTargetModal(pendingTrackedExercise, "", false, true);

});


cancelExerciseTargetButton.addEventListener("click", () => {

    exerciseTargetModal.style.display = "none";

});


saveExerciseTargetButton.addEventListener("click", async () => {

    const target = Number(exerciseTargetReps.value);

    if (!Number.isInteger(target) || target <= 0) {

        setExerciseFormError(exerciseTargetError, "Enter a whole-number target greater than zero.");

        return;

    }

    saveExerciseTargetButton.disabled = true;
    setExerciseFormError(exerciseTargetError);

    try {

        await saveExerciseGoal(
            pendingTrackedExercise,
            target,
            targetModalResetsProgress
        );
        exerciseTargetModal.style.display = "none";

        if (returnToDashboardAfterTarget) {

            workoutModal.style.display = "none";
            resetWorkoutForm();

        }

    } catch (error) {

        console.error("Unable to save exercise target.", error);
        setExerciseFormError(exerciseTargetError, "We couldn't save that target. Please try again.");

    } finally {

        saveExerciseTargetButton.disabled = false;

    }

});


cancelExerciseSetButton.addEventListener("click", () => {

    logExerciseSetModal.style.display = "none";

});


saveExerciseSetButton.addEventListener("click", async () => {

    const reps = Number(exerciseSetReps.value);
    const sessionToken = sessionStorage.getItem("gymPactSessionToken");
    const athleteId = sessionStorage.getItem("gymPactSelectedAthleteId");

    if (!Number.isInteger(reps) || reps <= 0) {

        setExerciseFormError(
            exerciseSetError,
            pendingTrackedExercise === "Steps"
                ? "Enter a whole number of steps greater than zero."
                : "Enter a whole-number rep count greater than zero."
        );

        return;

    }

    if (!sessionToken || !athleteId) {

        setExerciseFormError(exerciseSetError, "Unlock GymPact and choose an athlete first.");

        return;

    }

    saveExerciseSetButton.disabled = true;
    setExerciseFormError(exerciseSetError);

    try {

        const supabase = GymPactSupabase.getClient();
        const isStepsTracker = pendingTrackedExercise === "Steps";
        const { data, error } = await supabase.functions.invoke(
            isStepsTracker ? "log-steps" : "log-exercise-set",
            {
                body: isStepsTracker
                    ? { sessionToken, userId: athleteId, steps: reps }
                    : { sessionToken, userId: athleteId, exerciseName: pendingTrackedExercise, reps }
            }
        );

        if (error || !data?.tracker) {

            throw error || new Error("Exercise set was unavailable.");

        }

        logExerciseSetModal.style.display = "none";
        await loadExerciseTrackers({ preserveOnError: true });
        await loadCurrentChallenge({ preserveOnError: true });

        if (data.pactParticipantComplete) {

            showPactCompletionCelebration(data.pactId, athleteId);

        } else if (data.justCompleted) {

            showPactCelebration(`🎉 ${pendingTrackedExercise} goal reached!`);

        }

    } catch (error) {

        console.error("Unable to log exercise set.", error);
        setExerciseFormError(exerciseSetError, "We couldn't log that set. Please try again.");

    } finally {

        saveExerciseSetButton.disabled = false;

    }

});


function prepareWorkoutPhoto(photo) {

    return new Promise((resolve, reject) => {

        const reader = new FileReader();


        reader.addEventListener("load", () => {

            const image = new Image();


            image.addEventListener("load", () => {

                const scale = Math.min(
                    1,
                    MAX_PHOTO_DIMENSION / Math.max(image.width, image.height)
                );

                let width = Math.round(image.width * scale);
                let height = Math.round(image.height * scale);
                let quality = 0.75;

                const canvas = document.createElement("canvas");
                const context = canvas.getContext("2d");


                while (true) {

                    canvas.width = width;
                    canvas.height = height;

                    context.drawImage(image, 0, 0, width, height);

                    const photoData = canvas.toDataURL("image/jpeg", quality);


                    if (
                        photoData.length <= MAX_PHOTO_DATA_LENGTH ||
                        Math.max(width, height) <= 320
                    ) {

                        resolve(photoData);

                        return;

                    }


                    if (quality > 0.45) {

                        quality -= 0.1;

                    } else {

                        width = Math.round(width * 0.75);
                        height = Math.round(height * 0.75);
                        quality = 0.75;

                    }

                }

            });


            image.addEventListener("error", reject);
            image.src = reader.result;

        });


        reader.addEventListener("error", reject);
        reader.readAsDataURL(photo);

    });

}


workoutPhotoInput.addEventListener("change", () => {

    const photo = workoutPhotoInput.files[0];

    selectedPhotoData = "";
    workoutPhotoPreview.hidden = true;
    workoutPhotoPreview.removeAttribute("src");

    if (!photo) {

        selectedPhotoDataReady = Promise.resolve("");

        return;

    }

    selectedPhotoDataReady = prepareWorkoutPhoto(photo)
        .then(photoData => {

            selectedPhotoData = photoData;
            workoutPhotoPreview.src = selectedPhotoData;
            workoutPhotoPreview.hidden = false;

            return selectedPhotoData;

        })
        .catch(() => {

            selectedPhotoData = "";

            return "";

        });

});


muscleChips.forEach(chip => {

    chip.addEventListener("click", async () => {

        chip.classList.toggle("selected");

        const exerciseName = chip.dataset.muscle;

        if (!chip.classList.contains("selected")) {

            return;

        }

        const isTrackedExercise = TRACKED_EXERCISES.includes(exerciseName);
        const isCardio = exerciseName === "Cardio";

        if (!isTrackedExercise && !isCardio) {

            return;

        }

        if (isCardio && !currentChallengeLoaded) {

            await loadCurrentChallenge();

        }

        const canTrackSteps = isCardio && currentChallenge?.status === "active" &&
            currentChallenge.requirements?.some(requirement => requirement.type === "steps");

        if (!isTrackedExercise && !canTrackSteps) {

            return;

        }

        const trackedExerciseName = canTrackSteps ? "Steps" : exerciseName;

        const tracker = getExerciseTracker(trackedExerciseName);

        if (tracker) {

            if (!canTrackSteps) {

                autoFillTrackedWorkout(exerciseName);

            }

            return;

        }

        // The decision must feel immediate. A background refresh may still be
        // in flight, but it must never make the Pushups/Pullups chip inert.
        openExerciseTrackingChoice(trackedExerciseName);

        if (!exerciseTrackersLoaded) {

            loadExerciseTrackers()
                .then(() => {

                    const refreshedTracker = getExerciseTracker(trackedExerciseName);

                    if (refreshedTracker) {

                        exerciseTrackingChoiceModal.style.display = "none";
                        if (!canTrackSteps) {

                            autoFillTrackedWorkout(exerciseName);

                        }

                    }

                })
                .catch(error => {

                    console.error("Unable to check exercise tracking.", error);

                });

        }


    });

});


function addMeasurementRow(measurement = {}) {

    const row = document.createElement("div");
    const amount = document.createElement("input");
    const unit = document.createElement("select");
    const removeButton = document.createElement("button");

    row.classList.add("measurement-row");

    amount.classList.add("measurement-amount");
    amount.type = "number";
    amount.min = "0.01";
    amount.step = "any";
    amount.inputMode = "decimal";
    amount.placeholder = "Amount";
    amount.value = measurement.amount ?? "";
    amount.setAttribute("aria-label", "Measurement amount");

    unit.classList.add("measurement-unit");
    unit.setAttribute("aria-label", "Measurement unit");

    MEASUREMENT_UNITS.forEach(unitName => {

        const option = document.createElement("option");

        option.value = unitName;
        option.textContent = unitName;
        option.selected = (measurement.unit || "minutes") === unitName;
        unit.appendChild(option);

    });

    removeButton.classList.add("remove-measurement-button");
    removeButton.type = "button";
    removeButton.textContent = "Remove";
    removeButton.addEventListener("click", () => {

        row.remove();

    });

    row.append(amount, unit, removeButton);
    measurementRows.appendChild(row);

}


function getMeasurements() {

    const rows = measurementRows.querySelectorAll(".measurement-row");
    const measurements = [];

    if (rows.length === 0) {

        return { measurements, hasInvalidRows: false };

    }

    for (const row of rows) {

        const amountInput = row.querySelector(".measurement-amount");
        const unitSelect = row.querySelector(".measurement-unit");
        const amount = Number(amountInput.value);

        if (
            !amountInput.value.trim() ||
            !Number.isFinite(amount) ||
            amount <= 0 ||
            !MEASUREMENT_UNITS.includes(unitSelect.value)
        ) {

            return { measurements: [], hasInvalidRows: true };

        }

        measurements.push({ amount, unit: unitSelect.value });

    }

    return { measurements, hasInvalidRows: false };

}


function resetWorkoutForm() {

    measurementRows.innerHTML = "";
    addMeasurementRow();

    workoutPhotoInput.value = "";
    selectedPhotoData = "";
    selectedPhotoDataReady = Promise.resolve("");
    workoutPhotoPreview.hidden = true;
    workoutPhotoPreview.removeAttribute("src");
    document.getElementById("workout-notes").value = "";

    muscleChips.forEach(chip => {

        chip.classList.remove("selected");

    });

}


addMeasurementButton.addEventListener("click", () => {

    addMeasurementRow();

});

addMeasurementRow();

const saveWorkoutButton =
    document.getElementById("save-workout");


saveWorkoutButton.addEventListener("click", async () => {


    const selectedMuscles = [];


    muscleChips.forEach(chip => {

        if (chip.classList.contains("selected")) {

            selectedMuscles.push(chip.dataset.muscle);

        }

    });


    const activityName = selectedMuscles.join(" · ");

    const { measurements, hasInvalidRows } = getMeasurements();


    const photo =
        document.getElementById("workout-photo").files[0];


    const notes =
        document.getElementById("workout-notes").value;



    if (selectedMuscles.length === 0) {

        alert("Please select at least one muscle group.");

        return;

    }


    if (hasInvalidRows) {

        alert("Each measurement needs an amount greater than zero.");

        return;

    }


    if (measurements.length === 0) {

        alert("Please add at least one measurement.");

        return;

    }


    if (!photo) {

        alert("Please upload workout proof.");

        return;

    }


    const photoData = await selectedPhotoDataReady;


    if (!photoData) {

        alert("We couldn't read that photo. Please choose it again.");

        return;

    }



    const sessionToken = sessionStorage.getItem("gymPactSessionToken");
    const selectedAthleteId = sessionStorage.getItem(
        "gymPactSelectedAthleteId"
    );

    if (!sessionToken || !selectedAthleteId) {

        alert("Please unlock GymPact and choose your athlete first.");

        return;

    }

    saveWorkoutButton.disabled = true;

    try {

        const photoBlob = await fetch(photoData)
            .then(response => response.blob());
        const workoutForm = new FormData();

        workoutForm.append("sessionToken", sessionToken);
        workoutForm.append("userId", selectedAthleteId);
        workoutForm.append("muscles", JSON.stringify(selectedMuscles));
        workoutForm.append("activityName", activityName);
        workoutForm.append("measurements", JSON.stringify(measurements));
        workoutForm.append("notes", notes);
        workoutForm.append("photo", photoBlob, "workout-proof.jpg");

        const supabase = GymPactSupabase.getClient();
        const { data, error } = await supabase.functions.invoke(
            "create-workout",
            { body: workoutForm }
        );

        if (error) {
            throw error;
        }

        await Promise.all([
            loadDashboardMetrics(),
            loadCurrentChallenge()
        ]);

        if (data?.pactParticipantComplete) {

            showPactCompletionCelebration(data.pactId, selectedAthleteId);

        }

    } catch (error) {

        console.error("Unable to log workout.", error);
        alert("We couldn't save that workout. Please try again.");

        return;

    } finally {

        saveWorkoutButton.disabled = false;

    }

    // close modal

workoutModal.style.display = "none";


// reset form

resetWorkoutForm();


alert("Workout logged successfully 💪");


});

const requestedQuickAction = new URLSearchParams(window.location.search).get("quickAction");

if (["exercise", "tracker", "week-pact", "month-pact"].includes(requestedQuickAction)) {

    const requestedUrl = new URL(window.location.href);
    requestedUrl.searchParams.delete("quickAction");
    window.history.replaceState({}, "", `${requestedUrl.pathname}${requestedUrl.search}`);

    requestAnimationFrame(async () => {

        if (requestedQuickAction === "exercise") workoutModal.style.display = "flex";
        if (requestedQuickAction === "tracker") await openQuickExercise();
        if (requestedQuickAction === "week-pact") await startWeeklyPact();
        if (requestedQuickAction === "month-pact") await openQuickMonthlyPact();

    });

}
