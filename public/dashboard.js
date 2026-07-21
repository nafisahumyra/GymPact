const currentUser = GymPactStorage.getCurrentUser();

let workouts =
    GymPactStorage.getWorkouts();

// Welcome message

document.getElementById("welcome-message").textContent =
    `Welcome back, ${currentUser}!`;





const currentChallenge = GymPactStorage.getActivePact();
const currentChallengeContainer =
    document.getElementById("current-challenge");


function formatChallengeDate(date) {

    if (!date) {

        return "Not set";

    }

    return new Date(`${date}T00:00:00`).toLocaleDateString();

}

function getChallengeStatusText(status) {

    const statusText = {
        pending: "Waiting for Mahfuzur to accept.",
        active: "Challenge in progress.",
        completed: "Challenge completed.",
        expired: "Challenge expired."
    };

    return statusText[status] || "Challenge status unavailable.";

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

    const progress = document.createElement("div");

    progress.classList.add("challenge-progress");
    appendChallengeDetail(progress, "Progress", `Nafisa: 0 / ${challenge.targetAmount}`);

    const partnerProgress = document.createElement("p");

    partnerProgress.textContent = `Mahfuzur: 0 / ${challenge.targetAmount}`;
    progress.appendChild(partnerProgress);
    currentChallengeContainer.appendChild(progress);

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
        getChallengeStatusText(challenge.status)
    );

}


renderCurrentChallenge(currentChallenge);

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


newChallengeButton.addEventListener("click", () => {

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


confirmCancelChallengeButton.addEventListener("click", () => {

    GymPactStorage.cancelPact(currentChallenge.id);
    window.location.reload();

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
