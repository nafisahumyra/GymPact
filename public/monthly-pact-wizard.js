(function () {
    const icon = path => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
    const arrow = icon('<path d="m5 12 14 0M13 6l6 6-6 6"/>');
    const targetIcon = icon('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v2M22 12h-2"/>');
    const layersIcon = icon('<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 17l9 4 9-4"/>');
    const chartIcon = icon('<path d="M4 19V5M4 19h16"/><path d="m7 15 4-5 3 3 5-7"/>');
    const noteIcon = icon('<path d="M5 3h11l3 3v15H5z"/><path d="M15 3v4h4M8 12h8M8 16h6"/>');
    const escape = value => String(value ?? "").replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
    const monthValue = monthStart => String(monthStart || "").slice(0, 7);

    function open(options) {
        const state = {
            step: 0,
            goalType: options.initial?.goalType || "single_attempt",
            trackingMode: options.initial?.trackingMode || "track",
            busy: false,
            creator: options.mode !== "accept",
            goal: options.initial?.goal || "",
            consequence: options.initial?.consequence || options.consequence || "",
            target: options.initial?.target ?? "",
            unit: options.initial?.unit || "reps",
            startingValue: options.initial?.startingValue ?? "",
            initials: ""
        };
        const overlay = document.createElement("div");
        overlay.className = "gp-monthly-wizard-overlay";
        overlay.setAttribute("role", "presentation");
        overlay.innerHTML = `<article class="gp-monthly-wizard" role="dialog" aria-modal="true" aria-label="${state.creator ? "New monthly pact" : "Review monthly pact"}">
            <header class="gp-monthly-wizard__header"><span>${state.creator ? "New monthly pact" : "Review monthly pact"}</span><span class="gp-monthly-wizard__step-count"></span></header>
            <div class="gp-monthly-wizard__steps" aria-label="Setup progress"><span></span><span></span><span></span><span></span></div>
            <form novalidate>
                <section data-step="0"><p class="gp-monthly-wizard__eyebrow">THE AGREEMENT</p><h2>What are you<br>working toward?</h2><p class="gp-monthly-wizard__intro">Your goals can be different. You share the commitment.</p>
                    <label>Pact month<input data-field="month" type="month" readonly></label>
                    <div data-creator-only><label>Your goal<textarea data-field="goal" rows="2" placeholder="Run a mile in 10 minutes."></textarea></label><label>Partner<input data-field="partner" readonly></label></div>
                    <div data-accept-only hidden><label data-partner-goal-label></label><textarea data-field="partner-goal" rows="2" readonly></textarea><label>Your goal<textarea data-field="goal" rows="2" placeholder="Run a mile in 10 minutes."></textarea></label></div>
                    <label>Shared consequence<textarea data-field="consequence" rows="2" placeholder="What will you both agree to do?"></textarea></label><p class="gp-monthly-wizard__fine" data-agreement-note></p>
                </section>
                <section data-step="1" hidden><p class="gp-monthly-wizard__eyebrow">YOUR GOAL</p><h2>How does your<br>progress work?</h2><p class="gp-monthly-wizard__intro">Choose the approach that fits your goal.</p>
                    <button type="button" class="gp-monthly-wizard__choice" data-goal-type="single_attempt">${targetIcon}<span class="gp-monthly-wizard__choice-copy"><strong>Single attempt</strong><small>Work toward a result in one attempt.</small><em>Example: 5 clean pull-ups in a row</em></span><span class="gp-monthly-wizard__radio"></span></button>
                    <button type="button" class="gp-monthly-wizard__choice" data-goal-type="cumulative">${layersIcon}<span class="gp-monthly-wizard__choice-copy"><strong>Cumulative</strong><small>Build toward a total over the month.</small><em>Example: Run 20 miles this month</em></span><span class="gp-monthly-wizard__radio"></span></button>
                    <p class="gp-monthly-wizard__fine">Not interested in numbers? You can choose check-ins only next.</p>
                </section>
                <section data-step="2" hidden><p class="gp-monthly-wizard__eyebrow">YOUR UPDATES</p><h2>How would you<br>like to check in?</h2><p class="gp-monthly-wizard__intro">Keep it measurable, or just share your journey.</p>
                    <button type="button" class="gp-monthly-wizard__choice" data-tracking-mode="track">${chartIcon}<span class="gp-monthly-wizard__choice-copy"><strong>Track progress + check-ins</strong><small>Update a number and add optional notes.</small></span><span class="gp-monthly-wizard__radio"></span></button>
                    <button type="button" class="gp-monthly-wizard__choice" data-tracking-mode="checkins_only">${noteIcon}<span class="gp-monthly-wizard__choice-copy"><strong>Check-ins only</strong><small>Share notes without a numeric target.</small></span><span class="gp-monthly-wizard__radio"></span></button>
                    <div data-numeric><div class="gp-monthly-wizard__fields"><label>Target<input data-field="target" inputmode="decimal" min="0.01" step="any" type="number"></label><label>Unit<select data-field="unit"><option>reps</option><option>minutes</option><option>miles</option><option>kilometres</option><option>sessions</option><option>laps</option></select></label></div><label data-start-label>Current best<input data-field="starting-value" inputmode="decimal" min="0" step="any" type="number"></label><p class="gp-monthly-wizard__fine">You control this value, including corrections. Notes don’t change it automatically.</p></div>
                    <p class="gp-monthly-wizard__fine">Updates are shared with ${escape(options.partnerName || "your Pact partner")}. Marking your goal achieved is always a separate action.</p>
                </section>
                <section data-step="3" hidden><p class="gp-monthly-wizard__eyebrow">ONE LAST LOOK</p><h2>Ready to make<br>a pact?</h2><div class="gp-monthly-wizard__review"><span class="gp-monthly-wizard__review-month"></span><h3></h3><div class="gp-monthly-wizard__review-tracking"></div></div><div class="gp-monthly-wizard__review-row"><span>Partner</span><strong></strong></div><div class="gp-monthly-wizard__review-consequence"><span>Shared consequence</span><p></p></div><p class="gp-monthly-wizard__fine" data-review-note></p><label>Your initials<input class="gp-monthly-wizard__initials" data-field="initials" type="text" maxlength="6" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Initials"></label><p class="gp-monthly-wizard__fine">By initialing, you agree to this pact and its shared consequence.</p></section>
                <p class="gp-monthly-wizard__error" role="alert" aria-live="polite" hidden></p><footer class="gp-monthly-wizard__footer"><button class="gp-monthly-wizard__back" type="button" hidden>Back</button><button class="gp-monthly-wizard__next" type="submit">Continue${arrow}</button></footer>
            </form><button class="gp-monthly-wizard__cancel" type="button">Cancel</button>
        </article>`;
        document.body.appendChild(overlay);
        const root = overlay.querySelector(".gp-monthly-wizard");
        const form = root.querySelector("form");
        const field = name => root.querySelector(`[data-field="${name}"]`);
        const error = root.querySelector(".gp-monthly-wizard__error");
        const close = () => { overlay.remove(); options.onClose?.(); };
        const setError = message => { error.textContent = message || ""; error.hidden = !message; };
        field("month").value = monthValue(options.monthStart);
        field("partner").value = options.partnerName || "";
        field("partner-goal").value = options.partnerGoal || "";
        root.querySelector("[data-partner-goal-label]").textContent = `${options.partnerName || "Partner"}’s goal`;
        root.querySelector("[data-creator-only]").hidden = !state.creator;
        root.querySelector("[data-accept-only]").hidden = state.creator;
        if (!state.creator) field("consequence").readOnly = true;
        root.querySelector("[data-agreement-note]").textContent = state.creator
            ? "Your partner adds their own goal and tracking preferences when accepting."
            : "Review the agreement, then choose your own goal and tracking preferences.";
        root.querySelector("[data-review-note]").textContent = state.creator
            ? "Your partner reviews the agreement, adds their own goal, and signs before the pact becomes active."
            : "Your signature activates the pact once all details are saved.";
        field("goal").value = state.goal;
        field("consequence").value = state.consequence;
        field("target").value = state.target;
        field("unit").value = state.unit;
        field("starting-value").value = state.startingValue;

        function capture() { state.goal = field("goal").value; state.consequence = field("consequence").value; state.target = field("target").value; state.unit = field("unit").value; state.startingValue = field("starting-value").value; state.initials = field("initials").value.toUpperCase(); }
        function trackingText() { if (state.trackingMode === "checkins_only") return "Check-ins only · No numeric target"; const prefix = state.goalType === "single_attempt" ? "Single attempt · Current best" : "Cumulative · Progress so far"; return `${prefix}: ${state.startingValue} / ${state.target} ${state.unit} · Check-ins included`; }
        function render() {
            root.querySelectorAll("[data-step]").forEach((page, index) => { page.hidden = index !== state.step; });
            root.querySelectorAll(".gp-monthly-wizard__steps span").forEach((item, index) => item.classList.toggle("is-current", index <= state.step));
            root.querySelector(".gp-monthly-wizard__step-count").textContent = `${state.step + 1} of 4`;
            root.querySelector(".gp-monthly-wizard__back").hidden = state.step === 0 || state.busy;
            const next = root.querySelector(".gp-monthly-wizard__next"); next.disabled = state.busy; next.innerHTML = state.step === 3 ? (state.busy ? "Saving…" : state.creator ? "Sign & send pact" : "Sign & accept") : `Continue${arrow}`;
            root.querySelectorAll("[data-goal-type]").forEach(button => { const selected = button.dataset.goalType === state.goalType; button.classList.toggle("is-selected", selected); button.setAttribute("aria-pressed", String(selected)); });
            root.querySelectorAll("[data-tracking-mode]").forEach(button => { const selected = button.dataset.trackingMode === state.trackingMode; button.classList.toggle("is-selected", selected); button.setAttribute("aria-pressed", String(selected)); });
            root.querySelector("[data-numeric]").hidden = state.trackingMode === "checkins_only";
            root.querySelector("[data-start-label]").firstChild.textContent = state.goalType === "single_attempt" ? "Current best" : "Progress so far";
            if (state.step === 3) { root.querySelector(".gp-monthly-wizard__review-month").textContent = options.monthLabel || "Monthly pact"; root.querySelector(".gp-monthly-wizard__review h3").textContent = state.goal.trim(); root.querySelector(".gp-monthly-wizard__review-tracking").textContent = trackingText(); root.querySelector(".gp-monthly-wizard__review-row strong").textContent = options.partnerName || "Your partner"; root.querySelector(".gp-monthly-wizard__review-consequence p").textContent = state.consequence.trim(); }
            setError("");
        }
        function validate() {
            capture();
            if (state.step === 0 && (!state.goal.trim() || !state.consequence.trim())) return "Add your goal and shared consequence.";
            if (state.step === 2 && state.trackingMode === "track" && (!(Number(state.target) > 0) || state.startingValue === "" || Number(state.startingValue) < 0)) return "Enter a positive target and a starting value of zero or more.";
            if (state.step === 3 && !state.initials.trim()) return "Add your initials to sign the pact.";
            return "";
        }
        root.querySelectorAll("[data-goal-type]").forEach(button => button.addEventListener("click", () => { capture(); state.goalType = button.dataset.goalType; render(); }));
        root.querySelectorAll("[data-tracking-mode]").forEach(button => button.addEventListener("click", () => { capture(); state.trackingMode = button.dataset.trackingMode; render(); }));
        root.querySelector(".gp-monthly-wizard__back").addEventListener("click", () => { capture(); state.step -= 1; render(); });
        root.querySelector(".gp-monthly-wizard__cancel").addEventListener("click", close);
        overlay.addEventListener("click", event => { if (event.target === overlay && !state.busy) close(); });
        field("initials").addEventListener("input", () => { const cursor = field("initials").selectionStart; field("initials").value = field("initials").value.toUpperCase(); field("initials").setSelectionRange(cursor, cursor); });
        form.addEventListener("submit", async event => { event.preventDefault(); if (state.busy) return; const message = validate(); if (message) { setError(message); return; } if (state.step < 3) { state.step += 1; render(); return; } state.busy = true; render(); try { await options.onSubmit({ goal: state.goal.trim(), consequence: state.consequence.trim(), signature: state.initials.trim(), goalType: state.goalType, trackingMode: state.trackingMode, target: state.trackingMode === "track" ? Number(state.target) : null, unit: state.trackingMode === "track" ? state.unit : null, startingValue: state.trackingMode === "track" ? Number(state.startingValue) : null }); close(); } catch (submitError) { state.busy = false; render(); setError(submitError?.message || "We couldn’t save that Month Pact. Please try again."); } });
        render();
        window.setTimeout(() => field("goal").focus(), 0);
        return { close };
    }
    window.GymPactMonthlyWizard = { open };
})();
