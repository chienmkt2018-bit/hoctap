export type AuthUser = { id: string; email: string };

export type ApiProgress = {
  totalXp: number;
  completedLessonIds: number[];
  learningDates: string[];
  bestXpByLesson: Record<string, number>;
  questStatuses: Record<string, 'done' | 'active' | 'locked'>;
  updatedAt: string;
};

type AuthResponse = {
  token: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: AuthUser;
};

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'https://hoctap-6oeu.onrender.com').replace(/\/$/, '');
const tokenStorageKey = 'hoc-tap-quest-access-token-v1';

export function readAccessToken(): string | null {
  try {
    return window.sessionStorage.getItem(tokenStorageKey);
  } catch {
    return null;
  }
}

function saveAccessToken(token: string): void {
  window.sessionStorage.setItem(tokenStorageKey, token);
}

export function clearAccessToken(): void {
  try {
    window.sessionStorage.removeItem(tokenStorageKey);
  } catch {
    // Storage can be disabled; the current page can still continue in local mode.
  }
}

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new Error('Không thể kết nối máy chủ. Tiến độ cục bộ vẫn được giữ nguyên.');
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const data = payload as { error?: { message?: string; code?: string } } | null;
    if (response.status === 401) clearAccessToken();
    throw new Error(data?.error?.message || `Yêu cầu thất bại (HTTP ${response.status}).`);
  }
  return payload as T;
}

export async function authenticate(
  mode: 'login' | 'register',
  email: string,
  password: string,
): Promise<AuthUser> {
  const result = await request<AuthResponse>(`/api/v1/auth/${mode === 'register' ? 'register' : 'login'}`, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  saveAccessToken(result.token);
  return result.user;
}

export async function getCurrentUser(token: string): Promise<AuthUser> {
  const result = await request<{ user: AuthUser }>('/api/v1/auth/me', {}, token);
  return result.user;
}

export async function getRemoteProgress(token: string): Promise<ApiProgress> {
  const result = await request<{ progress: ApiProgress }>('/api/v1/progress', {}, token);
  return result.progress;
}

export async function saveRemoteProgress(
  token: string,
  progress: Pick<ApiProgress, 'completedLessonIds' | 'questStatuses'>,
): Promise<ApiProgress> {
  const result = await request<{ progress: ApiProgress }>('/api/v1/progress', {
    method: 'PUT',
    body: JSON.stringify(progress),
  }, token);
  return result.progress;
}


export type QuizAttemptAnswer = { questionId: string; selectedOptionId: string };

export type ServerQuizAttemptResult = {
  attemptId: string;
  correctCount: number;
  totalQuestions: number;
  percentage: number;
  xpAwarded: number;
  totalXp: number;
  replayed: boolean;
};

export async function submitQuizAttempt(
  token: string,
  quizId: number,
  attemptId: string,
  answers: QuizAttemptAnswer[],
): Promise<ServerQuizAttemptResult> {
  return request<ServerQuizAttemptResult>(`/api/v1/quizzes/${quizId}/attempts`, {
    method: 'POST',
    body: JSON.stringify({ attemptId, answers, timezoneOffsetMinutes: new Date().getTimezoneOffset() }),
  }, token);
}
