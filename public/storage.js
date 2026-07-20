const STORAGE_KEYS = {
    currentUser: "currentUser",
    workouts: "workouts"
};


function getCurrentUser() {

    return localStorage.getItem(STORAGE_KEYS.currentUser);

}


function getWorkouts() {

    return JSON.parse(localStorage.getItem(STORAGE_KEYS.workouts)) || [];

}


function saveWorkouts(workouts) {

    localStorage.setItem(
        STORAGE_KEYS.workouts,
        JSON.stringify(workouts)
    );

}


function clearWorkouts() {

    localStorage.removeItem(STORAGE_KEYS.workouts);

}


window.GymPactStorage = {
    getCurrentUser,
    getWorkouts,
    saveWorkouts,
    clearWorkouts
};
