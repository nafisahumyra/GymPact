export type RequirementType = { type: string };

function isHiitWorkout(muscles: unknown) {
  if (Array.isArray(muscles)) {
    return muscles.some(muscle => typeof muscle === "string" && muscle.trim().toLowerCase() === "hiit");
  }
  if (typeof muscles !== "string") return false;

  try {
    const parsed = JSON.parse(muscles);
    return Array.isArray(parsed)
      ? parsed.some(muscle => typeof muscle === "string" && muscle.trim().toLowerCase() === "hiit")
      : muscles.trim().toLowerCase() === "hiit";
  } catch {
    return muscles.split(",").some(muscle => muscle.trim().toLowerCase() === "hiit");
  }
}

// A HIIT check-in can satisfy either the dedicated HIIT requirement or the
// general Workouts requirement, never both. When a Pact explicitly includes
// HIIT, that requirement takes precedence; otherwise HIIT remains a workout.
export function classifyWorkoutForPact(
  muscles: unknown,
  requirements: RequirementType[],
) {
  const isHiit = isHiitWorkout(muscles);
  const hasWorkoutRequirement = requirements.some(requirement => requirement.type === "workouts");
  const hasHiitRequirement = requirements.some(requirement => requirement.type === "hiit");

  return {
    workouts: hasWorkoutRequirement && (!isHiit || !hasHiitRequirement) ? 1 : 0,
    hiit: isHiit && hasHiitRequirement ? 1 : 0,
  };
}
