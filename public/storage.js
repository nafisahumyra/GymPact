const STORAGE_KEYS = {
    currentUser: "currentUser",
    workouts: "workouts",
    pacts: "pacts"
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


function getPacts() {

    return JSON.parse(localStorage.getItem(STORAGE_KEYS.pacts)) || [];

}


function savePacts(pacts) {

    localStorage.setItem(
        STORAGE_KEYS.pacts,
        JSON.stringify(pacts)
    );

}


function getActivePact() {

    return getPacts().find(pact => {

        return pact.status === "pending" || pact.status === "active";

    }) || null;

}


function cancelPact(pactId) {

    const pacts = getPacts();
    const pact = pacts.find(currentPact => currentPact.id === pactId);


    if (!pact) {

        return null;

    }

    pact.status = "cancelled";
    pact.cancelledAt = new Date().toISOString();

    savePacts(pacts);

    return pact;

}


function generatePactId() {

    if (
        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function"
    ) {

        return crypto.randomUUID();

    }

    return `pact-${Date.now()}-${Math.random().toString(16).slice(2)}`;

}


function createPact(pactDetails = {}) {

    const status = pactDetails.status ?? "draft";


    if (
        (status === "pending" || status === "active") &&
        getActivePact()
    ) {

        return null;

    }

    const pact = {
        id: generatePactId(),
        participants: pactDetails.participants ?? ["nafisa", "mahfuzur"],
        goalType: pactDetails.goalType ?? "workouts",
        targetAmount: pactDetails.targetAmount ?? null,
        timeframe: pactDetails.timeframe ?? null,
        wagerType: pactDetails.wagerType ?? null,
        wagerDescription: pactDetails.wagerDescription ?? "",
        status: status,
        createdAt: pactDetails.createdAt ?? new Date().toISOString(),
        startDate: pactDetails.startDate ?? null,
        endDate: pactDetails.endDate ?? null
    };

    const pacts = getPacts();

    pacts.push(pact);
    savePacts(pacts);

    return pact;

}


window.GymPactStorage = {
    getCurrentUser,
    getWorkouts,
    saveWorkouts,
    clearWorkouts,
    getPacts,
    savePacts,
    getActivePact,
    cancelPact,
    createPact
};
