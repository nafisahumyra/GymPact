const pinLock = document.getElementById("pin-lock");
const pinForm = document.getElementById("pin-form");
const pinInput = document.getElementById("gympact-pin");
const pinError = document.getElementById("pin-error");
const unlockButton = document.getElementById("unlock-button");
const athleteSelection = document.getElementById("athlete-selection");
const welcomeContainer = document.querySelector(".welcome-container");
const lockActor = pinLock.querySelector(".lock-actor");
const lockShackles = pinLock.querySelectorAll(".lock-shackle");
let unlockRevealPlaying = false;
let unlockRevealAnimations = [];


function showAthleteSelection({ focus = false } = {}) {

    pinLock.hidden = true;
    athleteSelection.classList.remove("unlock-reveal-target");
    athleteSelection.classList.add("athlete-selection-presented");
    athleteSelection.style.opacity = "";
    athleteSelection.hidden = false;

    if (focus) {
        athleteSelection.focus({ preventScroll: true });
    }

}


function prepareAthleteSelectionForReveal() {

    athleteSelection.hidden = false;
    athleteSelection.classList.add("athlete-selection-presented");
    athleteSelection.classList.add("unlock-reveal-target");
    athleteSelection.style.opacity = "0";

}


function dismissUnlockReveal() {

    unlockRevealAnimations.forEach(animation => animation.cancel());
    unlockRevealAnimations = [];
    unlockRevealPlaying = false;

    showAthleteSelection({ focus: true });

}


function animateUnlock(element, keyframes, options) {

    const animation = element.animate(keyframes, options);
    unlockRevealAnimations.push(animation);
    return animation.finished;

}


async function playUnlockReveal() {

    if (unlockRevealPlaying) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !lockActor || !lockShackles.length) {
        dismissUnlockReveal();
        return;
    }

    unlockRevealPlaying = true;
    lockShackles.forEach(shackle => {
        shackle.style.transform = "none";
    });

    const finishOnInterruption = () => {
        if (document.hidden && unlockRevealPlaying) dismissUnlockReveal();
    };

    document.addEventListener("visibilitychange", finishOnInterruption);

    try {
        await animateUnlock(
            lockActor,
            [
                { transform: "rotate(0deg)", offset: 0 },
                { transform: "rotate(-4deg)", offset: .18 },
                { transform: "rotate(4deg)", offset: .38 },
                { transform: "rotate(-2.5deg)", offset: .58 },
                { transform: "rotate(1deg)", offset: .78 },
                { transform: "rotate(0deg)", offset: 1 }
            ],
            { duration: 650, easing: "ease-in-out", fill: "forwards" }
        );
        if (!unlockRevealPlaying) return;

        await Promise.all([...lockShackles].map(shackle => animateUnlock(
            shackle,
            [
                { transform: "translateY(0) rotate(0deg)", offset: 0 },
                { transform: "translateY(-20px) rotate(-4deg)", offset: .8 },
                { transform: "translateY(-18px) rotate(-3deg)", offset: 1 }
            ],
            { duration: 550, easing: "cubic-bezier(.22,.7,.25,1)", fill: "forwards" }
        )));
        if (!unlockRevealPlaying) return;
        lockShackles.forEach(shackle => {
            shackle.style.transform = "translateY(-18px) rotate(-3deg)";
        });

        await animateUnlock(
            lockActor,
            [
                { transform: "translateY(0)" },
                { transform: "translateY(-2px)", offset: .45 },
                { transform: "translateY(0)" }
            ],
            { duration: 300, easing: "ease-in-out", fill: "forwards" }
        );
        if (!unlockRevealPlaying) return;

        // Keep the athlete picker in its final position behind the original
        // lock, avoiding a layout jump when the final dissolve completes.
        prepareAthleteSelectionForReveal();
        await Promise.all([
            animateUnlock(
                pinLock,
                [{ opacity: 1 }, { opacity: 0 }],
                { duration: 650, easing: "ease-in-out", fill: "forwards" }
            ),
            animateUnlock(
                athleteSelection,
                [{ opacity: 0 }, { opacity: 1 }],
                { duration: 650, easing: "ease-in-out", fill: "forwards" }
            )
        ]);
    } catch (error) {
        console.warn("GymPact unlock reveal did not complete.", error);
    } finally {
        document.removeEventListener("visibilitychange", finishOnInterruption);
        if (unlockRevealPlaying) dismissUnlockReveal();
    }

}


window.addEventListener("pagehide", () => {

    unlockRevealAnimations.forEach(animation => animation.cancel());
    unlockRevealAnimations = [];
    unlockRevealPlaying = false;

});


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
        await playUnlockReveal();

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

            sessionStorage.setItem("gymPactSelectedAthleteId", athlete.id);
            localStorage.setItem("currentUser", athlete.display_name);

            window.location.href = "dashboard.html";

        } catch (error) {

            console.error("Unable to resolve the selected athlete.", error);

        }

    });

});


restoreAthleteSelection();
