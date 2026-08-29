(() => {
    const SESSION_KEY = "gymPactSessionToken";
    const ATHLETE_KEY = "gymPactSelectedAthleteId";
    const DISPLAY_NAME_KEY = "currentUser";
    const ATHLETE_NAMES = new Set(["Nafisa", "Mahfuzur"]);
    let redirecting = false;

    function clearIdentity() {

        sessionStorage.removeItem(SESSION_KEY);
        sessionStorage.removeItem(ATHLETE_KEY);
        localStorage.removeItem(DISPLAY_NAME_KEY);

    }

    function redirectToLanding() {

        if (redirecting) {

            return;

        }

        redirecting = true;
        const landingUrl = new URL("./index.html", window.location.href);

        if (new URLSearchParams(window.location.search).get("monthTest") === "1") {

            landingUrl.searchParams.set("monthTest", "1");

        }

        window.location.replace(landingUrl.toString());

    }

    async function validateAccess() {

        const sessionToken = sessionStorage.getItem(SESSION_KEY);

        if (!sessionToken) {

            clearIdentity();
            redirectToLanding();

            return;

        }

        const supabase = GymPactSupabase.getClient();
        const { data: session, error: sessionError } = await supabase.functions.invoke(
            "verify-gympact-session",
            { body: { sessionToken } }
        );

        if (sessionError || !session?.valid) {

            clearIdentity();
            redirectToLanding();

            return;

        }

        const athleteId = sessionStorage.getItem(ATHLETE_KEY);

        if (!athleteId) {

            localStorage.removeItem(DISPLAY_NAME_KEY);
            redirectToLanding();

            return;

        }

        const { data: athlete, error: athleteError } = await supabase
            .from("users")
            .select("id, display_name")
            .eq("id", athleteId)
            .maybeSingle();

        if (
            athleteError ||
            !athlete ||
            !ATHLETE_NAMES.has(athlete.display_name)
        ) {

            sessionStorage.removeItem(ATHLETE_KEY);
            localStorage.removeItem(DISPLAY_NAME_KEY);
            redirectToLanding();

            return;

        }

        // This is display-only convenience state. It never controls access.
        localStorage.setItem(DISPLAY_NAME_KEY, athlete.display_name);

        const pageScript = document.body.dataset.protectedScript;

        if (!pageScript) {

            throw new Error("Protected page script is not configured.");

        }

        const script = document.createElement("script");

        script.src = pageScript;
        script.addEventListener("load", () => {

            document.body.removeAttribute("data-protected-page");

        });
        script.addEventListener("error", redirectToLanding);
        document.body.appendChild(script);

    }

    validateAccess().catch(() => {

        clearIdentity();
        redirectToLanding();

    });
})();
