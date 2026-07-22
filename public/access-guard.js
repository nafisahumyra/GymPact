(function protectGymPactPage() {
    const protectedContent = document.querySelector("[data-protected-content]");
    const protectedPageScript = document.querySelector(
        "[data-protected-page-script]"
    );

    function clearAthleteIdentity() {

        sessionStorage.removeItem("gymPactSelectedAthleteId");
        localStorage.removeItem("currentUser");

    }

    function redirectToLanding() {

        window.location.replace("./index.html");

    }

    function loadProtectedPageScript() {

        if (!protectedPageScript?.dataset.protectedPageScript) {

            redirectToLanding();

            return;

        }

        const pageScript = document.createElement("script");

        pageScript.src = protectedPageScript.dataset.protectedPageScript;
        pageScript.async = false;
        pageScript.addEventListener("load", () => {

            protectedContent.hidden = false;

        });
        pageScript.addEventListener("error", () => {

            redirectToLanding();

        });

        document.body.appendChild(pageScript);

    }

    async function verifyPageAccess() {

        const sessionToken = sessionStorage.getItem("gymPactSessionToken");

        if (!sessionToken) {

            clearAthleteIdentity();
            redirectToLanding();

            return;

        }

        try {

            const supabase = GymPactSupabase.getClient();
            const { data: sessionData, error: sessionError } =
                await supabase.functions.invoke(
                    "verify-gympact-session",
                    { body: { sessionToken } }
                );

            if (sessionError || !sessionData?.valid) {

                clearAthleteIdentity();
                redirectToLanding();

                return;

            }

            const athleteId = sessionStorage.getItem(
                "gymPactSelectedAthleteId"
            );

            if (!athleteId) {

                clearAthleteIdentity();
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
                !["Nafisa", "Mahfuzur"].includes(athlete.display_name)
            ) {

                clearAthleteIdentity();
                redirectToLanding();

                return;

            }

            localStorage.setItem("currentUser", athlete.display_name);
            loadProtectedPageScript();

        } catch (error) {

            console.error("Unable to verify GymPact page access.", error);
            clearAthleteIdentity();
            redirectToLanding();

        }

    }

    verifyPageAccess();
})();
