(function () {
    const icon = path => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
    const arrow = icon('<path d="m5 12 14 0M13 6l6 6-6 6"/>');
    const closeIcon = icon('<path d="m6 6 12 12M18 6 6 18"/>');
    const flagIcon = icon('<path d="M5 21V4m0 1c4-3 7 3 14 0v10c-7 3-10-3-14 0"/>');
    const giftIcon = icon('<rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13M3 12h18M12 8H7.5a2.5 2.5 0 1 1 2.5-2.5V8Zm0 0h4.5A2.5 2.5 0 1 0 14 5.5V8Z"/>');
    const requirementTypes = [
        { type: "workouts", label: "Workouts", detail: "workouts this week", unit: "workouts" },
        { type: "steps", label: "Steps", detail: "steps this week", unit: "steps" },
        { type: "pushups", label: "Pushups", detail: "reps this week", unit: "reps" },
        { type: "pullups", label: "Pullups", detail: "reps this week", unit: "reps" },
        { type: "hiit", label: "HIIT sessions", detail: "HIIT sessions this week", unit: "sessions" },
    ];
    const typeMeta = type => requirementTypes.find(item => item.type === type) || { type, label: type, detail: "target this week", unit: "" };
    const formatDate = value => new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

    function open(options) {
        const renewal = options.mode === "renewal";
        const initial = Array.isArray(options.initialRequirements) ? options.initialRequirements : [];
        const workouts = initial.find(item => item.type === "workouts");
        const state = {
            step: 0, busy: false, wagerType: "punishment", wagers: { punishment: "", reward: "" }, initials: "",
            requirements: [{ type: "workouts", targetAmount: workouts?.targetAmount ?? "" }, ...initial.filter(item => item.type !== "workouts").map(item => ({ type: item.type, targetAmount: item.targetAmount }))]
        };
        const overlay = document.createElement("div");
        overlay.className = "gp-weekly-wizard-overlay";
        overlay.setAttribute("role", "presentation");
        overlay.innerHTML = `<article class="gp-weekly-wizard" role="dialog" aria-modal="true" aria-label="${renewal ? "Renew weekly pact" : "New weekly pact"}">
          <header class="gp-weekly-wizard__header"><span>New weekly pact</span><span class="gp-weekly-wizard__step-count"></span></header>
          <div class="gp-weekly-wizard__steps" aria-label="Setup progress"><span></span><span></span><span></span><span></span></div>
          <form novalidate>
            <section data-step="0"><p class="gp-weekly-wizard__eyebrow">THE WEEK</p><h2 class="gp-weekly-wizard__week-heading">${renewal ? "Plan your next week." : "Plan your week."}</h2><label>Partner<input data-field="partner" readonly></label><label>Starts<input data-field="start" type="date" readonly></label><label>Ends<input data-field="end" type="date" readonly></label></section>
            <section data-step="1" hidden><p class="gp-weekly-wizard__eyebrow">YOUR GOALS</p><h2>${renewal ? "Same goals,<br>or a few changes?" : "What’s your goal<br>for the week?"}</h2><div class="gp-weekly-wizard__goal-rows"></div><button class="gp-weekly-wizard__add" type="button">+ Add requirement</button><div class="gp-weekly-wizard__picker" hidden><label>Requirement<select data-field="new-requirement"></select></label><button type="button" data-add-confirm>Add</button></div></section>
            <section data-step="2" hidden><p class="gp-weekly-wizard__eyebrow">THE WAGER</p><h2 class="gp-weekly-wizard__wager-heading">Make it worth<br>showing up for.</h2><button type="button" class="gp-weekly-wizard__choice" data-wager="punishment">${flagIcon}<span class="gp-weekly-wizard__choice-copy"><strong>Consequence</strong><small>A challenge if the pact isn’t met.</small></span><span class="gp-weekly-wizard__radio"></span></button><button type="button" class="gp-weekly-wizard__choice" data-wager="reward">${giftIcon}<span class="gp-weekly-wizard__choice-copy"><strong>Reward</strong><small>Something to look forward to.</small></span><span class="gp-weekly-wizard__radio"></span></button><label data-wager-label>Consequence<textarea data-field="wager" rows="3" placeholder="Embarrassing Challenge"></textarea></label></section>
            <section data-step="3" hidden><p class="gp-weekly-wizard__eyebrow">REVIEW &amp; SEND</p><h2>Your week.<br>Your commitment.</h2><div class="gp-weekly-wizard__review"><span class="gp-weekly-wizard__review-dates"></span><h3></h3><div class="gp-weekly-wizard__review-goals"></div></div><div class="gp-weekly-wizard__review-wager"><span></span><p></p></div><label>Your initials<input class="gp-weekly-wizard__initials" data-field="initials" maxlength="6" placeholder="Initials" autocapitalize="characters" autocomplete="off" spellcheck="false"></label><p class="gp-weekly-wizard__fine">By initialing, you agree to this pact and its wager.</p><p class="gp-weekly-wizard__fine">Your partner reviews and accepts before the new pact becomes active.</p></section>
            <p class="gp-weekly-wizard__error" role="alert" aria-live="polite" hidden></p><footer class="gp-weekly-wizard__footer"><button class="gp-weekly-wizard__back" type="button">Cancel</button><button class="gp-weekly-wizard__next" type="submit">Continue${arrow}</button></footer>
          </form>
        </article>`;
        document.body.appendChild(overlay);
        const root = overlay.querySelector(".gp-weekly-wizard");
        const form = root.querySelector("form");
        const field = name => root.querySelector(`[data-field="${name}"]`);
        const error = root.querySelector(".gp-weekly-wizard__error");
        const setError = message => { error.textContent = message || ""; error.hidden = !message; };
        const close = () => { overlay.remove(); options.onClose?.(); };
        field("partner").value = options.partnerName || "Your Pact partner";
        field("start").value = options.startDate || "";
        field("end").value = options.endDate || "";

        function usedTypes() { return state.requirements.map(requirement => requirement.type); }
        function renderGoals() {
            const rows = root.querySelector(".gp-weekly-wizard__goal-rows"); rows.replaceChildren();
            state.requirements.forEach((requirement, index) => {
                const meta = typeMeta(requirement.type); const row = document.createElement("div"); row.className = "gp-weekly-wizard__goal-row";
                const copy = document.createElement("div"); copy.className = "gp-weekly-wizard__goal-copy"; copy.innerHTML = `<strong>${meta.label}</strong><small>${meta.detail}</small>`;
                const input = document.createElement("input"); input.type = "number"; input.min = "1"; input.step = "1"; input.inputMode = "numeric"; input.value = requirement.targetAmount; input.placeholder = requirement.type === "workouts" ? "e.g. 3" : "Target"; input.setAttribute("aria-label", `${meta.label} target`); input.addEventListener("input", () => { state.requirements[index].targetAmount = input.value; });
                row.append(copy, input);
                if (requirement.type === "workouts") { const required = document.createElement("span"); required.className = "gp-weekly-wizard__required-space"; required.setAttribute("aria-hidden", "true"); row.append(required); }
                else { const remove = document.createElement("button"); remove.type = "button"; remove.className = "gp-weekly-wizard__remove"; remove.setAttribute("aria-label", `Remove ${meta.label}`); remove.innerHTML = closeIcon; remove.addEventListener("click", () => { state.requirements.splice(index, 1); renderGoals(); }); row.append(remove); }
                rows.append(row);
            });
            const picker = field("new-requirement"); picker.replaceChildren(); requirementTypes.filter(item => item.type !== "workouts" && !usedTypes().includes(item.type)).forEach(item => { const option = document.createElement("option"); option.value = item.type; option.textContent = item.label; picker.append(option); });
            root.querySelector(".gp-weekly-wizard__add").disabled = !picker.options.length;
            if (!picker.options.length) root.querySelector(".gp-weekly-wizard__picker").hidden = true;
        }
        function syncWager() { state.wagers[state.wagerType] = field("wager").value; }
        function render() {
            root.querySelectorAll("[data-step]").forEach((page, index) => { page.hidden = index !== state.step; });
            root.querySelectorAll(".gp-weekly-wizard__steps span").forEach((item, index) => item.classList.toggle("is-current", index <= state.step));
            root.querySelector(".gp-weekly-wizard__step-count").textContent = `${state.step + 1} of 4`;
            const back = root.querySelector(".gp-weekly-wizard__back"); back.hidden = state.busy; back.textContent = state.step === 0 ? "Cancel" : "Back";
            const next = root.querySelector(".gp-weekly-wizard__next"); next.disabled = state.busy; next.innerHTML = state.step === 3 ? (state.busy ? "Sending…" : `Sign & send pact${arrow}`) : `Continue${arrow}`;
            root.querySelectorAll("[data-wager]").forEach(button => { const selected = button.dataset.wager === state.wagerType; button.classList.toggle("is-selected", selected); button.setAttribute("aria-pressed", String(selected)); });
            const reward = state.wagerType === "reward"; root.querySelector("[data-wager-label]").firstChild.textContent = reward ? "Reward" : "Consequence"; field("wager").placeholder = reward ? "Something worth working for" : "Embarrassing Challenge"; field("wager").value = state.wagers[state.wagerType];
            if (state.step === 1) renderGoals();
            if (state.step === 3) { root.querySelector(".gp-weekly-wizard__review-dates").textContent = `${formatDate(field("start").value)} – ${formatDate(field("end").value)}`; root.querySelector(".gp-weekly-wizard__review h3").textContent = `A pact with ${field("partner").value}`; const list = root.querySelector(".gp-weekly-wizard__review-goals"); list.replaceChildren(); state.requirements.forEach(requirement => { const row = document.createElement("p"); const name = document.createElement("span"); const target = document.createElement("strong"); name.textContent = typeMeta(requirement.type).label; target.textContent = `${Number(requirement.targetAmount).toLocaleString()}${typeMeta(requirement.type).unit ? ` ${typeMeta(requirement.type).unit}` : ""}`; row.append(name, target); list.append(row); }); root.querySelector(".gp-weekly-wizard__review-wager > span").textContent = reward ? "Reward" : "Consequence"; root.querySelector(".gp-weekly-wizard__review-wager p").textContent = state.wagers[state.wagerType]; }
            setError("");
        }
        function validate() { syncWager(); if (state.step === 1 && state.requirements.some(item => !Number.isInteger(Number(item.targetAmount)) || Number(item.targetAmount) < 1)) return "Add a whole-number target for every requirement."; if (state.step === 2 && !state.wagers[state.wagerType].trim()) return `Describe this week’s ${state.wagerType === "reward" ? "reward" : "consequence"}.`; if (state.step === 3 && !field("initials").value.trim()) return "Add your initials to sign."; return ""; }
        root.querySelector(".gp-weekly-wizard__add").addEventListener("click", () => { root.querySelector(".gp-weekly-wizard__picker").hidden = false; field("new-requirement").focus(); });
        root.querySelector("[data-add-confirm]").addEventListener("click", () => { const type = field("new-requirement").value; if (type && !usedTypes().includes(type)) state.requirements.push({ type, targetAmount: "" }); root.querySelector(".gp-weekly-wizard__picker").hidden = true; renderGoals(); });
        root.querySelectorAll("[data-wager]").forEach(button => button.addEventListener("click", () => { syncWager(); state.wagerType = button.dataset.wager === "reward" ? "reward" : "punishment"; render(); }));
        root.querySelector(".gp-weekly-wizard__back").addEventListener("click", () => { if (state.step === 0) { close(); return; } syncWager(); state.step -= 1; render(); });
        field("initials").addEventListener("input", () => { field("initials").value = field("initials").value.toUpperCase(); });
        overlay.addEventListener("click", event => { if (event.target === overlay && !state.busy) close(); });
        form.addEventListener("submit", async event => { event.preventDefault(); if (state.busy) return; const message = validate(); if (message) { setError(message); return; } if (state.step < 3) { state.step += 1; render(); return; } state.busy = true; render(); try { await options.onSubmit({ requirements: state.requirements.map(item => ({ type:item.type, targetAmount:Number(item.targetAmount) })), wagerType: state.wagerType, wagerDescription: state.wagers[state.wagerType].trim(), initials: field("initials").value.trim() }); close(); } catch (submitError) { state.busy = false; render(); setError(submitError?.message || "We couldn’t send that weekly Pact. Please try again."); } });
        render(); return { close };
    }
    window.GymPactWeeklyWizard = { open };
})();
