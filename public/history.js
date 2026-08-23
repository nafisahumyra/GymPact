const historySupportingText =
    document.getElementById("history-user");


historySupportingText.textContent =
    "Showing workouts shared by Nafisa and Mahfuzur";


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
let historyRefreshInFlight = null;

historyPageTitle.textContent = activeHistoryTab === "challenges" ? "Pact History" : "Workout History";
document.title = `GymPact ${historyPageTitle.textContent}`;


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

            card.appendChild(photo);

        }

        historyContainer.appendChild(card);

    });

}


function formatDateRange(startDate, endDate) {

    const formatDate = date =>
        new Date(`${date}T00:00:00`).toLocaleDateString();

    return `${formatDate(startDate)} – ${formatDate(endDate)}`;

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

        console.error("Unable to load challenge history.", error);

        if (preserveOnError) {

            throw error || new Error("Challenge history was unavailable.");

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
        const heading = document.createElement("h3");
        const dateRange = document.createElement("p");
        const goal = document.createElement("p");
        const scoreHeading = document.createElement("h4");
        const result = document.createElement("p");
        const wager = document.createElement("p");

        card.classList.add("challenge-history-card");
        heading.textContent = "🤝 Pact";
        dateRange.classList.add("challenge-history-date");
        dateRange.textContent = formatDateRange(
            challenge.startDate,
            challenge.endDate
        );
        goal.textContent = `Goals: ${(challenge.requirements || []).map(requirement =>
            `${requirement.targetAmount.toLocaleString()} ${requirement.type === "hiit" ? "HIIT" : requirement.type}`
        ).join(" · ")} per ${challenge.timeframe}`;
        scoreHeading.textContent = "Final score";
        result.classList.add("challenge-history-result");
        result.textContent = getChallengeResultText(challenge);
        wager.textContent =
            `Wager: ${challenge.wagerType === "reward" ? "Reward" : "Punishment"}: ${challenge.wagerDescription}`;

        card.append(heading, dateRange, goal, scoreHeading);

        challenge.participants.forEach(participant => {

            const score = document.createElement("p");

            score.classList.add("challenge-history-score");
            score.textContent = `${participant.displayName}: ${(participant.requirements || []).map(requirement =>
                `${requirement.type === "hiit" ? "HIIT" : requirement.type}: ${requirement.completed.toLocaleString()} / ${requirement.targetAmount.toLocaleString()}`
            ).join(" · ")}`;
            card.appendChild(score);

        });

        card.append(result, wager);
        challengeHistoryContainer.appendChild(card);

    });

}


function showHistoryTab(tab) {

    const showWorkouts = tab === "workouts";

    historyContainer.hidden = !showWorkouts;
    challengeHistoryContainer.hidden = showWorkouts;
    historySupportingText.textContent = showWorkouts
        ? "Showing workouts shared by Nafisa and Mahfuzur"
        : "Completed Pacts shared by Nafisa and Mahfuzur";

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

    window.location.href = "dashboard.html?tab=pact";

});

document.addEventListener("visibilitychange", () => {

    if (document.visibilityState === "visible") {

        refreshHistory();

    }

});


showHistoryTab(activeHistoryTab);
refreshHistory();
