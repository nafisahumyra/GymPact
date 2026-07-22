const pinLock = document.getElementById("pin-lock");
const pinForm = document.getElementById("pin-form");
const pinInput = document.getElementById("gympact-pin");
const pinError = document.getElementById("pin-error");
const unlockButton = document.getElementById("unlock-button");
const athleteSelection = document.getElementById("athlete-selection");


function showAthleteSelection() {

    pinLock.hidden = true;
    athleteSelection.hidden = false;

}


async function restoreUnlockedAthleteSelection() {

    const sessionToken = sessionStorage.getItem("gymPactSessionToken");

    if (!sessionToken) {

        return;

    }

    try {

        const supabase = GymPactSupabase.getClient();
        const { data, error } = await supabase.functions.invoke(
            "verify-gympact-session",
            { body: { sessionToken } }
        );

        if (error || !data?.valid) {

            sessionStorage.removeItem("gymPactSessionToken");
            sessionStorage.removeItem("gymPactSelectedAthleteId");
            localStorage.removeItem("currentUser");

            return;

        }

        sessionStorage.removeItem("gymPactSelectedAthleteId");
        localStorage.removeItem("currentUser");
        showAthleteSelection();

    } catch {

        sessionStorage.removeItem("gymPactSessionToken");
        sessionStorage.removeItem("gymPactSelectedAthleteId");
        localStorage.removeItem("currentUser");

    }

}


restoreUnlockedAthleteSelection();


pinInput.addEventListener("input", () => {

    pinInput.value = pinInput.value.replace(/\D/g, "").slice(0, 6);
    pinError.textContent = "";

});


pinForm.addEventListener("submit", async event => {

    event.preventDefault();

    const pin = pinInput.value;

    if (!/^\d{6}$/.test(pin)) {
        pinError.textContent = "⚠️ Incorrect PIN";
        return;
    }

    unlockButton.disabled = true;
    pinError.textContent = "";
    let verified = false;

    try {

        const supabase = GymPactSupabase.getClient();
        const { data, error } = await supabase.functions.invoke(
            "verify-gympact-pin",
            { body: { pin } }
        );

        if (error || !data?.verified || !data?.sessionToken) {
            pinError.textContent = "⚠️ Incorrect PIN";
            pinInput.select();
            return;
        }

        sessionStorage.setItem("gymPactSessionToken", data.sessionToken);
        verified = true;
        pinLock.classList.add("is-unlocking");
        window.setTimeout(showAthleteSelection, 650);

    } catch {

        pinError.textContent = "⚠️ Incorrect PIN";

    } finally {

        if (!verified) {
            unlockButton.disabled = false;
        }

    }

});


const userCards = document.querySelectorAll(".user-card");


async function resolveAthlete(selectedUser) {

    const supabase = GymPactSupabase.getClient();
    const { data, error } = await supabase
        .from("users")
        .select("id, display_name")
        .eq("display_name", selectedUser)
        .single();

    if (error || !data) {
        throw error || new Error("Athlete was not found.");
    }

    return data;

}


userCards.forEach(card => {

    card.addEventListener("click", async () => {

        const selectedUser = card.dataset.user;

        try {

            const athlete = await resolveAthlete(selectedUser);

            sessionStorage.setItem("gymPactSelectedAthleteId", athlete.id);
            localStorage.setItem("currentUser", athlete.display_name);

            window.location.href = "dashboard.html";

        } catch (error) {

            console.error("Unable to resolve the selected athlete.", error);

        }

    });

});
