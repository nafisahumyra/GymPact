export type RequirementType = { type: string };

function muscleNames(muscles: unknown): string[] {
  if (Array.isArray(muscles)) {
    return muscles.filter((muscle): muscle is string => typeof muscle === "string").map(muscle => muscle.trim().toLowerCase());
  }
  if (typeof muscles !== "string") return [];

  try {
    const parsed = JSON.parse(muscles);
    return Array.isArray(parsed)
      ? parsed.filter((muscle): muscle is string => typeof muscle === "string").map(muscle => muscle.trim().toLowerCase())
      : [muscles.trim().toLowerCase()];
  } catch {
    return muscles.split(",").map(muscle => muscle.trim().toLowerCase());
  }
}

// A HIIT check-in can satisfy either the dedicated HIIT requirement or the
// general Workouts requirement, never both. When a Pact explicitly includes
// HIIT, that requirement takes precedence; otherwise HIIT remains a workout.
export function classifyWorkoutForPact(
  muscles: unknown,
  requirements: RequirementType[],
) {
  const names = muscleNames(muscles);
  const isHiit = names.includes("hiit");
  const isPushups = names.includes("pushups");
  const isPullups = names.includes("pullups");
  const hasWorkoutRequirement = requirements.some(requirement => requirement.type === "workouts");
  const hasHiitRequirement = requirements.some(requirement => requirement.type === "hiit");
  const hasPushupsRequirement = requirements.some(requirement => requirement.type === "pushups");
  const hasPullupsRequirement = requirements.some(requirement => requirement.type === "pullups");

  return {
    workouts: hasWorkoutRequirement && (!isHiit || !hasHiitRequirement) && (!isPushups || !hasPushupsRequirement) && (!isPullups || !hasPullupsRequirement) ? 1 : 0,
    hiit: isHiit && hasHiitRequirement ? 1 : 0,
    pushups: isPushups && hasPushupsRequirement ? 1 : 0,
    pullups: isPullups && hasPullupsRequirement ? 1 : 0,
  };
}
