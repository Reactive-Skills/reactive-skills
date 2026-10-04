function stepShare({ skillDocBytes, stateBytes }) {
  const stateTotal = stateBytes.reduce((sum, bytes) => sum + bytes, 0);
  const total = skillDocBytes + stateTotal;
  return total > 0 ? stateTotal / stateBytes.length / total : null;
}

function median(sortedValues) {
  const middle = Math.floor(sortedValues.length / 2);
  return sortedValues.length % 2 === 1
    ? sortedValues[middle]
    : (sortedValues[middle - 1] + sortedValues[middle]) / 2;
}

export function computeRegistryStats(skills) {
  const shares = skills
    .map((skill) => skill.instructionBytes)
    .filter((bytes) => bytes && Array.isArray(bytes.stateBytes) && bytes.stateBytes.length > 0)
    .map(stepShare)
    .filter((share) => share !== null)
    .sort((a, b) => a - b);

  return {
    skillCount: skills.length,
    stateCount: skills.reduce((sum, skill) => sum + (skill.stateCount || 0), 0),
    measuredSkillCount: shares.length,
    medianStepShare: shares.length > 0 ? median(shares) : null,
  };
}

export function formatStepShare(share) {
  return `~${Math.max(1, Math.round(share * 100))}%`;
}
