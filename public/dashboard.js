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


function showPactCelebration() {

    const celebration = document.createElement("div");
    const message = document.createElement("div");
    const colors = ["#22C55E", "#FCD34D", "#60A5FA", "#F472B6"];

    celebration.classList.add("pact-celebration");
    message.classList.add("pact-celebration-message");
    message.textContent = "🎉 Goal reached!";
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
                loadDashboardMetrics({ preserveOnError: true })
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

const workoutPhotoInput =
    document.getElementById("workout-photo");

const workoutPhotoPreview =
    document.getElementById("workout-photo-preview");

let selectedPhotoData = "";
let selectedPhotoDataReady = Promise.resolve("");
const MAX_PHOTO_DIMENSION = 1024;
const MAX_PHOTO_DATA_LENGTH = 500 * 1024;


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

    chip.addEventListener("click", () => {

        chip.classList.toggle("selected");

    });

});

const saveWorkoutButton =
    document.getElementById("save-workout");


saveWorkoutButton.addEventListener("click", async () => {


    const selectedMuscles = [];


    muscleChips.forEach(chip => {

        if (chip.classList.contains("selected")) {

            selectedMuscles.push(chip.textContent);

        }

    });


    const duration =
        document.getElementById("workout-duration").value;


    const photo =
        document.getElementById("workout-photo").files[0];


    const notes =
        document.getElementById("workout-notes").value;



    if (selectedMuscles.length === 0) {

        alert("Please select at least one muscle group.");

        return;

    }


    if (!duration) {

        alert("Please enter workout duration.");

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
        workoutForm.append("durationMinutes", duration);
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

document.getElementById("workout-duration").value = "";

document.getElementById("workout-photo").value = "";

selectedPhotoData = "";
selectedPhotoDataReady = Promise.resolve("");
workoutPhotoPreview.hidden = true;
workoutPhotoPreview.removeAttribute("src");

document.getElementById("workout-notes").value = "";


// reset selected chips

muscleChips.forEach(chip => {

    chip.classList.remove("selected");

});


alert("Workout logged successfully 💪");


});

const historyButton =
    document.getElementById("history-button");


if (historyButton) {

    historyButton.addEventListener("click", () => {

        window.location.href = "history.html";

    });

}
