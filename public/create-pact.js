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


createPactForm.addEventListener("submit", async event => {

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

    const sessionToken = sessionStorage.getItem("gymPactSessionToken");
    const createdBy = sessionStorage.getItem("gymPactSelectedAthleteId");

    if (!sessionToken || !createdBy) {

        alert("Please unlock GymPact and choose your athlete first.");

        window.location.href = "index.html";

        return;

    }

    const submitButton = createPactForm.querySelector("button[type='submit']");

    submitButton.disabled = true;

    try {

        const supabase = GymPactSupabase.getClient();
        const { error } = await supabase.functions.invoke(
            "create-pact",
            {
                body: {
                    sessionToken,
                    createdBy,
                    goalType,
                    targetAmount,
                    timeframe,
                    wagerType,
                    wagerDescription,
                    startDate: formatLocalDate(startDate),
                    endDate: calculateEndDate(startDate, timeframe)
                }
            }
        );

        if (error) {

            const response = error.context;
            let message = "We couldn't create that challenge. Please try again.";

            if (response) {

                const errorData = await response.json().catch(() => null);

                if (errorData?.code === "open-pact") {

                    message = "You already have an active challenge.";

                }

            }

            throw new Error(message);

        }

    } catch (error) {

        console.error("Unable to create pact.", error);
        alert(error.message || "We couldn't create that challenge. Please try again.");

        return;

    } finally {

        submitButton.disabled = false;

    }

    window.location.href = "dashboard.html";

});


cancelPactButton.addEventListener("click", () => {

    window.location.href = "dashboard.html";

});
