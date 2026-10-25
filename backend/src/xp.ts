export type QuizDifficulty = 'easy' | 'medium' | 'hard';

export type LevelProgress = {
  level: number;
  totalXp: number;
  xpIntoCurrentLevel: number;
  xpForNextLevel: number;
  nextLevelTotalXp: number;
};

/** XP required to advance from the supplied level to the next level. */
export function xpRequiredForNextLevel(level: number): number {
  if (!Number.isSafeInteger(level) || level < 1) {
    throw new RangeError('level must be a positive integer.');
  }
  return Math.round(100 * Math.pow(level, 1.5));
}

/** Cumulative XP threshold at which the supplied level begins. */
export function totalXpAtLevel(targetLevel: number): number {
  if (!Number.isSafeInteger(targetLevel) || targetLevel < 1) {
    throw new RangeError('targetLevel must be a positive integer.');
  }
  let total = 0;
  for (let level = 1; level < targetLevel; level += 1) {
    total += xpRequiredForNextLevel(level);
  }
  return total;
}

/** Convert a validated total XP amount to level and in-level progress. */
export function getLevelProgress(totalXp: number): LevelProgress {
  if (!Number.isSafeInteger(totalXp) || totalXp < 0) {
    throw new RangeError('totalXp must be a non-negative safe integer.');
  }

  let level = 1;
  let remainingXp = totalXp;
  let xpForNextLevel = xpRequiredForNextLevel(level);

  while (remainingXp >= xpForNextLevel) {
    remainingXp -= xpForNextLevel;
    level += 1;
    xpForNextLevel = xpRequiredForNextLevel(level);
  }

  return {
    level,
    totalXp,
    xpIntoCurrentLevel: remainingXp,
    xpForNextLevel,
    nextLevelTotalXp: totalXp + (xpForNextLevel - remainingXp),
  };
}

const accuracyMultipliers = [
  { maxPercentage: 59, multiplier: 0.5 },
  { maxPercentage: 79, multiplier: 1 },
  { maxPercentage: 100, multiplier: 1.5 },
] as const;

export function baseXpForDifficulty(difficulty: QuizDifficulty): number {
  switch (difficulty) {
    case 'easy': return 10;
    case 'medium': return 20;
    case 'hard': return 35;
    default: {
      const exhaustive: never = difficulty;
      throw new RangeError(`Unsupported quiz difficulty: ${String(exhaustive)}`);
    }
  }
}

/** Calculate the XP value of an attempt; callers must derive score/difficulty on the server. */
export function calculateQuizXp(
  difficulty: QuizDifficulty,
  percentage: number,
  isFirstValidCompletion: boolean,
): number {
  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
    throw new RangeError('percentage must be between 0 and 100.');
  }
  const baseXp = baseXpForDifficulty(difficulty);
  const accuracyMultiplier = accuracyMultipliers.find(
    (entry) => percentage <= entry.maxPercentage,
  )?.multiplier;
  if (accuracyMultiplier === undefined) throw new RangeError('Invalid percentage.');

  return Math.round(
    baseXp * accuracyMultiplier * (isFirstValidCompletion ? 1.2 : 1),
  );
}
