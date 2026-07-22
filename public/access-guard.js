(function protectGymPactPage() {
    const protectedContent = document.querySelector("[data-protected-content]");
    const protectedPageScript = document.querySelector(
        "[data-protected-page-script]"
    );

    function logNavigation(event, details = {}) {

        console.info("GymPact navigation", {
            event,
            pathname: window.location.pathname,
            hasSessionToken: Boolean(
                sessionStorage.getItem("gymPactSessionToken")
            ),
            hasAthleteId: Boolean(
                sessionStorage.getItem("gymPactSelectedAthleteId")
            ),
            currentUser: localStorage.getItem("currentUser"),
            ...details
        });

    }

    function redirectToLanding(reason) {

        logNavigation("redirect", {
            destination: "./index.html",
            reason
        });

        window.location.replace("./index.html");

    }

    function loadProtectedPageScript() {

        if (!protectedPageScript?.dataset.protectedPageScript) {

            redirectToLanding("protected-page-script-missing");

            return;

        }

        const pageScript = document.createElement("script");

        pageScript.src = protectedPageScript.dataset.protectedPageScript;
        pageScript.async = false;
        pageScript.addEventListener("load", () => {

            logNavigation("protected-page-ready");
            protectedContent.hidden = false;

        });
        pageScript.addEventListener("error", () => {

            redirectToLanding("protected-page-script-failed");

        });

        document.body.appendChild(pageScript);

    }

    async function verifyPageAccess() {

        const sessionToken = sessionStorage.getItem("gymPactSessionToken");

        logNavigation("protected-page-check-start");

        if (!sessionToken) {

            redirectToLanding("session-missing");

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

                logNavigation("session-verification-result", {
                    sessionValid: Boolean(sessionData?.valid)
                });
                redirectToLanding("session-invalid");

                return;

            }

            logNavigation("session-verification-result", {
                sessionValid: true
            });

            const athleteId = sessionStorage.getItem(
                "gymPactSelectedAthleteId"
            );

            if (!athleteId) {

                redirectToLanding("athlete-missing");

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

                redirectToLanding("athlete-invalid");

                return;

            }

            localStorage.setItem("currentUser", athlete.display_name);
            logNavigation("athlete-validated");
            loadProtectedPageScript();

        } catch (error) {

            console.error("Unable to verify GymPact page access.", error);
            redirectToLanding("validation-error");

        }

    }

    verifyPageAccess();
})();
