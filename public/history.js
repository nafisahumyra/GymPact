const currentUser =
    localStorage.getItem("currentUser");


document.getElementById("history-user").textContent =
    `Showing workouts for ${currentUser}`;



const workouts =
    JSON.parse(localStorage.getItem("workouts")) || [];



const historyContainer =
    document.getElementById("workout-history");



const userWorkouts = workouts.filter(workout => {

    return workout.user === currentUser;

});



if (userWorkouts.length === 0) {


    historyContainer.innerHTML =
        "<p>No workouts logged yet.</p>";


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
