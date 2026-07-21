const currentUser =
    GymPactStorage.getCurrentUser();


document.getElementById("history-user").textContent =
    `Showing workouts for ${currentUser}`;



const workouts =
    GymPactStorage.getWorkouts();



const historyContainer =
    document.getElementById("workout-history");



const userWorkouts = workouts.filter(workout => {

    return workout.user === currentUser;

});



if (userWorkouts.length === 0) {

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


} else {


    historyContainer.innerHTML = "";


    userWorkouts.reverse().forEach(workout => {


        const card =
            document.createElement("div");


        card.classList.add("workout-card");


        card.innerHTML = `

            <h3>
                🏋️ ${workout.muscles.join(" • ")}
            </h3>

            <p>
                ⏱ ${workout.duration} minutes
            </p>

            <p>
                📅 ${new Date(workout.timestamp).toLocaleString()}
            </p>


            ${
                workout.notes
                ? `<p>📝 ${workout.notes}</p>`
                : ""
            }

        `;


        if (
            typeof workout.photoData === "string" &&
            workout.photoData.startsWith("data:image/")
        ) {

            const photo = document.createElement("img");

            photo.classList.add("workout-history-photo");
            photo.src = workout.photoData;
            photo.alt = `Workout proof for ${workout.muscles.join(", ")}`;

            card.appendChild(photo);

        }


        historyContainer.appendChild(card);


    });

}



document.getElementById("back-dashboard")
.addEventListener("click", () => {

    window.location.href = "dashboard.html";

});
