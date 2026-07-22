(function initializeGymPactSupabase(window) {
    const config = window.GYMPACT_SUPABASE_CONFIG || {};
    const hasConfiguration =
        typeof config.url === "string" &&
        config.url.startsWith("https://") &&
        !config.url.includes("YOUR_PROJECT_REF") &&
        typeof config.anonKey === "string" &&
        config.anonKey.length > 0 &&
        !config.anonKey.includes("YOUR_SUPABASE_ANON_KEY");

    let client;

    function getClient() {
        if (!hasConfiguration) {
            throw new Error("Supabase is not configured. Update supabase-config.js first.");
        }

        if (!window.supabase) {
            throw new Error("The Supabase browser library did not load.");
        }

        if (!client) {
            client = window.supabase.createClient(config.url, config.anonKey);
        }

        return client;
    }

    window.GymPactSupabase = Object.freeze({
        isConfigured: () => hasConfiguration,
        getClient
    });
})(window);
