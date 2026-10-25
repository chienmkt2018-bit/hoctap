export type QuizDifficulty = 'easy' | 'medium' | 'hard';

export function calculateDisplayQuizXp(
  difficulty: QuizDifficulty,
  percentage: number,
  isFirstValidCompletion: boolean,
): number {
  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
    throw new RangeError('percentage must be between 0 and 100.');
  }
  const baseXp = difficulty === 'easy' ? 10 : difficulty === 'medium' ? 20 : 35;
  const accuracyMultiplier = percentage <= 59 ? 0.5 : percentage <= 79 ? 1 : 1.5;
  return Math.round(baseXp * accuracyMultiplier * (isFirstValidCompletion ? 1.2 : 1));
}

export function getLevelProgress(totalXp: number) {
  if (!Number.isSafeInteger(totalXp) || totalXp < 0) {
    throw new RangeError('totalXp must be a non-negative safe integer.');
  }
  let level = 1;
  let remainingXp = totalXp;
  let xpForNextLevel = Math.round(100 * Math.pow(level, 1.5));
  while (remainingXp >= xpForNextLevel) {
    remainingXp -= xpForNextLevel;
    level += 1;
    xpForNextLevel = Math.round(100 * Math.pow(level, 1.5));
  }
  return { level, xpIntoCurrentLevel: remainingXp, xpForNextLevel };
}
