const historySupportingText =
    document.getElementById("history-user");


historySupportingText.textContent =
    "Showing workouts shared by Nafisa and Mahfuzur";


const historyContainer =
    document.getElementById("workout-history");


const challengeHistoryContainer =
    document.getElementById("challenge-history");


const workoutsTab =
    document.getElementById("workouts-tab");


const challengesTab =
    document.getElementById("challenges-tab");


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


async function renderWorkoutHistory() {

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
        const card = document.createElement("div");

        card.classList.add("workout-card");
        card.innerHTML = `

            <h3>
                🏋️ ${workout.athlete_name}
            </h3>

                <p>
                  ${muscles.join(" • ")}
                </p>

            <p>
                ⏱ ${workout.duration_minutes} minutes
            </p>

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
            photo.alt = `Workout proof for ${muscles.join(", ")}`;

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
            <p>No completed challenges yet.</p>
            <p>Finish a challenge to see its final score here.</p>
        </div>
    `;

}


async function renderChallengeHistory() {

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
        heading.textContent = "🤝 Challenge";
        dateRange.classList.add("challenge-history-date");
        dateRange.textContent = formatDateRange(
            challenge.startDate,
            challenge.endDate
        );
        goal.textContent =
            `Goal: ${challenge.targetAmount} workout${challenge.targetAmount === 1 ? "" : "s"} per ${challenge.timeframe}`;
        scoreHeading.textContent = "Final score";
        result.classList.add("challenge-history-result");
        result.textContent = getChallengeResultText(challenge);
        wager.textContent =
            `Wager: ${challenge.wagerType === "reward" ? "Reward" : "Punishment"}: ${challenge.wagerDescription}`;

        card.append(heading, dateRange, goal, scoreHeading);

        challenge.participants.forEach(participant => {

            const score = document.createElement("p");

            score.classList.add("challenge-history-score");
            score.textContent =
                `${participant.displayName}: ${participant.completed} / ${participant.target}`;
            card.appendChild(score);

        });

        card.append(result, wager);
        challengeHistoryContainer.appendChild(card);

    });

}


function showHistoryTab(tab) {

    const showWorkouts = tab === "workouts";

    workoutsTab.classList.toggle("is-active", showWorkouts);
    challengesTab.classList.toggle("is-active", !showWorkouts);
    workoutsTab.setAttribute("aria-selected", String(showWorkouts));
    challengesTab.setAttribute("aria-selected", String(!showWorkouts));
    historyContainer.hidden = !showWorkouts;
    challengeHistoryContainer.hidden = showWorkouts;
    historySupportingText.textContent = showWorkouts
        ? "Showing workouts shared by Nafisa and Mahfuzur"
        : "Completed challenges shared by Nafisa and Mahfuzur";

    if (!showWorkouts) {

        renderChallengeHistory();

    }

}


workoutsTab.addEventListener("click", () => {

    showHistoryTab("workouts");

});


challengesTab.addEventListener("click", () => {

    showHistoryTab("challenges");

});


renderWorkoutHistory();


document.getElementById("back-dashboard")
.addEventListener("click", () => {

    window.location.href = "dashboard.html";

});
