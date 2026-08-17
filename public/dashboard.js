const currentUser = localStorage.getItem("currentUser") || "Athlete";

// Welcome message

document.getElementById("welcome-message").textContent =
    `Welcome back, ${currentUser}!`;





let currentChallenge = null;
let currentChallengeLoaded = false;
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
let dashboardRefreshInFlight = null;
const exerciseTrackersContainer = document.getElementById("exercise-trackers");
const TRACKED_EXERCISES = ["Pushups", "Pullups"];
const EXERCISE_ICONS = {
    Pushups: "assets/gp-images/pushup.png",
    Pullups: "assets/gp-images/Pullup.png"
};
let exerciseTrackers = [];
let exerciseTrackersLoaded = false;


function getWorkoutDay(workout) {

    return new Date(workout.logged_at).toISOString().slice(0, 10);

}


function calculateCurrentStreak(workouts) {

    const workoutDays = new Set(workouts.map(getWorkoutDay));
    const cursor = new Date();
    let streak = 0;

    cursor.setUTCHours(0, 0, 0, 0);

    while (workoutDays.has(cursor.toISOString().slice(0, 10))) {

        streak += 1;
        cursor.setUTCDate(cursor.getUTCDate() - 1);

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
        const { data, error } = await supabase.functions.invoke(
            "list-workouts",
            { body: { sessionToken } }
        );

        if (error || !Array.isArray(data?.workouts)) {

            throw error || new Error("Workout data was unavailable.");

        }

        const athleteWorkouts = data.workouts.filter(workout => {

            return workout.user_id === athleteId;

        });
        const streak = calculateCurrentStreak(athleteWorkouts);

        workoutCount.textContent = athleteWorkouts.length;
        streakCount.textContent = `${streak} ${streak === 1 ? "day" : "days"}`;

    } catch (error) {

        console.error("Unable to load dashboard workout metrics.", error);

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


function renderExerciseTrackers() {

    exerciseTrackersContainer.innerHTML = "";

    if (exerciseTrackers.length === 0) {

        const empty = document.createElement("p");

        empty.classList.add("exercise-tracker-empty");
        empty.textContent = "Track a Pushups or Pullups goal from Add Workout.";
        exerciseTrackersContainer.appendChild(empty);

        return;

    }

    exerciseTrackers.forEach(tracker => {

        const card = document.createElement("article");
        const header = document.createElement("div");
        const icon = document.createElement("span");
        const title = document.createElement("div");
        const heading = document.createElement("h4");
        const score = document.createElement("p");
        const bar = document.createElement("div");
        const fill = document.createElement("div");
        const marker = document.createElement("span");
        const actions = document.createElement("div");
        const progress = Math.min((tracker.totalReps / tracker.targetReps) * 100, 100);

        card.classList.add("exercise-tracker-card");
        if (tracker.status === "completed") {

            card.classList.add("is-completed");

        }

        header.classList.add("exercise-tracker-header");
        icon.classList.add("exercise-tracker-icon");
        icon.appendChild(createExerciseIcon(tracker.exerciseName));
        title.classList.add("exercise-tracker-title");
        heading.textContent = tracker.exerciseName;
        score.textContent = `${tracker.totalReps} / ${tracker.targetReps} reps · ${tracker.totalSets} ${tracker.totalSets === 1 ? "set" : "sets"}`;
        title.append(heading, score);
        header.append(icon, title);

        if (tracker.status === "completed") {

            const completed = document.createElement("span");

            completed.classList.add("exercise-tracker-complete");
            completed.textContent = "Complete";
            header.appendChild(completed);

        }

        bar.classList.add("exercise-progress-bar");
        bar.style.setProperty("--progress", `${progress}%`);
        fill.classList.add("exercise-progress-fill");
        marker.classList.add("exercise-progress-marker");
        marker.appendChild(createExerciseIcon(tracker.exerciseName));
        bar.append(fill, marker);

        actions.classList.add("exercise-tracker-actions");

        if (tracker.status === "active") {

            const logSet = document.createElement("button");

            logSet.type = "button";
            logSet.textContent = "+ Log Set";
            logSet.addEventListener("click", () => {

                openExerciseSetModal(tracker.exerciseName);

            });
            actions.appendChild(logSet);

        } else {

            const logWorkout = document.createElement("button");

            logWorkout.type = "button";
            logWorkout.textContent = "Log Workout";
            logWorkout.addEventListener("click", () => {

                openCompletedExerciseWorkout(tracker.exerciseName);

            });
            actions.appendChild(logWorkout);

        }

        const changeTarget = document.createElement("button");
        const reset = document.createElement("button");

        changeTarget.type = "button";
        changeTarget.textContent = "Change target";
        changeTarget.addEventListener("click", () => {

            openExerciseTargetModal(tracker.exerciseName, tracker.targetReps, false);

        });

        reset.type = "button";
        reset.textContent = "Reset";
        reset.addEventListener("click", () => {

            resetExerciseTracker(tracker);

        });

        actions.append(changeTarget, reset);
        card.append(header, bar, actions);
        exerciseTrackersContainer.appendChild(card);

    });

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

        exerciseTrackers = data.trackers;
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

    if (!athleteId || !athleteProgress || athleteProgress.completed < athleteProgress.target) {

        return;

    }

    const celebrationKey =
        `gymPactCelebration:${challenge.id}:${athleteId}`;

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

function getChallengeStatusText(status, challenge) {

    if (status === "pending") {

        const selectedAthleteId = sessionStorage.getItem(
            "gymPactSelectedAthleteId"
        );

        if (challenge.createdBy !== selectedAthleteId) {

            return "This challenge is waiting for your response.";

        }

        const otherAthlete = challenge.participantDetails?.find(participant => {

            return participant.userId !== selectedAthleteId;

        });

        return `Waiting for ${otherAthlete?.displayName || "your partner"} to accept.`;

    }

    const statusText = {
        active: "Challenge in progress.",
        completed: "Challenge completed.",
        expired: "Challenge expired."
    };

    return statusText[status] || "Challenge status unavailable.";

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

        console.error("Unable to respond to challenge.", error);
        alert("We couldn't update that challenge. Please try again.");

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


function renderCurrentChallenge(challenge) {

    currentChallengeContainer.innerHTML = "";


    if (!challenge) {

        const message = document.createElement("p");
        const description = document.createElement("p");

        message.textContent = "No active challenge.";
        description.textContent =
            "Start one to keep each other accountable.";

        currentChallengeContainer.append(message, description);

        return;

    }


    const workoutLabel =
        challenge.targetAmount === 1 ? "workout" : "workouts";

    currentChallengeContainer.appendChild(
        createChallengeStatusPill(challenge.status)
    );

    appendChallengeDetail(
        currentChallengeContainer,
        "Goal",
        `Complete ${challenge.targetAmount} ${workoutLabel} per ${challenge.timeframe}`
    );

    if (challenge.status === "active" && Array.isArray(challenge.progress)) {

        const progress = document.createElement("div");

        progress.classList.add("challenge-progress");
        appendChallengeDetail(progress, "Progress", "");

        challenge.progress.forEach(participant => {

            const participantProgress = document.createElement("p");

            participantProgress.textContent =
                `${participant.displayName}: ${participant.completed} / ${participant.target}`;
            progress.appendChild(participantProgress);

        });

        currentChallengeContainer.appendChild(progress);
        celebratePactCompletion(challenge);

    }

    appendChallengeDetail(
        currentChallengeContainer,
        "Wager",
        `${challenge.wagerType === "reward" ? "Reward" : "Punishment"}: ${challenge.wagerDescription}`
    );

    const timePeriod = document.createElement("div");

    timePeriod.classList.add("challenge-dates");
    appendChallengeDetail(timePeriod, "Start date", formatChallengeDate(challenge.startDate));
    appendChallengeDetail(timePeriod, "End date", formatChallengeDate(challenge.endDate));
    currentChallengeContainer.appendChild(timePeriod);

    appendChallengeDetail(
        currentChallengeContainer,
        "Challenge status",
        getChallengeStatusText(challenge.status, challenge)
    );

    if (challenge.status === "pending" && !isChallengeCreator(challenge)) {

        appendPendingChallengeActions(currentChallengeContainer);

    }

}


async function loadCurrentChallenge({ preserveOnError = false } = {}) {

    const sessionToken = sessionStorage.getItem("gymPactSessionToken");

    if (!sessionToken) {

        currentChallenge = null;
        currentChallengeLoaded = true;
        renderCurrentChallenge(currentChallenge);

        return;

    }

    const supabase = GymPactSupabase.getClient();
    const { data, error } = await supabase.functions.invoke(
        "get-current-pact",
        { body: { sessionToken } }
    );

    if (error) {

        console.error("Unable to load the current challenge.", error);

        if (preserveOnError) {

            throw error;

        }

        currentChallenge = null;

    } else {

        currentChallenge = data?.pact || null;

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

        dashboardRefreshButton.disabled = true;
        dashboardRefreshButton.classList.add("is-loading");
        dashboardRefreshButton.setAttribute("aria-busy", "true");
        dashboardRefreshButton.textContent = "Refreshing";
        setDashboardRefreshFeedback();

        try {

            await Promise.all([
                loadCurrentChallenge({ preserveOnError: true }),
                loadDashboardMetrics({ preserveOnError: true }),
                loadExerciseTrackers({ preserveOnError: true })
            ]);

        } catch (error) {

            console.error("Unable to refresh the dashboard.", error);
            setDashboardRefreshFeedback(
                "Couldn't refresh right now. Your current data is still shown."
            );

        } finally {

            dashboardRefreshButton.disabled = false;
            dashboardRefreshButton.classList.remove("is-loading");
            dashboardRefreshButton.removeAttribute("aria-busy");
            dashboardRefreshButton.textContent = "↻ Refresh";

        }

    })();

    try {

        await dashboardRefreshInFlight;

    } finally {

        dashboardRefreshInFlight = null;

    }

}


renderCurrentChallenge(currentChallenge);
dashboardRefreshButton.addEventListener("click", refreshDashboard);

document.addEventListener("visibilitychange", () => {

    if (document.visibilityState === "visible") {

        refreshDashboard();

    }

});

refreshDashboard();

const newChallengeButton =
    document.getElementById("new-challenge-button");

const challengeActiveModal =
    document.getElementById("challenge-active-modal");

const cancelChallengeModal =
    document.getElementById("cancel-challenge-modal");

const openCancelChallengeModalButton =
    document.getElementById("open-cancel-challenge-modal");

const closeChallengeActiveModalButton =
    document.getElementById("close-challenge-active-modal");

const confirmCancelChallengeButton =
    document.getElementById("confirm-cancel-challenge");

const keepChallengeButton =
    document.getElementById("keep-challenge");


newChallengeButton.addEventListener("click", async () => {

    if (!currentChallengeLoaded) {

        await loadCurrentChallenge();

    }

    if (!currentChallenge) {

        window.location.href = "create-pact.html";

        return;

    }

    challengeActiveModal.style.display = "flex";

});


closeChallengeActiveModalButton.addEventListener("click", () => {

    challengeActiveModal.style.display = "none";

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

        console.error("Unable to cancel challenge.", error);
        alert("We couldn't cancel that challenge. Please try again.");

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


openModalButton.addEventListener("click", () => {

    workoutModal.style.display = "flex";

});


closeModalButton.addEventListener("click", () => {

    workoutModal.style.display = "none";

});

const muscleChips =
    document.querySelectorAll(".muscle-chip");

const measurementRows =
    document.getElementById("measurement-rows");

const addMeasurementButton =
    document.getElementById("add-measurement");

const MEASUREMENT_UNITS = ["minutes", "reps", "sets", "miles"];

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
const exerciseTargetModal = document.getElementById("exercise-target-modal");
const logExerciseSetModal = document.getElementById("log-exercise-set-modal");
const trackingExerciseName = document.getElementById("tracking-exercise-name");
const exerciseTargetTitle = document.getElementById("exercise-target-title");
const exerciseTargetReps = document.getElementById("exercise-target-reps");
const exerciseTargetError = document.getElementById("exercise-target-error");
const exerciseSetName = document.getElementById("set-exercise-name");
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
    trackingExerciseName.textContent = exerciseName;
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
    exerciseTargetTitle.textContent = target
        ? `Change ${exerciseName} target`
        : `Set ${exerciseName} target`;
    exerciseTargetReps.value = target;
    setExerciseFormError(exerciseTargetError);
    exerciseTargetModal.style.display = "flex";

    window.setTimeout(() => exerciseTargetReps.focus(), 0);

}


function openExerciseSetModal(exerciseName) {

    pendingTrackedExercise = exerciseName;
    exerciseSetName.textContent = exerciseName;
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
    const { data, error } = await supabase.functions.invoke(
        "save-exercise-goal",
        { body: { sessionToken, userId: athleteId, exerciseName, targetReps, reset } }
    );

    if (error || !Array.isArray(data?.trackers)) {

        throw error || new Error("Exercise goal was unavailable.");

    }

    exerciseTrackers = data.trackers;
    exerciseTrackersLoaded = true;
    renderExerciseTrackers();

}


async function resetExerciseTracker(tracker) {

    try {

        await saveExerciseGoal(tracker.exerciseName, tracker.targetReps, true);

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

        setExerciseFormError(exerciseSetError, "Enter a whole-number rep count greater than zero.");

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
        const { data, error } = await supabase.functions.invoke(
            "log-exercise-set",
            { body: { sessionToken, userId: athleteId, exerciseName: pendingTrackedExercise, reps } }
        );

        if (error || !data?.tracker) {

            throw error || new Error("Exercise set was unavailable.");

        }

        logExerciseSetModal.style.display = "none";
        await loadExerciseTrackers({ preserveOnError: true });

        if (data.justCompleted) {

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

        if (!chip.classList.contains("selected") || !TRACKED_EXERCISES.includes(exerciseName)) {

            return;

        }

        const tracker = getExerciseTracker(exerciseName);

        if (tracker) {

            autoFillTrackedWorkout(exerciseName);

            return;

        }

        // The decision must feel immediate. A background refresh may still be
        // in flight, but it must never make the Pushups/Pullups chip inert.
        openExerciseTrackingChoice(exerciseName);

        if (!exerciseTrackersLoaded) {

            loadExerciseTrackers()
                .then(() => {

                    const refreshedTracker = getExerciseTracker(exerciseName);

                    if (refreshedTracker) {

                        exerciseTrackingChoiceModal.style.display = "none";
                        autoFillTrackedWorkout(exerciseName);

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
        const { error } = await supabase.functions.invoke(
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

const historyButton =
    document.getElementById("history-button");


if (historyButton) {

    historyButton.addEventListener("click", () => {

        window.location.href = "history.html";

    });

}
