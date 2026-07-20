const currentUser = localStorage.getItem("currentUser");

let workouts =
    JSON.parse(localStorage.getItem("workouts")) || [];

// Welcome message

document.getElementById("welcome-message").textContent =
    `Welcome back, ${currentUser}!`;





// Determine partner

let partnerName;


if (currentUser === "Nafisa") {

    partnerName = "Mahfuzur";

} else {

    partnerName = "Nafisa";

}


// Display partner

document.getElementById("partner-name").textContent =
    partnerName;


    const partnerWorkouts = workouts.filter(workout => {

        return workout.user === partnerName;
    
    });
    
    
    const latestPartnerWorkout =
        partnerWorkouts[partnerWorkouts.length - 1];
    
    
    if (latestPartnerWorkout) {
    
    
        const muscles =
            latestPartnerWorkout.muscles.join(" • ");
    
    
        document.getElementById("partner-status").textContent =
    
            `🏋️ ${muscles}
            
            ⏱ ${latestPartnerWorkout.duration} minutes
            
            📅 ${new Date(latestPartnerWorkout.timestamp).toLocaleString()}
            
            You're up next 💪`;
    
    
    } else {
    
    
        document.getElementById("partner-status").textContent =
    
            "No workouts logged yet. You're both ready to start 💪";
    
    
    }

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


muscleChips.forEach(chip => {

    chip.addEventListener("click", () => {

        chip.classList.toggle("selected");

    });

});

const saveWorkoutButton =
    document.getElementById("save-workout");


saveWorkoutButton.addEventListener("click", () => {


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



    const workout = {

        user: currentUser,

        muscles: selectedMuscles,

        duration: duration,

        photo: photo.name,

        notes: notes,

        timestamp: new Date()

    };


    workouts.push(workout);

    localStorage.setItem(
        "workouts",
        JSON.stringify(workouts)
    );

    console.log(workouts);

    // close modal

workoutModal.style.display = "none";


// reset form

document.getElementById("workout-duration").value = "";

document.getElementById("workout-photo").value = "";

document.getElementById("workout-notes").value = "";


// reset selected chips

muscleChips.forEach(chip => {

    chip.classList.remove("selected");

});


alert("Workout logged successfully 💪");


});

function clearWorkouts() {

    localStorage.removeItem("workouts");

    console.log("Workouts cleared");

}



const historyButton =
    document.getElementById("history-button");


if (historyButton) {

    historyButton.addEventListener("click", () => {

        window.location.href = "history.html";

    });

}