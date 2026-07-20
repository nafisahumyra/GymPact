const currentUser = GymPactStorage.getCurrentUser();

let workouts =
    GymPactStorage.getWorkouts();

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



    const workout = {

        user: currentUser,

        muscles: selectedMuscles,

        duration: duration,

        photo: photo.name,

        photoData: photoData,

        notes: notes,

        timestamp: new Date()

    };


    workouts.push(workout);

    GymPactStorage.saveWorkouts(workouts);

    console.log(workouts);

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

function clearWorkouts() {

    GymPactStorage.clearWorkouts();

    console.log("Workouts cleared");

}



const historyButton =
    document.getElementById("history-button");


if (historyButton) {

    historyButton.addEventListener("click", () => {

        window.location.href = "history.html";

    });

}
