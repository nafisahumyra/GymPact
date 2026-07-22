const currentUser =
    GymPactStorage.getCurrentUser();


document.getElementById("history-user").textContent =
    "Showing workouts shared by Nafisa and Mahfuzur";


const historyContainer =
    document.getElementById("workout-history");


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


renderWorkoutHistory();


document.getElementById("back-dashboard")
.addEventListener("click", () => {

    window.location.href = "dashboard.html";

});
