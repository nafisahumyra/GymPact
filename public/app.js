const pinLock = document.getElementById("pin-lock");
const pinForm = document.getElementById("pin-form");
const pinInput = document.getElementById("gympact-pin");
const pinError = document.getElementById("pin-error");
const unlockButton = document.getElementById("unlock-button");
const athleteSelection = document.getElementById("athlete-selection");
const UNLOCK_ANIMATION_DURATION = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
).matches ? 500 : 3000;


function showAthleteSelection() {

    pinLock.hidden = true;
    athleteSelection.hidden = false;

}


async function restoreAthleteSelection() {

    const sessionToken = sessionStorage.getItem("gymPactSessionToken");

    if (!sessionToken) {

        sessionStorage.removeItem("gymPactSelectedAthleteId");
        localStorage.removeItem("currentUser");

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

        if (!sessionStorage.getItem("gymPactSelectedAthleteId") && data.athleteId) {

            const athlete = await resolveAthleteById(data.athleteId);

            if (!athlete) {

                sessionStorage.removeItem("gymPactSessionToken");
                return;

            }

            sessionStorage.setItem("gymPactSelectedAthleteId", athlete.id);
            localStorage.setItem("currentUser", athlete.display_name);
            window.location.href = "dashboard.html";
            return;

        }

        if (!sessionStorage.getItem("gymPactSelectedAthleteId")) {

            showAthleteSelection();

        }

    } catch {

        sessionStorage.removeItem("gymPactSessionToken");
        sessionStorage.removeItem("gymPactSelectedAthleteId");
        localStorage.removeItem("currentUser");

    }

}


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
        pinInput.disabled = true;
        pinLock.classList.add("is-unlocking");
        window.setTimeout(showAthleteSelection, UNLOCK_ANIMATION_DURATION);

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

async function resolveAthleteById(id) {

    const supabase = GymPactSupabase.getClient();
    const { data, error } = await supabase
        .from("users")
        .select("id, display_name")
        .eq("id", id)
        .maybeSingle();

    if (error || !data) return null;

    return data;

}


userCards.forEach(card => {

    card.addEventListener("click", async () => {

        const selectedUser = card.dataset.user;

        try {

            const athlete = await resolveAthlete(selectedUser);

            const sessionToken = sessionStorage.getItem("gymPactSessionToken");
            const { data: selection, error: selectionError } = await supabase.functions.invoke(
                "select-gympact-athlete",
                { body: { sessionToken, userId: athlete.id } }
            );

            if (selectionError || selection?.error) {

                throw selectionError || new Error(selection.error);

            }

            sessionStorage.setItem("gymPactSelectedAthleteId", athlete.id);
            localStorage.setItem("currentUser", athlete.display_name);

            window.location.href = "dashboard.html";

        } catch (error) {

            console.error("Unable to resolve the selected athlete.", error);

        }

    });

});


restoreAthleteSelection();
