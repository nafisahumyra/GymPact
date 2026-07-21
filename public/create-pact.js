const createPactForm =
    document.getElementById("create-pact-form");

const cancelPactButton =
    document.getElementById("cancel-pact");


function formatLocalDate(date) {

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;

}


function calculateEndDate(startDate, timeframe) {

    const endDate = new Date(startDate);


    if (timeframe === "day") {

        endDate.setDate(endDate.getDate() + 1);

    } else if (timeframe === "week") {

        endDate.setDate(endDate.getDate() + 7);

    } else if (timeframe === "month") {

        endDate.setMonth(endDate.getMonth() + 1);

    }


    return formatLocalDate(endDate);

}


createPactForm.addEventListener("submit", event => {

    event.preventDefault();

    const goalType =
        document.getElementById("pact-goal-type").value;

    const targetAmount = Number(
        document.getElementById("pact-target-amount").value
    );

    const timeframe =
        document.getElementById("pact-timeframe").value;

    const wagerType =
        document.getElementById("pact-wager-type").value;

    const wagerDescription =
        document.getElementById("pact-wager-description").value.trim();


    if (
        !goalType ||
        !Number.isInteger(targetAmount) ||
        targetAmount < 1 ||
        !timeframe ||
        !wagerType ||
        !wagerDescription
    ) {

        alert("Please complete all Pact details.");

        return;

    }


    const startDate = new Date();

    const pact = GymPactStorage.createPact({
        participants: ["nafisa", "mahfuzur"],
        goalType: goalType,
        targetAmount: targetAmount,
        timeframe: timeframe,
        wagerType: wagerType,
        wagerDescription: wagerDescription,
        status: "pending",
        startDate: formatLocalDate(startDate),
        endDate: calculateEndDate(startDate, timeframe)
    });


    if (!pact) {

        alert("You already have an active challenge.");

        window.location.href = "dashboard.html";

        return;

    }

    window.location.href = "dashboard.html";

});


cancelPactButton.addEventListener("click", () => {

    window.location.href = "dashboard.html";

});
