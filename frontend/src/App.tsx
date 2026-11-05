import { useEffect, useRef, useState, type FormEvent } from 'react';
import LessonLibrary from './LessonLibrary';
import type { QuizResult } from './QuizPanel';
import { getLevelProgress } from './xp';
import { authenticate, clearAccessToken, getCurrentUser, getRemoteProgress, readAccessToken, type ApiProgress, type AuthUser } from './auth';

type Quest = {
  id: number;
  title: string;
  subtitle: string;
  xp: number;
  status: 'done' | 'active' | 'locked';
  icon: string;
};

const initialQuests: Quest[] = [
  { id: 1, title: 'Khởi động tư duy', subtitle: 'Bài học nền tảng · 5 phút', xp: 18, status: 'active', icon: '✦' },
  { id: 2, title: 'Mở khóa kiến thức', subtitle: 'Khái niệm cốt lõi · 8 phút', xp: 18, status: 'locked', icon: '◈' },
  { id: 3, title: 'Thử thách nhanh', subtitle: '5 câu hỏi · 4 phút', xp: 36, status: 'locked', icon: '⚡' },
  { id: 4, title: 'Trùm chương', subtitle: 'Kiểm tra tổng hợp · 10 phút', xp: 63, status: 'locked', icon: '♜' },
];

const progressStorageKey = 'hoc-tap-quest-progress-v1';

function getProgressStorageKey(userId: string | null = null): string {
  return userId
    ? `${progressStorageKey}:account:${userId}`
    : `${progressStorageKey}:guest`;
}

function createEmptySavedProgress(): SavedProgress {
  return {
    quests: initialQuests.map((quest) => ({ ...quest })),
    earnedQuizXp: 0,
    quizBestXp: {},
    completedLessons: {},
    dailyActivity: createDailyActivity(),
    learningDates: [],
  };
}

type DailyActivity = {
  date: string;
  completedLessonIds: number[];
  highScoreLessonIds: number[];
};

type SavedProgress = {
  quests: Quest[];
  earnedQuizXp: number;
  quizBestXp: Record<number, number>;
  completedLessons: Record<number, boolean>;
  dailyActivity: DailyActivity;
  learningDates: string[];
};

function getLocalDateKey(timeZone?: string): string {
  const now = new Date();
  if (timeZone) {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function createDailyActivity(date = getLocalDateKey()): DailyActivity {
  return { date, completedLessonIds: [], highScoreLessonIds: [] };
}

function isValidDailyActivity(value: unknown): value is DailyActivity {
  if (!value || typeof value !== 'object') return false;
  const activity = value as Partial<DailyActivity>;
  return isValidDateKey(activity.date) &&
    Array.isArray(activity.completedLessonIds) &&
    activity.completedLessonIds.every((id) => Number.isSafeInteger(id) && id > 0) &&
    Array.isArray(activity.highScoreLessonIds) &&
    activity.highScoreLessonIds.every((id) => Number.isSafeInteger(id) && id > 0);
}

function isValidDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime()) && getDateKey(date) === value;
}

function getDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function shiftDateKey(dateKey: string, amount: number): string {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function getCurrentLearningStreak(learningDates: string[], today = getLocalDateKey()): number {
  const learned = new Set(learningDates);
  let cursor = learned.has(today) ? today : shiftDateKey(today, -1);
  if (!learned.has(cursor)) return 0;
  let streak = 0;
  while (learned.has(cursor)) {
    streak += 1;
    cursor = shiftDateKey(cursor, -1);
  }
  return streak;
}

function getCurrentWeek(learningDates: string[], todayKey = getLocalDateKey()) {
  const today = new Date(`${todayKey}T12:00:00.000Z`);
  const mondayOffset = (today.getUTCDay() + 6) % 7;
  const monday = new Date(today);
  monday.setUTCDate(monday.getUTCDate() - mondayOffset);
  const labels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  const learned = new Set(learningDates);
  return labels.map((label, index) => {
    const date = new Date(monday);
    date.setUTCDate(date.getUTCDate() + index);
    const dateKey = date.toISOString().slice(0, 10);
    return { label, dateKey, learned: learned.has(dateKey), today: dateKey === todayKey };
  });
}

function readSavedProgress(userId: string | null = null): SavedProgress | null {
  try {
    if (typeof window === 'undefined') return null;
    const storageKey = getProgressStorageKey(userId);
    // Migrate the old unscoped key to guest-only reads; never import it into an account.
    const raw = window.localStorage.getItem(storageKey) ??
      (userId === null ? window.localStorage.getItem(progressStorageKey) : null);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const value = parsed as Partial<SavedProgress>;
    const validQuests = Array.isArray(value.quests) && value.quests.length === initialQuests.length && value.quests.every((quest) =>
      quest && initialQuests.some((initial) => initial.id === quest.id) &&
      ['done', 'active', 'locked'].includes(quest.status)
    );
    const validNumberRecord = (record: unknown): record is Record<number, number> =>
      !!record && typeof record === 'object' && !Array.isArray(record) &&
      Object.values(record).every((number) => typeof number === 'number' && Number.isFinite(number) && number >= 0);
    const validCompleted = !!value.completedLessons && typeof value.completedLessons === 'object' && !Array.isArray(value.completedLessons) &&
      Object.values(value.completedLessons).every((flag) => typeof flag === 'boolean');
    if (!validQuests || typeof value.earnedQuizXp !== 'number' || !Number.isFinite(value.earnedQuizXp) || value.earnedQuizXp < 0 ||
      !validNumberRecord(value.quizBestXp) || !validCompleted) return null;
    return {
      quests: initialQuests.map((initial) => value.quests!.find((quest) => quest.id === initial.id)!),
      earnedQuizXp: value.earnedQuizXp,
      quizBestXp: value.quizBestXp,
      completedLessons: value.completedLessons as Record<number, boolean>,
      dailyActivity: isValidDailyActivity(value.dailyActivity) && value.dailyActivity.date === getLocalDateKey()
        ? {
            date: value.dailyActivity.date,
            completedLessonIds: [...new Set(value.dailyActivity.completedLessonIds)],
            highScoreLessonIds: [...new Set(value.dailyActivity.highScoreLessonIds)],
          }
        : createDailyActivity(),
      // Migrate only dates with evidence: preserve recorded dates and today's actual P4.2 quiz activity.
      learningDates: [...new Set([
        ...(Array.isArray(value.learningDates) ? value.learningDates.filter(isValidDateKey) : []),
        ...(isValidDailyActivity(value.dailyActivity) && value.dailyActivity.completedLessonIds.length > 0 && isValidDateKey(value.dailyActivity.date)
          ? [value.dailyActivity.date]
          : []),
      ])].sort(),
    };
  } catch {
    // Storage may be disabled or contain malformed data; start with clean defaults.
    return null;
  }
}

const navigation = [
  { id: 'overview', icon: 'overview', label: 'Tổng quan' },
  { id: 'map', icon: 'map', label: 'Bản đồ nhiệm vụ' },
  { id: 'lessons', icon: 'lessons', label: 'Bài học' },
  { id: 'practice', icon: 'practice', label: 'Luyện tập' },
  { id: 'achievements', icon: 'achievements', label: 'Thành tựu' },
] as const;

type NavigationIconName = (typeof navigation)[number]['icon'];

function NavigationIcon({ name }: { name: NavigationIconName }) {
  const paths: Record<NavigationIconName, string> = {
    overview: 'M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z',
    map: 'M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z M9 3v15 M15 6v15',
    lessons: 'M5 3h10l4 4v14H5z M14 3v5h5 M8 12h8 M8 16h8',
    practice: 'M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2z',
    achievements: 'M8 4h8v4a4 4 0 0 1-8 0z M8 6H4v2a4 4 0 0 0 4 4 M16 6h4v2a4 4 0 0 1-4 4 M12 12v5 M8 21h8 M9 17h6',
  };
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={paths[name]} /></svg>;
}


type UIIconName = 'flame' | 'gem' | 'bell' | 'sparkles' | 'trophy' | 'target' | 'compass' | 'lock' | 'crown';

function UIIcon({ name, size = 20 }: { name: UIIconName; size?: number }) {
  const paths: Record<UIIconName, string> = {
    flame: 'M12 22c4.2 0 7-2.9 7-6.8 0-2.8-1.5-4.8-4.1-7.2.1 2.2-.6 3.4-1.8 4.1C13.4 8.2 11.5 5 8.1 2 8.4 6.7 5 9.4 5 14.4 5 18.8 7.8 22 12 22z M12 22c-1.8-1.1-2.6-2.6-2.4-4.3.2-1.2 1-2.2 2.1-3.2 1.3 1.2 2.2 2.5 2.2 4 0 1.4-.7 2.7-1.9 3.5z',
    gem: 'M6 3h12l4 6-10 12L2 9z M2 9h20 M6 3l4 6 2 12 2-12 4-6',
    bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4',
    sparkles: 'm12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z M19 15l1 2.5 2.5 1-2.5 1L19 22l-1-2.5-2.5-1 2.5-1z',
    trophy: 'M8 21h8 M12 17v4 M7 4h10v5a5 5 0 0 1-10 0z M7 6H4v2a4 4 0 0 0 4 4 M17 6h3v2a4 4 0 0 1-4 4',
    target: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z M12 12h.01',
    compass: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M15.5 8.5l-2.2 4.8-4.8 2.2 2.2-4.8z',
    lock: 'M5 10h14v11H5z M8 10V7a4 4 0 0 1 8 0v3 M12 14v3',
    crown: 'M3 7l5 4 4-7 4 7 5-4-2 13H5z M5 17h14',
  };
  return <svg className="ui-icon" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={paths[name]} /></svg>;
}

function deriveQuestsFromCompletedLessons(completedLessons: Record<number, boolean>): Quest[] {
  let allPreviousQuestsCompleted = true;
  return initialQuests.map((quest) => {
    const done = completedLessons[quest.id] === true;
    const status: Quest['status'] = done ? 'done' : allPreviousQuestsCompleted ? 'active' : 'locked';
    allPreviousQuestsCompleted = allPreviousQuestsCompleted && done;
    return { ...quest, status };
  });
}

function mergeRemoteProgress(remote: ApiProgress, timeZone: string): SavedProgress {
  // For signed-in accounts, quiz attempts on the server are the sole source of truth.
  // Do not resurrect stale local completion flags or client-written progress.
  const completedLessons = Object.fromEntries(
    remote.completedLessonIds.map((lessonId) => [lessonId, true]),
  ) as Record<number, boolean>;
  const quests = deriveQuestsFromCompletedLessons(completedLessons);
  const quizBestXp = Object.fromEntries(
    Object.entries(remote.bestXpByLesson).map(([lessonId, xp]) => [Number(lessonId), xp]),
  );
  const learningDates = [...new Set(remote.learningDates ?? [])]
    .filter(isValidDateKey)
    .sort();
  const today = getLocalDateKey(timeZone);
  const remoteDaily = remote.dailyActivity;
  const dailyActivity = remoteDaily && remoteDaily.date === today && isValidDailyActivity(remoteDaily)
    ? {
        date: today,
        completedLessonIds: [...new Set(remoteDaily.completedLessonIds)],
        highScoreLessonIds: [...new Set(remoteDaily.highScoreLessonIds)],
      }
    : createDailyActivity(today);

  return {
    ...createEmptySavedProgress(),
    quests,
    completedLessons,
    earnedQuizXp: remote.totalXp,
    quizBestXp,
    learningDates,
    dailyActivity,
  };
}
function App({ readOnlyPreview = false }: { readOnlyPreview?: boolean }) {
  const [activeNav, setActiveNav] = useState('map');
  const [dailySheetOpen, setDailySheetOpen] = useState(false);
  const [quests, setQuests] = useState(() => readOnlyPreview ? initialQuests : readSavedProgress()?.quests ?? initialQuests);
  const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null);
  const [notice, setNotice] = useState('');
  const [earnedQuizXp, setEarnedQuizXp] = useState(() => readOnlyPreview ? 0 : readSavedProgress()?.earnedQuizXp ?? 0);
  const [serverTotalXp, setServerTotalXp] = useState<number | null>(null);
  const [quizBestXp, setQuizBestXp] = useState<Record<number, number>>(() => readOnlyPreview ? {} : readSavedProgress()?.quizBestXp ?? {});
  const [completedLessons, setCompletedLessons] = useState<Record<number, boolean>>(() => readOnlyPreview ? {} : readSavedProgress()?.completedLessons ?? {});
  const [dailyActivity, setDailyActivity] = useState<DailyActivity>(() => readOnlyPreview ? createDailyActivity() : readSavedProgress()?.dailyActivity ?? createDailyActivity());
  const [learningDates, setLearningDates] = useState<string[]>(() => readOnlyPreview ? [] : readSavedProgress()?.learningDates ?? []);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!notice) return;
    const timeoutId = window.setTimeout(() => setNotice(''), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  useEffect(() => {
    if (!accountMenuOpen) return;
    const closeWhenOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !accountMenuRef.current?.contains(event.target)) setAccountMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setAccountMenuOpen(false); };
    document.addEventListener('pointerdown', closeWhenOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeWhenOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [accountMenuOpen]);

  useEffect(() => {
    if (readOnlyPreview) return;
    try {
      window.localStorage.setItem(getProgressStorageKey(user?.id ?? null), JSON.stringify({ quests, earnedQuizXp, quizBestXp, completedLessons, dailyActivity, learningDates } satisfies SavedProgress));
    } catch {
      setNotice('Không thể lưu tiến độ trên trình duyệt này. Hãy kiểm tra chế độ riêng tư hoặc dung lượng lưu trữ.');
    }
  }, [user?.id, quests, earnedQuizXp, quizBestXp, completedLessons, dailyActivity, learningDates]);

  // Roll the daily checklist over in the saved account timezone, or device-local time for guests.
  useEffect(() => {
    if (readOnlyPreview) return;
    const refreshDailyActivity = () => {
      const today = getLocalDateKey(user?.timezone);
      setDailyActivity((current) => current.date === today ? current : createDailyActivity(today));
    };
    window.addEventListener('focus', refreshDailyActivity);
    document.addEventListener('visibilitychange', refreshDailyActivity);
    return () => {
      window.removeEventListener('focus', refreshDailyActivity);
      document.removeEventListener('visibilitychange', refreshDailyActivity);
    };
  }, [user?.timezone]);

  // Restore a session token and load progress from server-verified quiz attempts.
  useEffect(() => {
    if (readOnlyPreview) return;
    const token = readAccessToken();
    if (!token) return;
    let cancelled = false;
    void (async () => {
      try {
        const currentUser = await getCurrentUser(token);
        const remote = await getRemoteProgress(token);
        if (cancelled) return;
        // Authenticated progress comes only from server-verified quiz attempts.
        // Guest and account-local caches are never used to grant completion.
        const merged = mergeRemoteProgress(remote, currentUser.timezone);
        setQuests(merged.quests);
        setEarnedQuizXp(merged.earnedQuizXp);
        setServerTotalXp(remote.totalXp);
        setQuizBestXp(merged.quizBestXp);
        setCompletedLessons(merged.completedLessons);
        setDailyActivity(merged.dailyActivity);
        setLearningDates(merged.learningDates);
        setUser(currentUser);
      } catch (error) {
        if (!cancelled) {
          clearAccessToken();
          setNotice(error instanceof Error ? error.message : 'Không thể khôi phục phiên đăng nhập. Dữ liệu cục bộ vẫn được giữ.');
        }
      }
    })();
    return () => { cancelled = true; };
    // Restore only once on application startup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);



  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (authBusy) return;
    setAuthBusy(true);
    setNotice('');
    try {
      const currentUser = await authenticate(authMode, authEmail.trim(), authPassword);
      const token = readAccessToken();
      if (!token) throw new Error('Không thể lưu phiên đăng nhập trong tab này.');
      const remote = await getRemoteProgress(token);
      // Load only server-verified quiz progress for this account.
      const merged = mergeRemoteProgress(remote, currentUser.timezone);
      setQuests(merged.quests);
      setEarnedQuizXp(merged.earnedQuizXp);
      setServerTotalXp(remote.totalXp);
      setQuizBestXp(merged.quizBestXp);
      setCompletedLessons(merged.completedLessons);
      setDailyActivity(merged.dailyActivity);
      setLearningDates(merged.learningDates);
      setUser(currentUser);
      setAuthPassword('');
      setAuthOpen(false);
      setNotice(`Đã ${authMode === 'register' ? 'tạo tài khoản và đăng nhập' : 'đăng nhập'} thành công. Tiến độ quiz đã xác minh trên máy chủ được tải vào tài khoản.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Không thể đăng nhập lúc này.');
    } finally {
      setAuthBusy(false);
    }
  }

  function handleLogout() {
    clearAccessToken();
    // Switch back to guest-only progress before the persistence effect runs.
    const guest = readSavedProgress(null) ?? createEmptySavedProgress();
    setQuests(guest.quests);
    setEarnedQuizXp(guest.earnedQuizXp);
    setQuizBestXp(guest.quizBestXp);
    setCompletedLessons(guest.completedLessons);
    setDailyActivity(guest.dailyActivity);
    setLearningDates(guest.learningDates);
    setUser(null);
    setServerTotalXp(null);
    setSelectedQuest(null);
    setAuthOpen(false);
    setNotice('Đã đăng xuất. Tiến độ của tài khoản đã được tách riêng; dữ liệu khách vẫn được giữ.');
  }

  const completedCount = quests.filter((quest) => quest.status === 'done').length;
  const xp = serverTotalXp ?? earnedQuizXp;
  const levelState = getLevelProgress(xp);
  const level = levelState.level;
  const levelProgress = levelState.xpIntoCurrentLevel;
  const levelXpRequired = levelState.xpForNextLevel;

  const activeTitle = navigation.find((item) => item.id === activeNav)?.label ?? 'Tổng quan';
  const supportedLessonIds = [1, 2, 3, 4, 5, 6, 7, 8];
  const completedLessonCount = supportedLessonIds.filter((lessonId) => completedLessons[lessonId]).length;
  const completedQuizCount = supportedLessonIds.filter((lessonId) => (quizBestXp[lessonId] ?? 0) > 0).length;
  const achievementXp = serverTotalXp ?? earnedQuizXp;
  const achievements = [
    { id: 'first-lesson', icon: '✦', title: 'Bước đầu tiên', description: 'Hoàn thành quiz đầu tiên.', progress: `${Math.min(completedLessonCount, 1)}/1 bài học`, unlocked: completedLessonCount >= 1 },
    { id: 'three-lessons', icon: '◈', title: 'Người khám phá', description: 'Hoàn thành 3 bài học khác nhau.', progress: `${Math.min(completedLessonCount, 3)}/3 bài học`, unlocked: completedLessonCount >= 3 },
    { id: 'all-lessons', icon: '♛', title: 'Bậc thầy tri thức', description: 'Hoàn thành cả 8 bài học hiện có.', progress: `${completedLessonCount}/8 bài học`, unlocked: completedLessonCount >= 8 },
    { id: 'first-xp', icon: '✧', title: 'XP đầu tiên', description: 'Nhận XP từ một bài quiz.', progress: `${Math.min(completedQuizCount, 1)}/1 quiz có XP`, unlocked: completedQuizCount >= 1 },
    { id: 'quiz-collector', icon: '⚡', title: 'Nhà sưu tầm', description: 'Nhận XP từ 3 quiz khác nhau.', progress: `${Math.min(completedQuizCount, 3)}/3 quiz có XP`, unlocked: completedQuizCount >= 3 },
    { id: 'century-xp', icon: '◆', title: 'Cột mốc 100 XP', description: 'Tích lũy 100 XP quiz theo dữ liệu hiện có.', progress: `${Math.min(achievementXp, 100).toLocaleString('vi-VN')}/100 XP`, unlocked: achievementXp >= 100 },
  ];
  const unlockedAchievementCount = achievements.filter((achievement) => achievement.unlocked).length;
  const dailyQuests = [
    { id: 'one-quiz', icon: '◉', title: 'Hoàn thành một bài quiz', description: 'Hoàn thành ít nhất một bài luyện tập hôm nay.', progress: Math.min(dailyActivity.completedLessonIds.length, 1), target: 1 },
    { id: 'two-lessons', icon: '⌁', title: 'Khám phá hai bài khác nhau', description: 'Luyện tập ở hai bài học khác nhau trong ngày.', progress: Math.min(dailyActivity.completedLessonIds.length, 2), target: 2 },
    { id: 'high-score', icon: '✧', title: 'Đạt ít nhất 80% chính xác', description: 'Đạt 80% trở lên ở một bài quiz hôm nay.', progress: Math.min(dailyActivity.highScoreLessonIds.length, 1), target: 1 },
  ].map((quest) => ({ ...quest, done: quest.progress >= quest.target }));
  const completedDailyQuestCount = dailyQuests.filter((quest) => quest.done).length;
  const todayLearningDate = getLocalDateKey(user?.timezone);
  const learningStreak = getCurrentLearningStreak(learningDates, todayLearningDate);
  const currentWeek = getCurrentWeek(learningDates, todayLearningDate);

  function handleQuizComplete(result: QuizResult): number {
    const updatedCompletedLessons = { ...completedLessons, [result.lessonId]: true };
    setCompletedLessons(updatedCompletedLessons);
    setQuests(deriveQuestsFromCompletedLessons(updatedCompletedLessons));
    if (user) {
      // The server is authoritative for account learning dates and daily activity.
      const token = readAccessToken();
      if (token) {
        void getRemoteProgress(token).then((remote) => {
          const verified = mergeRemoteProgress(remote, user.timezone);
          setDailyActivity(verified.dailyActivity);
          setLearningDates(verified.learningDates);
        }).catch(() => undefined);
      }
    } else {
      // Guest progress has no server record, so use the device's local calendar date.
      const today = getLocalDateKey();
      setDailyActivity((current) => {
        const activity = current.date === today ? current : createDailyActivity(today);
        const completedLessonIds = [...new Set([...activity.completedLessonIds, result.lessonId])];
        const highScoreLessonIds = result.percentage >= 80
          ? [...new Set([...activity.highScoreLessonIds, result.lessonId])]
          : activity.highScoreLessonIds;
        return { date: today, completedLessonIds, highScoreLessonIds };
      });
      setLearningDates((current) => current.includes(today)
        ? current
        : [...current, today].sort());
    }
    if (result.serverAwardedXp !== undefined) {
      const awarded = result.serverAwardedXp;
      setQuizBestXp((current) => ({
        ...current,
        [result.lessonId]: Math.max(current[result.lessonId] ?? 0, result.calculatedXp),
      }));
      setEarnedQuizXp((current) => current + awarded);
      setServerTotalXp(result.serverTotalXp ?? null);
      const previousLevel = getLevelProgress(serverTotalXp ?? earnedQuizXp).level;
      const nextLevel = getLevelProgress(result.serverTotalXp ?? 0).level;
      const levelUpNotice = nextLevel > previousLevel ? ` Lên cấp ${nextLevel}!` : '';
      const bonusNotice = (result.serverBonusXpAwarded ?? 0) > 0 ? ` Trong đó có ${result.serverBonusXpAwarded} XP thưởng bổ sung.` : '';
      setNotice(`Máy chủ đã lưu quiz “${result.lessonTitle}”: ${result.correctCount}/${result.totalQuestions} câu đúng (${result.percentage}%). XP cộng thêm: ${awarded}.${bonusNotice} Tổng XP tài khoản: ${(result.serverTotalXp ?? 0).toLocaleString('vi-VN')}.${levelUpNotice}`);
      return awarded;
    }
    const previousBest = quizBestXp[result.lessonId] ?? 0;
    const newBest = Math.max(previousBest, result.calculatedXp);
    const awarded = newBest - previousBest;
    if (awarded > 0) {
      setQuizBestXp((current) => ({ ...current, [result.lessonId]: newBest }));
      setEarnedQuizXp((current) => current + awarded);
      setNotice(`Hoàn thành quiz “${result.lessonTitle}”: ${result.correctCount}/${result.totalQuestions} câu đúng (${result.percentage}%). Bạn nhận thêm ${awarded} XP${previousBest > 0 ? ' nhờ cải thiện kết quả tốt nhất' : ''}.`);
    } else {
      setNotice(`Kết quả quiz “${result.lessonTitle}”: ${result.correctCount}/${result.totalQuestions} câu đúng (${result.percentage}%). Bạn đã nhận mức XP tương ứng với kết quả tốt nhất của bài này, nên lần này không cộng thêm XP.`);
    }
    return awarded;
  }

  function startQuest(quest: Quest) {
    if (quest.status === 'locked') {
      setNotice('Hoàn thành nhiệm vụ đang mở để mở khóa chặng tiếp theo nhé.');
      return;
    }
    setSelectedQuest(quest);
    setNotice('');
  }

  return (
    <main className="app-layout">
      <aside className={`sidebar ${readOnlyPreview ? 'rpg-preview-sidebar-hidden' : ''}`}>
        <a className="brand" href="#overview" onClick={() => setActiveNav('overview')} aria-label="HOC TAP QUEST trang chủ">
          <span className="brand-mark">HQ</span>
          <span className="brand-name">HOC TAP <strong>QUEST</strong></span>
        </a>
        <div className="sidebar-label">KHÔNG GIAN HỌC TẬP</div>
        <nav className="nav-list" aria-label="Điều hướng chính">
          {navigation.map((item) => (
            <button key={item.id} className={`nav-item ${activeNav === item.id ? 'is-active' : ''}`} aria-current={activeNav === item.id ? 'page' : undefined} onClick={() => { setActiveNav(item.id); setSelectedQuest(null); }} type="button">
              <span className="nav-icon"><NavigationIcon name={item.icon} /></span>
              <span>{item.label}</span>
              {item.id === 'map' && <span className="nav-badge">NEW</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <section className="sidebar-tip">
          <span className="tip-spark">✦</span>
          <p className="tip-kicker">MẸO HÔM NAY</p>
          <p>Học 15 phút mỗi ngày tốt hơn học dồn một lần.</p>
          <span className="tip-decoration" aria-hidden="true">✧</span>
        </section>
        <div className="profile-row" aria-label={`Thành viên cấp ${String(level).padStart(2, '0')}`}>
          <div className="avatar" aria-hidden="true"><UIIcon name="target" size={20} /></div>
          <div className="profile-copy"><span>THÀNH VIÊN CẤP {String(level).padStart(2, '0')}</span></div>
        </div>
      </aside>

      <section className="main-area" id="overview">
        <header className={`topbar ${readOnlyPreview ? 'rpg-preview-topbar-hidden' : ''}`}>
          <div className="breadcrumb"><span>HOC TAP QUEST</span><span className="breadcrumb-slash">/</span><strong>{activeTitle}</strong></div>
          <div className="topbar-right">
            <div className="streak-chip" title="Chuỗi ngày tính từ các ngày có hoàn thành quiz"><UIIcon name="flame" /><strong>{learningStreak}</strong><span className="chip-caption">NGÀY</span></div>
            <div className="currency-chip"><span className="gem"><UIIcon name="gem" size={20} /></span><strong>120</strong><span className="chip-caption">GEMS</span></div>
            <button className="icon-button" type="button" aria-label="Thông báo" onClick={() => setNotice('Bạn đã xem thông báo mới nhất.')}><UIIcon name="bell" /><span className="notification-dot" /></button>
            {user ? <div className="account-menu-wrap" ref={accountMenuRef}>
              <button className="account-trigger" type="button" aria-haspopup="menu" aria-expanded={accountMenuOpen} onClick={() => setAccountMenuOpen((open) => !open)}><span className="account-avatar" aria-hidden="true">N</span><span className="account-trigger-label">Nhà thám hiểm</span><span className="account-chevron" aria-hidden="true">⌄</span></button>
              {accountMenuOpen && <div className="account-dropdown" role="menu"><span className="account-dropdown-label">ĐANG ĐĂNG NHẬP</span><span className="account-dropdown-email">{user.email}</span><button className="account-logout" type="button" role="menuitem" onClick={() => { setAccountMenuOpen(false); handleLogout(); }}>Đăng xuất</button></div>}
            </div> : <button className="auth-trigger" type="button" onClick={() => { setAuthOpen((open) => !open); setNotice(''); }}>{authOpen ? 'Đóng' : 'Đăng nhập'}</button>}
          </div>
        </header>

        <div className="content-wrap">
          {!readOnlyPreview && authOpen && !user && <section className="auth-panel" aria-labelledby="auth-panel-title">
            <div className="auth-panel-heading"><div><p className="section-kicker">TÀI KHOẢN HỌC TẬP</p><h2 id="auth-panel-title">{authMode === 'login' ? 'Chào mừng trở lại' : 'Tạo tài khoản mới'}</h2><p>Đăng nhập để đồng bộ bài đã hoàn thành giữa các thiết bị. Tiến độ hiện có trên trình duyệt sẽ được giữ và hợp nhất.</p></div><button type="button" className="close-button" aria-label="Đóng biểu mẫu" onClick={() => setAuthOpen(false)}>×</button></div>
            <form className="auth-form" onSubmit={handleAuthSubmit}>
              <label>Email<input type="email" autoComplete="email" required maxLength={254} value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="ban@example.com" /></label>
              <label>Mật khẩu<input type="password" autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} required minLength={authMode === 'register' ? 10 : 1} maxLength={128} value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder={authMode === 'register' ? 'Tối thiểu 10 ký tự' : 'Nhập mật khẩu'} /></label>
              <div className="auth-form-footer"><button className="primary-button" type="submit" disabled={authBusy}>{authBusy ? 'Đang xử lý…' : authMode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'} <span>→</span></button><button className="auth-mode-toggle" type="button" disabled={authBusy} onClick={() => { setAuthMode((mode) => mode === 'login' ? 'register' : 'login'); setNotice(''); }}>{authMode === 'login' ? 'Chưa có tài khoản? Đăng ký' : 'Đã có tài khoản? Đăng nhập'}</button></div>
            </form>
            <p className="auth-footnote">Phiên đăng nhập được giữ trong tab hiện tại; khi đăng xuất, dữ liệu học cục bộ không bị xóa.</p>
          </section>}

          <div className={`page-intro ${activeNav === 'map' ? 'rpg-map-intro-hidden' : ''}`}>
            <div>
              <p className="eyebrow"><span className="eyebrow-line" /> THỨ HAI · HÀNH TRÌNH CỦA BẠN</p>
              <h1>{activeNav === 'overview' ? <>Chào mừng trở lại,<br /><span>nhà thám hiểm.</span></> : activeTitle + '.'}</h1>
              <p className="intro-copy">{activeNav === 'map' ? 'Chọn một điểm trên bản đồ và tiếp tục hành trình chinh phục kiến thức.' : activeNav === 'lessons' ? 'Khám phá bài học theo chủ đề, cấp độ và trạng thái của hành trình.' : activeNav === 'practice' ? 'Rèn luyện mỗi ngày để biến kiến thức thành kỹ năng.' : activeNav === 'achievements' ? 'Mỗi cột mốc là bằng chứng cho nỗ lực của bạn.' : 'Một bước nhỏ hôm nay, một phiên bản giỏi hơn vào ngày mai.'}</p>
            </div>
            <div className="level-card">
              <div className="level-orb"><span>{String(level).padStart(2, '0')}</span><small>LVL</small></div>
              <div className="level-details"><span className="level-label">CẤP ĐỘ HIỆN TẠI</span><strong>{level >= 4 ? 'Người chinh phục' : 'Người khai phá'}</strong><div className="level-progress-row"><div className="progress-track" role="progressbar" aria-label="Tiến độ XP đến cấp tiếp theo" aria-valuemin={0} aria-valuemax={levelXpRequired} aria-valuenow={levelProgress}><span style={{ width: `${levelProgress / levelXpRequired * 100}%` }} /></div><strong className="level-progress-percent">{Math.round(levelProgress / levelXpRequired * 100)}%</strong></div><small>{levelProgress.toLocaleString('vi-VN')} / {levelXpRequired.toLocaleString('vi-VN')} XP đến cấp {level + 1}</small></div>
            </div>
          </div>

          {notice && <div className="notice" role="status"><span>✦</span>{notice}<button type="button" onClick={() => setNotice('')} aria-label="Đóng thông báo">×</button></div>}

          {selectedQuest && (
            <section className="lesson-panel" aria-live="polite">
              <div className="lesson-symbol">{selectedQuest.icon}</div>
              <div className="lesson-body"><span className="section-kicker">NHIỆM VỤ ĐANG CHỌN · +{selectedQuest.xp} XP</span><h2>{selectedQuest.title}</h2><p>{selectedQuest.subtitle}. Sẵn sàng bắt đầu phiên học ngắn của bạn?</p></div>
              <button className="primary-button" type="button" onClick={() => { if (readOnlyPreview) { setSelectedQuest(null); return; } setActiveNav('lessons'); setSelectedQuest(null); setNotice('Chọn bài học tương ứng trong thư viện để bắt đầu quiz.'); }}>{readOnlyPreview ? 'Đóng thông tin' : 'Mở bài học tương ứng'} <span>{readOnlyPreview ? '×' : '↗'}</span></button>
              <button className="close-button" type="button" aria-label="Đóng nhiệm vụ" onClick={() => setSelectedQuest(null)}>×</button>
            </section>
          )}

          {activeNav === 'map' && (
            <section className="rpg-map-screen" aria-labelledby="rpg-chapter-title">
              <header className="rpg-hud">
                <div className="rpg-player">
                  <div className="rpg-level-orb" aria-label={`Cấp độ ${level}`}>{level}</div>
                  <div className="rpg-player-copy">
                    <strong>{readOnlyPreview ? 'Nhà thám hiểm' : user?.email ? user.email.split('@')[0] : 'Chiến'}</strong>
                    <div className="rpg-xp-track" role="progressbar" aria-label="Tiến độ XP đến cấp tiếp theo" aria-valuemin={0} aria-valuemax={levelXpRequired} aria-valuenow={levelProgress}><span style={{width:`${Math.min(100, levelProgress / levelXpRequired * 100)}%`}} /></div>
                    <small>{levelProgress.toLocaleString('vi-VN')} / {levelXpRequired.toLocaleString('vi-VN')} XP</small>
                  </div>
                </div>
                <div className="rpg-hud-chips">
                  <div className="rpg-chip rpg-streak-chip" aria-label={`Chuỗi học ${learningStreak} ngày`}><UIIcon name="flame" size={16}/><strong>{learningStreak}</strong></div>
                  <div className="rpg-chip rpg-gem-chip" aria-label="120 gems"><UIIcon name="gem" size={16}/><strong>120</strong></div>
                </div>
              </header>

              <div className="rpg-chapter-heading">
                <div><span>CHƯƠNG 01</span><h1 id="rpg-chapter-title">Khởi nguyên tri thức</h1></div>
                <strong>{completedCount} / {quests.length}</strong>
              </div>

              <div className="rpg-world-layout">
                <div className="rpg-map-column">
                  <div className="rpg-stone-map" aria-label="Bản đồ thế giới chương 01">
                    <div className="rpg-map-stamp">
                      <span>THE KNOWLEDGE KINGDOM</span>
                      <strong>CHƯƠNG 01 · KHỞI NGUYÊN TRI THỨC</strong>
                    </div>
                    <svg className="rpg-route-art rpg-route-desktop" viewBox="0 0 1000 760" preserveAspectRatio="none" aria-hidden="true">
                      <path className="rpg-route-shadow" d="M130 600 C205 560 265 520 355 450 S510 340 625 275 S755 175 835 105" />
                      <path className="rpg-route-base" d="M130 600 C205 560 265 520 355 450 S510 340 625 275 S755 175 835 105" />
                      <path className="rpg-route-glow" d="M130 600 C205 560 265 520 355 450 S510 340 625 275 S755 175 835 105" />
                    </svg>
                    <svg className="rpg-route-art rpg-route-mobile" viewBox="0 0 360 900" preserveAspectRatio="none" aria-hidden="true">
                      <path className="rpg-route-shadow" d="M85 760 C250 720 300 630 270 550 S80 420 90 330 S270 230 280 130" />
                      <path className="rpg-route-base" d="M85 760 C250 720 300 630 270 550 S80 420 90 330 S270 230 280 130" />
                      <path className="rpg-route-glow" d="M85 760 C250 720 300 630 270 550 S80 420 90 330 S270 230 280 130" />
                    </svg>
                                        <div className="rpg-quest-stack">
                      {quests.map((quest) => (
                        <div className={'rpg-quest-point rpg-point-' + quest.id + ' ' + quest.status} key={quest.id}>
                          <button
                            className={'rpg-node-button ' + quest.status}
                            type="button"
                            aria-pressed={selectedQuest?.id === quest.id}
                            aria-label={quest.title + ', ' + (quest.status === 'done' ? 'đã hoàn thành' : quest.status === 'active' ? 'đang mở, xem nhiệm vụ' : 'đang khóa, xem điều kiện')}
                            onClick={() => startQuest(quest)}
                          >
                            <img
                              className="rpg-node-art"
                              src={quest.status === 'done'
                                ? '/assets/incoming/node_hoan_thanh_vuong_mien.png'
                                : quest.status === 'locked'
                                  ? '/assets/incoming/node_khoa.png'
                                  : '/assets/incoming/node_dang_mo.png'}
                              alt=""
                              aria-hidden="true"
                            />
                          </button>
                          <div className="rpg-node-copy">
                            <small>{quest.status === 'done' ? '✓ ĐÃ HOÀN THÀNH' : quest.status === 'active' ? '✦ ĐANG MỞ' : '▣ ĐANG KHÓA'}</small>
                            <strong>{quest.title}</strong>
                            <span>+{quest.xp} XP · {quest.subtitle}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="rpg-companion" aria-label="Bạn đồng hành">
                      <img className="rpg-companion-art" src="/assets/incoming/nhan_vat_dong_hanh.png" alt="Nhân vật đồng hành" />
                    </div>
                    <span className="rpg-speech">Cuộc phiêu lưu bắt đầu!</span>
                    <div className="rpg-map-legend" aria-label="Chú giải bản đồ">
                      <span><i className="done" /> Hoàn thành</span>
                      <span><i className="active" /> Đang mở</span>
                      <span><i className="locked" /> Bị khóa</span>
                    </div>
                  </div>
                  {!readOnlyPreview && quests.find((quest) => quest.status === 'active') && (
                    <button className="rpg-start-button" type="button" onClick={() => startQuest(quests.find((quest) => quest.status === 'active')!)}>
                      <img className="rpg-start-button-art" src="/assets/incoming/nut_bat_dau.png" alt="" aria-hidden="true" />
                      <span>BẮT ĐẦU NHIỆM VỤ · +{quests.find((quest) => quest.status === 'active')!.xp} XP</span>
                    </button>
                  )}
                </div>
                <aside className="rpg-world-aside" aria-label="Thông tin hành trình">
                  <section className="rpg-side-profile">
                    <span className="rpg-side-emblem"><UIIcon name="crown" size={24}/></span>
                    <div><small>NHÀ THÁM HIỂM</small><strong>{readOnlyPreview ? 'Nhà thám hiểm' : user?.email ? user.email.split('@')[0] : 'Chiến'}</strong><span>Cấp độ {level}</span></div>
                  </section>
                  <section className="rpg-side-stats" aria-label="Chỉ số hành trình">
                    <div><span className="rpg-side-stat-icon xp"><img src="/assets/incoming/the_xp_18.png" alt="" aria-hidden="true"/></span><small>KINH NGHIỆM</small><strong>{xp.toLocaleString('vi-VN')} XP</strong></div>
                    <div><span className="rpg-side-stat-icon streak"><UIIcon name="flame" size={17}/></span><small>CHUỖI HỌC</small><strong>{learningStreak} ngày</strong></div>
                    <div><span className="rpg-side-stat-icon gems"><img src="/assets/incoming/kim_cuong_gems.png" alt="" aria-hidden="true"/></span><small>GEMS</small><strong>120</strong></div>
                  </section>
                  <button className="rpg-daily-toggle" type="button" aria-expanded={dailySheetOpen} aria-controls="rpg-daily-sheet" onClick={() => setDailySheetOpen((open) => !open)}>
                    <span><img className="rpg-challenge-cup" src="/assets/incoming/cup_thu_thach.png" alt="" aria-hidden="true"/> Thử thách hôm nay</span><strong>{completedDailyQuestCount} / {dailyQuests.length}</strong><span className="rpg-chevron">{dailySheetOpen ? '−' : '+'}</span>
                  </button>
                  {dailySheetOpen && <section className="rpg-daily-sheet" id="rpg-daily-sheet" aria-label="Chi tiết thử thách hôm nay">
                    <p>Tiến độ được ghi nhận từ hoạt động quiz hợp lệ.</p>
                    {dailyQuests.map((quest) => <div className="rpg-daily-row" key={quest.id}><span>{quest.done ? '✓' : '◇'}</span><div><strong>{quest.title}</strong><small>{quest.description}</small></div><b>{quest.progress}/{quest.target}</b></div>)}
                  </section>}
                </aside>
              </div>
            </section>
          )}

          {activeNav === 'overview' && (
            <>
              <section className="stats-grid" aria-label="Thống kê học tập">
                <article className="stat-card"><div className="stat-top"><span className="stat-icon purple-icon"><UIIcon name="sparkles" /></span><span className="stat-trend">+12% ↗</span></div><span className="stat-label">TỔNG KINH NGHIỆM</span><div className="stat-value">{xp.toLocaleString('vi-VN')} <small>XP</small></div><div className="stat-foot">Bạn đang tiến bộ mỗi ngày</div></article>
                <article className="stat-card"><div className="stat-top"><span className="stat-icon orange-icon"><UIIcon name="flame" /></span><span className="stat-note">THEO QUIZ THỰC TẾ</span></div><span className="stat-label">CHUỖI NGÀY HỌC</span><div className="stat-value">{learningStreak} <small>ngày</small></div><div className="mini-week" aria-label="Ngày học trong tuần hiện tại" title="Chuỗi chỉ tính ngày liên tiếp có quiz hoàn thành.">{currentWeek.map((day) => <span key={day.dateKey} title={`${day.dateKey}: ${day.learned ? 'có quiz hoàn thành' : 'chưa có quiz hoàn thành'}`} className={day.learned ? 'day-done' : day.today ? 'day-today' : ''}>{day.label}{day.today && !day.learned && <span className="today-opportunity-dot" aria-label="Hôm nay vẫn còn cơ hội học" />}</span>)}</div><div className="stat-foot">{learningDates.length === 0 ? 'Hoàn thành quiz để bắt đầu chuỗi ngày học.' : 'Chuỗi chỉ tính ngày có quiz hoàn thành liên tiếp.'}</div></article>
                <article className="stat-card"><div className="stat-top"><span className="stat-icon cyan-icon"><UIIcon name="trophy" /></span><span className="stat-note">HÔM NAY</span></div><span className="stat-label">NHIỆM VỤ CHƯƠNG</span><div className="stat-value">{completedCount}<small> / {quests.length}</small></div><div className="stat-progress"><span style={{ width: `${completedCount / quests.length * 100}%` }} /></div><div className="stat-foot">{Math.round(completedCount / quests.length * 100)}% hành trình hiện tại</div></article>
              </section>

              <article className="focus-card focus-card-featured"><div className="focus-glow" /><p className="section-kicker">CỘT MỐC TIẾP THEO</p><div className="focus-art" aria-hidden="true"><UIIcon name="target" size={34} /></div><h2>Hành trình<br /><span>đang tiến triển.</span></h2><p>{quests.find((quest) => quest.status === 'active') ? `Chặng đang mở: ${quests.find((quest) => quest.status === 'active')?.title}.` : 'Hoàn thành quiz để tiếp tục mở khóa các chặng tiếp theo.'} Mục tiêu kế tiếp là cấp độ {level + 1}.</p><span className="focus-footer">MỌI BƯỚC TIẾN ĐỀU ĐÁNG GIÁ</span></article>

              <section className="quest-map-section" id="map">
                <div className="section-heading"><div><p className="section-kicker">THE LEARNING ODYSSEY</p><h2>Bản đồ nhiệm vụ <span className="heading-spark">✦</span></h2><p className="section-description">Mỗi chặng mở ra một kỹ năng mới.</p></div><button className="text-button" type="button" onClick={() => setActiveNav('map')}>Xem bản đồ đầy đủ <span>↗</span></button></div>
                <div className="map-card">
                  <div className="map-topline"><div><span className="chapter-tag">CHƯƠNG 01</span><span className="map-muted"> / KHỞI NGUYÊN TRI THỨC</span></div><span className="map-completion">{completedCount} / {quests.length} HOÀN THÀNH</span></div>
                  <div className="quest-path" aria-label="Các nhiệm vụ trong chương">
                    <div className="path-line"><span style={{ width: `${completedCount / quests.length * 100}%` }} /></div>
                    {quests.map((quest, index) => (
                      <button key={quest.id} className={`quest-node-wrap node-${index + 1}`} type="button" onClick={() => startQuest(quest)} aria-label={`${quest.title}, ${quest.status === 'done' ? 'đã hoàn thành' : quest.status === 'active' ? 'đang mở' : 'đang khóa'}`}>
                        <span className={`quest-node ${quest.status}`}>{quest.status === 'done' ? '✓' : quest.status === 'locked' ? '⌑' : quest.icon}</span>
                        <span className="node-caption">{quest.status === 'done' ? 'HOÀN THÀNH' : quest.id === 4 && quest.status === 'active' ? 'ĐÁNH TRÙM CHƯƠNG · BẮT ĐẦU NGAY' : quest.status === 'active' ? 'TIẾP TỤC' : 'ĐANG KHÓA'}</span>
                        <strong>{quest.title}</strong><small>Tối đa +{quest.xp} XP</small>
                      </button>
                    ))}
                  </div>
                  <div className="map-bottom"><span><span className="legend-dot completed-dot" /> Đã hoàn thành</span><span><span className="legend-dot active-dot" /> Nhiệm vụ hiện tại</span><span><span className="legend-dot locked-dot" /> Chưa mở khóa</span><span className="map-footer-note">TIẾP TỤC ĐỂ NHẬN THƯỞNG <span>✧</span></span></div>
                </div>
              </section>

              <section className="bottom-grid">
                <article className="daily-card"><div className="section-heading compact"><div><p className="section-kicker">THỬ THÁCH HẰNG NGÀY</p><h2>Thử thách hằng ngày</h2><p className="daily-date">Ngày {dailyActivity.date} · tiến độ tự ghi nhận từ quiz</p></div><span className="daily-count">{completedDailyQuestCount} / {dailyQuests.length}</span></div>
                  {completedDailyQuestCount === 0 && <div className="daily-empty-state" role="status"><UIIcon name="sparkles" size={20} /><div><strong>Hôm nay chưa bắt đầu</strong><span>Làm 1 quiz để mở đầu ngày mới. Tiến độ sẽ tự cập nhật sau khi hoàn thành.</span></div></div>}
                  <div className="daily-quests-grid">{dailyQuests.map((quest) => <div className={`daily-row ${quest.done ? 'daily-row-done' : ''}`} key={quest.id}><span className="daily-icon">{quest.done ? '✓' : quest.icon}</span><div className="daily-copy"><strong>{quest.title}</strong><span>{quest.description}</span><div className="daily-track"><span style={{ width: `${quest.progress / quest.target * 100}%` }} /></div><small className="daily-progress-label">{quest.progress} / {quest.target}</small></div><span className={`daily-check ${quest.done ? 'is-visible' : ''}`}>{quest.done ? '✓' : '—'}</span></div>)}</div>
                  <p className="daily-footnote">Tiến độ nhiệm vụ được tính từ quiz hợp lệ trong ngày. Tài khoản nhận +50 XP một lần khi server xác minh đủ 3/3 nhiệm vụ; chế độ khách chỉ lưu tiến độ cục bộ và không nhận thưởng server.</p></article>
              </section>
            </>
          )}

          {activeNav === 'lessons' && <LessonLibrary onNotice={setNotice} onQuizComplete={handleQuizComplete} completedLessonIds={Object.keys(completedLessons).filter((id) => completedLessons[Number(id)]).map(Number)} />}

          {activeNav === 'practice' && <section className="alternate-panel"><p className="section-kicker">PRACTICE HUB</p><h2>Chọn cách bạn muốn luyện tập</h2><div className="practice-grid"><button type="button" onClick={() => startQuest(quests.find((quest) => quest.status === 'active') ?? quests[0])}><span>✧</span><strong>Luyện tập nhanh</strong><small>Ôn lại kiến thức trong vài phút</small></button><button type="button" onClick={() => setNotice('Chế độ thử thách sẽ được phát triển ở P2 — Learning Core.')}><span>⚡</span><strong>Thử thách kiến thức</strong><small>Kiểm tra mức độ ghi nhớ</small></button><button type="button" onClick={() => setNotice('Lịch sử học tập sẽ được kết nối với dữ liệu thực ở giai đoạn backend.')}><span>◷</span><strong>Lịch sử học tập</strong><small>Theo dõi những gì bạn đã học</small></button></div></section>}
          {activeNav === 'achievements' && <section className="alternate-panel"><p className="section-kicker">YOUR COLLECTION · P4.1</p><div className="achievement-heading"><div><h2>Thành tựu của nhà thám hiểm</h2><p className="section-description">Thành tựu được mở khóa tự động theo tiến độ quiz đã lưu; không có nút nhận thưởng nên không thể cộng XP trùng.</p></div><span className="achievement-counter">{unlockedAchievementCount}/{achievements.length} ĐÃ MỞ</span></div><div className="achievement-grid">{achievements.map((achievement) => <article key={achievement.id} className={`achievement-card ${achievement.unlocked ? 'achievement-unlocked' : 'achievement-locked'}`} aria-label={`${achievement.title}: ${achievement.unlocked ? 'đã mở khóa' : 'chưa mở khóa'}`}><span aria-hidden="true">{achievement.unlocked ? achievement.icon : '◇'}</span><strong>{achievement.title}</strong><small>{achievement.description}</small><div className="achievement-progress"><span>{achievement.progress}</span><span className={achievement.unlocked ? 'achievement-state is-unlocked' : 'achievement-state'}>{achievement.unlocked ? '✓ ĐÃ MỞ KHÓA' : 'ĐANG TIẾN TỚI'}</span></div></article>)}</div></section>}

          <footer className="footer"><span>HOC TAP QUEST <span className="footer-muted">· {readOnlyPreview ? 'STAGING PREVIEW' : 'LEARN THROUGH PLAY'}</span></span><span className="footer-status"><span className="status-dot" /> {readOnlyPreview ? 'READ-ONLY · KHÔNG GHI TIẾN ĐỘ' : 'Đã lưu tiến độ'}</span></footer>
        </div>
      </section>
    </main>
  );
}


export default App;
