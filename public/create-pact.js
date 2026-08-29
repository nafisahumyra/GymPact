const createPactForm = document.getElementById("create-pact-form");
const cancelPactButton = document.getElementById("cancel-pact");
const requirementRows = document.getElementById("pact-requirement-rows");
const addRequirementButton = document.getElementById("add-pact-requirement");
const REQUIREMENT_TYPES = [
    { value: "workouts", label: "Workouts" },
    { value: "hiit", label: "HIIT" },
    { value: "steps", label: "Steps" }
];

function formatLocalDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function calculateEndDate(startDate, timeframe) {
    const endDate = new Date(startDate);
    if (timeframe === "day") endDate.setDate(endDate.getDate() + 1);
    else if (timeframe === "week") endDate.setDate(endDate.getDate() + 7);
    else if (timeframe === "month") endDate.setMonth(endDate.getMonth() + 1);
    return formatLocalDate(endDate);
}

function usedRequirementTypes() {
    return Array.from(requirementRows.querySelectorAll(".pact-requirement-type"))
        .map(select => select.value);
}

function refreshRequirementOptions() {
    const selects = requirementRows.querySelectorAll(".pact-requirement-type");
    selects.forEach(select => {
        const selected = select.value;
        Array.from(select.options).forEach(option => {
            option.disabled = option.value !== selected && usedRequirementTypes().includes(option.value);
        });
    });
    addRequirementButton.disabled = selects.length >= REQUIREMENT_TYPES.length;
}

function addRequirementRow(requirement = {}) {
    const row = document.createElement("div");
    const type = document.createElement("select");
    const target = document.createElement("input");
    const remove = document.createElement("button");
    row.className = "pact-requirement-row";
    type.className = "pact-requirement-type";
    REQUIREMENT_TYPES.forEach(item => {
        const option = document.createElement("option");
        option.value = item.value;
        option.textContent = item.label;
        option.selected = (requirement.type || "workouts") === item.value;
        type.appendChild(option);
    });
    target.className = "pact-requirement-target";
    target.type = "number";
    target.min = "1";
    target.step = "1";
    target.inputMode = "numeric";
    target.placeholder = "Target";
    target.value = requirement.targetAmount || "";
    target.setAttribute("aria-label", "Requirement target");
    remove.type = "button";
    remove.className = "remove-measurement-button";
    remove.textContent = "Remove requirement";
    remove.setAttribute("aria-label", "Remove requirement");
    remove.addEventListener("click", () => { row.remove(); refreshRequirementOptions(); });
    type.addEventListener("change", refreshRequirementOptions);
    row.append(type, target, remove);
    requirementRows.appendChild(row);
    refreshRequirementOptions();
}

function getRequirements() {
    const rows = requirementRows.querySelectorAll(".pact-requirement-row");
    const requirements = [];
    for (const row of rows) {
        const type = row.querySelector(".pact-requirement-type").value;
        const targetAmount = Number(row.querySelector(".pact-requirement-target").value);
        if (!REQUIREMENT_TYPES.some(item => item.value === type) || !Number.isInteger(targetAmount) || targetAmount < 1) return null;
        requirements.push({ type, targetAmount });
    }
    return requirements.length > 0 && new Set(requirements.map(item => item.type)).size === requirements.length
        ? requirements : null;
}

addRequirementButton.addEventListener("click", () => addRequirementRow({ type: REQUIREMENT_TYPES.find(item => !usedRequirementTypes().includes(item.value))?.value }));
addRequirementRow();

createPactForm.addEventListener("submit", async event => {
    event.preventDefault();
    const requirements = getRequirements();
    const timeframe = "week";
    const wagerType = document.getElementById("pact-wager-type").value;
    const wagerDescription = document.getElementById("pact-wager-description").value.trim();
    if (!requirements || !timeframe || !wagerType || !wagerDescription) {
        alert("Please complete every Pact requirement and detail.");
        return;
    }
    const sessionToken = sessionStorage.getItem("gymPactSessionToken");
    const createdBy = sessionStorage.getItem("gymPactSelectedAthleteId");
    if (!sessionToken || !createdBy) { window.location.href = "index.html"; return; }
    const submitButton = createPactForm.querySelector("button[type='submit']");
    submitButton.disabled = true;
    try {
        const today = new Date();
        const { error } = await GymPactSupabase.getClient().functions.invoke("create-pact", {
            body: { sessionToken, createdBy, requirements, timeframe, wagerType, wagerDescription,
                startDate: formatLocalDate(today), endDate: calculateEndDate(today, timeframe) }
        });
        if (error) {
            const details = await error.context?.json().catch(() => null);
            throw new Error(details?.code === "open-pact" ? "You already have an active challenge." : "We couldn't create that challenge. Please try again.");
        }
        window.location.href = "dashboard.html";
    } catch (error) {
        console.error("Unable to create pact.", error);
        alert(error.message || "We couldn't create that challenge. Please try again.");
    } finally { submitButton.disabled = false; }
});

cancelPactButton.addEventListener("click", () => { window.location.href = "dashboard.html"; });
