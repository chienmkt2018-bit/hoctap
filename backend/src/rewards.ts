export type RewardSourceType = 'streak' | 'chapter' | 'daily_quest';

export type RewardCandidate = {
  sourceType: RewardSourceType;
  sourceId: string;
  idempotencyKey: string;
  xpAmount: number;
};

export type RewardProgressSnapshot = {
  learningDates: string[];
  completedLessonIds: number[];
  dailyActivity: {
    date: string;
    completedLessonIds: number[];
    highScoreLessonIds: number[];
  } | null | undefined;
};

function dateOrdinal(date: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return Number.NaN;
  const timestamp = Date.parse(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== date) {
    return Number.NaN;
  }
  return timestamp / 86_400_000;
}

export function getConsecutiveStreakLength(dates: string[], today: string): number {
  const todayOrdinal = dateOrdinal(today);
  if (!Number.isFinite(todayOrdinal)) throw new RangeError('today must be a valid YYYY-MM-DD date.');
  const ordinals = new Set(dates.map(dateOrdinal).filter(Number.isFinite));
  let length = 0;
  for (let day = todayOrdinal; ordinals.has(day); day -= 1) length += 1;
  return length;
}

/** Only called after a valid server-scored quiz, so these are newly observed events, not retroactive grants. */
export function getRewardCandidates(
  progress: RewardProgressSnapshot,
  learningDate: string,
): RewardCandidate[] {
  const rewards: RewardCandidate[] = [];
  const streakLength = getConsecutiveStreakLength(progress.learningDates, learningDate);

  for (const milestone of [7, 30]) {
    if (streakLength === milestone) {
      const sourceId = `${milestone}:${learningDate}`;
      rewards.push({
        sourceType: 'streak',
        sourceId,
        idempotencyKey: `streak:${sourceId}`,
        xpAmount: 100,
      });
    }
  }

  const daily = progress.dailyActivity;
  if (daily?.date === learningDate &&
      new Set(daily.completedLessonIds).size >= 2 &&
      new Set(daily.highScoreLessonIds).size >= 1) {
    rewards.push({
      sourceType: 'daily_quest',
      sourceId: learningDate,
      idempotencyKey: `daily_quest:${learningDate}`,
      xpAmount: 50,
    });
  }

  const chapterOneLessons = [1, 2, 3, 4];
  if (chapterOneLessons.every((lessonId) => progress.completedLessonIds.includes(lessonId))) {
    rewards.push({
      sourceType: 'chapter',
      sourceId: 'chapter-1',
      idempotencyKey: 'chapter:chapter-1',
      xpAmount: 200,
    });
  }

  return rewards;
}
