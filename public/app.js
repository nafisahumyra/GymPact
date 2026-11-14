const pinLock = document.getElementById("pin-lock");
const pinForm = document.getElementById("pin-form");
const pinInput = document.getElementById("gympact-pin");
const pinError = document.getElementById("pin-error");
const unlockButton = document.getElementById("unlock-button");
const athleteSelection = document.getElementById("athlete-selection");
const unlockReveal = document.getElementById("unlock-reveal");
const unlockRevealLock = unlockReveal?.querySelector(".unlock-reveal-lock");
const unlockRevealShackle = unlockReveal?.querySelector(".unlock-reveal-shackle");
let unlockRevealPlaying = false;
let unlockRevealAnimations = [];


function showAthleteSelection({ focus = false } = {}) {

    pinLock.hidden = true;
    athleteSelection.hidden = false;

    if (focus) {
        athleteSelection.focus({ preventScroll: true });
    }

}


function dismissUnlockReveal() {

    unlockRevealAnimations.forEach(animation => animation.cancel());
    unlockRevealAnimations = [];
    unlockRevealPlaying = false;

    if (unlockReveal) {
        unlockReveal.hidden = true;
        unlockReveal.inert = true;
        unlockReveal.setAttribute("aria-hidden", "true");
    }

    showAthleteSelection({ focus: true });

}


function animateUnlock(element, keyframes, options) {

    const animation = element.animate(keyframes, options);
    unlockRevealAnimations.push(animation);
    return animation.finished;

}


async function playUnlockReveal() {

    if (unlockRevealPlaying) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !unlockReveal || !unlockRevealLock || !unlockRevealShackle) {
        dismissUnlockReveal();
        return;
    }

    unlockRevealPlaying = true;
    unlockReveal.hidden = false;
    unlockReveal.inert = false;
    unlockReveal.setAttribute("aria-hidden", "false");
    unlockRevealShackle.style.transform = "none";

    const finishOnInterruption = () => {
        if (document.hidden && unlockRevealPlaying) dismissUnlockReveal();
    };

    document.addEventListener("visibilitychange", finishOnInterruption);

    try {
        await animateUnlock(
            unlockRevealLock,
            [0, -6, 5, -3, 1, 0].map(rotation => ({ transform: `rotate(${rotation}deg)` })),
            { duration: 480, easing: "ease-in-out" }
        );
        if (!unlockRevealPlaying) return;

        const openShackle = "translateY(-13px) rotate(-23deg)";
        await animateUnlock(
            unlockRevealShackle,
            [
                { transform: "none" },
                { transform: openShackle, offset: .78 },
                { transform: openShackle }
            ],
            { duration: 450, easing: "ease-out", fill: "forwards" }
        );
        if (!unlockRevealPlaying) return;
        unlockRevealShackle.style.transform = openShackle;

        await animateUnlock(
            unlockRevealLock,
            [
                { transform: "scale(1)", opacity: 1 },
                { transform: "scale(1.12)", opacity: 1, offset: .28 },
                { transform: "scale(5)", opacity: 0 }
            ],
            { duration: 660, easing: "ease-in", fill: "forwards" }
        );
        if (!unlockRevealPlaying) return;

        await animateUnlock(
            unlockReveal,
            [{ opacity: 1 }, { opacity: 0 }],
            { duration: 270, fill: "forwards" }
        );
    } catch (error) {
        console.warn("GymPact unlock reveal did not complete.", error);
    } finally {
        document.removeEventListener("visibilitychange", finishOnInterruption);
        if (unlockRevealPlaying) dismissUnlockReveal();
    }

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
