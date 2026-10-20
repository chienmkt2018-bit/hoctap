import { useEffect, useState, type FormEvent } from 'react';
import LessonLibrary from './LessonLibrary';
import type { QuizResult } from './QuizPanel';
import { authenticate, clearAccessToken, getCurrentUser, getRemoteProgress, readAccessToken, saveRemoteProgress, type ApiProgress, type AuthUser } from './auth';

type Quest = {
  id: number;
  title: string;
  subtitle: string;
  xp: number;
  status: 'done' | 'active' | 'locked';
  icon: string;
};

const initialQuests: Quest[] = [
  { id: 1, title: 'Khởi động tư duy', subtitle: 'Bài học nền tảng · 5 phút', xp: 30, status: 'done', icon: '✦' },
  { id: 2, title: 'Mở khóa kiến thức', subtitle: 'Khái niệm cốt lõi · 8 phút', xp: 40, status: 'active', icon: '◈' },
  { id: 3, title: 'Thử thách nhanh', subtitle: '5 câu hỏi · 4 phút', xp: 50, status: 'locked', icon: '⚡' },
  { id: 4, title: 'Trùm chương', subtitle: 'Kiểm tra tổng hợp · 10 phút', xp: 100, status: 'locked', icon: '♜' },
];

const progressStorageKey = 'hoc-tap-quest-progress-v1';

type SavedProgress = {
  quests: Quest[];
  earnedQuizXp: number;
  quizBestXp: Record<number, number>;
  completedLessons: Record<number, boolean>;
};

function readSavedProgress(): SavedProgress | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(progressStorageKey);
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
    };
  } catch {
    // Storage may be disabled or contain malformed data; start with clean defaults.
    return null;
  }
}

const navigation = [
  { id: 'overview', icon: '◫', label: 'Tổng quan' },
  { id: 'map', icon: '⌘', label: 'Bản đồ nhiệm vụ' },
  { id: 'lessons', icon: '▤', label: 'Bài học' }, 
  { id: 'practice', icon: '✧', label: 'Luyện tập' },
  { id: 'achievements', icon: '♛', label: 'Thành tựu' },
];


function mergeRemoteProgress(remote: ApiProgress, local: SavedProgress): SavedProgress {
  const completedLessons = { ...local.completedLessons };
  for (const lessonId of remote.completedLessonIds) completedLessons[lessonId] = true;

  const quests = local.quests.map((quest) => {
    const remoteStatus = remote.questStatuses[`quest_${quest.id}`];
    const status = quest.status === 'done' || remoteStatus === 'done'
      ? 'done'
      : quest.status === 'active' || remoteStatus === 'active'
        ? 'active'
        : 'locked';
    return { ...quest, status } as Quest;
  });

  const remoteBestXp = Object.fromEntries(
    Object.entries(remote.bestXpByLesson).map(([lessonId, xp]) => [Number(lessonId), xp]),
  );
  const quizBestXp = { ...local.quizBestXp, ...remoteBestXp };

  return { ...local, quests, completedLessons, quizBestXp };
}

function toRemoteProgress(local: SavedProgress): Pick<ApiProgress, 'completedLessonIds' | 'questStatuses'> {
  return {
    completedLessonIds: Object.entries(local.completedLessons)
      .filter(([, completed]) => completed)
      .map(([lessonId]) => Number(lessonId))
      .filter((lessonId) => Number.isSafeInteger(lessonId) && lessonId > 0),
    questStatuses: Object.fromEntries(local.quests.map((quest) => [`quest_${quest.id}`, quest.status])),
  };
}

function App() {
  const [activeNav, setActiveNav] = useState('overview');
  const [quests, setQuests] = useState(() => readSavedProgress()?.quests ?? initialQuests);
  const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null);
  const [notice, setNotice] = useState('');
  const [earnedQuizXp, setEarnedQuizXp] = useState(() => readSavedProgress()?.earnedQuizXp ?? 0);
  const [serverTotalXp, setServerTotalXp] = useState<number | null>(null);
  const [quizBestXp, setQuizBestXp] = useState<Record<number, number>>(() => readSavedProgress()?.quizBestXp ?? {});
  const [completedLessons, setCompletedLessons] = useState<Record<number, boolean>>(() => readSavedProgress()?.completedLessons ?? {});
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [syncReady, setSyncReady] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.setItem(progressStorageKey, JSON.stringify({ quests, earnedQuizXp, quizBestXp, completedLessons } satisfies SavedProgress));
    } catch {
      setNotice('Không thể lưu tiến độ trên trình duyệt này. Hãy kiểm tra chế độ riêng tư hoặc dung lượng lưu trữ.');
    }
  }, [quests, earnedQuizXp, quizBestXp, completedLessons]);

  // Restore a session token, then merge server progress with local progress without
  // discarding local-only XP/best-score data.
  useEffect(() => {
    const token = readAccessToken();
    if (!token) return;
    let cancelled = false;
    void (async () => {
      try {
        const currentUser = await getCurrentUser(token);
        const remote = await getRemoteProgress(token);
        if (cancelled) return;
        const local: SavedProgress = { quests, earnedQuizXp, quizBestXp, completedLessons };
        const merged = mergeRemoteProgress(remote, local);
        setQuests(merged.quests);
        setEarnedQuizXp(merged.earnedQuizXp);
        setServerTotalXp(remote.totalXp);
        setQuizBestXp(merged.quizBestXp);
        setCompletedLessons(merged.completedLessons);
        setUser(currentUser);
        setSyncReady(true);
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

  // Debounce remote writes; localStorage remains the immediate local fallback.
  useEffect(() => {
    if (!user || !syncReady) return;
    const token = readAccessToken();
    if (!token) return;
    const snapshot: SavedProgress = { quests, earnedQuizXp, quizBestXp, completedLessons };
    const timeout = window.setTimeout(() => {
      void saveRemoteProgress(token, toRemoteProgress(snapshot)).catch((error: unknown) => {
        setNotice(error instanceof Error ? `Không đồng bộ được lên máy chủ: ${error.message} Tiến độ cục bộ vẫn được giữ.` : 'Không đồng bộ được lên máy chủ; tiến độ cục bộ vẫn được giữ.');
      });
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [user, syncReady, quests, earnedQuizXp, quizBestXp, completedLessons]);

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
      const local: SavedProgress = { quests, earnedQuizXp, quizBestXp, completedLessons };
      const merged = mergeRemoteProgress(remote, local);
      setQuests(merged.quests);
      setEarnedQuizXp(merged.earnedQuizXp);
      setServerTotalXp(remote.totalXp);
      setQuizBestXp(merged.quizBestXp);
      setCompletedLessons(merged.completedLessons);
      setUser(currentUser);
      setSyncReady(true);
      setAuthPassword('');
      setAuthOpen(false);
      setNotice(`Đã ${authMode === 'register' ? 'tạo tài khoản và đăng nhập' : 'đăng nhập'} thành công. Tiến độ cục bộ và trên tài khoản đã được hợp nhất.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Không thể đăng nhập lúc này.');
    } finally {
      setAuthBusy(false);
    }
  }

  function handleLogout() {
    clearAccessToken();
    setUser(null);
    setSyncReady(false);
    setServerTotalXp(null);
    setAuthOpen(false);
    setNotice('Đã đăng xuất. Tiến độ trên trình duyệt vẫn được giữ nguyên.');
  }

  const completedCount = quests.filter((quest) => quest.status === 'done').length;
  const xp = 680 + Math.max(0, completedCount - 1) * 30 + (serverTotalXp ?? earnedQuizXp);
  const level = 3 + Math.floor(xp / 1000) - Math.floor(680 / 1000);
  const levelProgress = xp % 1000;
  const activeTitle = navigation.find((item) => item.id === activeNav)?.label ?? 'Tổng quan';

  function handleQuizComplete(result: QuizResult): number {
    setCompletedLessons((current) => ({ ...current, [result.lessonId]: true }));
    if (result.serverAwardedXp !== undefined) {
      const awarded = result.serverAwardedXp;
      setQuizBestXp((current) => ({
        ...current,
        [result.lessonId]: Math.max(current[result.lessonId] ?? 0, result.calculatedXp),
      }));
      setEarnedQuizXp((current) => current + awarded);
      setServerTotalXp(result.serverTotalXp ?? null);
      setNotice(`Máy chủ đã lưu quiz “${result.lessonTitle}”: ${result.correctCount}/${result.totalQuestions} câu đúng (${result.percentage}%). XP cộng thêm: ${awarded}; tổng XP tài khoản: ${(result.serverTotalXp ?? 0).toLocaleString('vi-VN')}.`);
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

  function completeSelectedQuest() {
    if (!selectedQuest) return;
    setQuests((current) => current.map((quest) => {
      if (quest.id === selectedQuest.id) return { ...quest, status: 'done' };
      if (quest.status === 'locked' && quest.id === selectedQuest.id + 1) return { ...quest, status: 'active' };
      return quest;
    }));
    setNotice(`Hoàn thành “${selectedQuest.title}”! Bạn vừa tiến thêm một bước trên hành trình.`);
    setSelectedQuest(null);
  }

  return (
    <main className="app-layout">
      <aside className="sidebar">
        <a className="brand" href="#overview" onClick={() => setActiveNav('overview')} aria-label="HOC TAP QUEST trang chủ">
          <span className="brand-mark">HQ</span>
          <span className="brand-name">HOC TAP <strong>QUEST</strong></span>
        </a>
        <div className="sidebar-label">KHÔNG GIAN HỌC TẬP</div>
        <nav className="nav-list" aria-label="Điều hướng chính">
          {navigation.map((item) => (
            <button key={item.id} className={`nav-item ${activeNav === item.id ? 'is-active' : ''}`} onClick={() => { setActiveNav(item.id); setSelectedQuest(null); }} type="button">
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>
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
        <div className="profile-row">
          <div className="avatar">C</div>
          <div className="profile-copy"><strong>Nhà thám hiểm</strong><span>Thành viên cấp 03</span></div>
          <span className="profile-menu" aria-hidden="true">···</span>
        </div>
      </aside>

      <section className="main-area" id="overview">
        <header className="topbar">
          <div className="breadcrumb"><span>HOC TAP QUEST</span><span className="breadcrumb-slash">/</span><strong>{activeTitle}</strong></div>
          <div className="topbar-right">
            <div className="streak-chip"><span>♨</span><strong>5</strong><span className="chip-caption">NGÀY</span></div>
            <div className="currency-chip"><span className="gem">◆</span><strong>120</strong><span className="chip-caption">GEMS</span></div>
            <button className="icon-button" type="button" aria-label="Thông báo" onClick={() => setNotice('Bạn đã xem thông báo mới nhất.')}>♧<span className="notification-dot" /></button>
            {user ? <div className="account-chip" title={user.email}><span className="account-dot" /><span className="account-email">{user.email}</span><button type="button" onClick={handleLogout}>Đăng xuất</button></div> : <button className="auth-trigger" type="button" onClick={() => { setAuthOpen((open) => !open); setNotice(''); }}>{authOpen ? 'Đóng' : 'Đăng nhập'}</button>}
          </div>
        </header>

        <div className="content-wrap">
          {authOpen && !user && <section className="auth-panel" aria-labelledby="auth-panel-title">
            <div className="auth-panel-heading"><div><p className="section-kicker">TÀI KHOẢN HỌC TẬP</p><h2 id="auth-panel-title">{authMode === 'login' ? 'Chào mừng trở lại' : 'Tạo tài khoản mới'}</h2><p>Đăng nhập để đồng bộ bài đã hoàn thành giữa các thiết bị. Tiến độ hiện có trên trình duyệt sẽ được giữ và hợp nhất.</p></div><button type="button" className="close-button" aria-label="Đóng biểu mẫu" onClick={() => setAuthOpen(false)}>×</button></div>
            <form className="auth-form" onSubmit={handleAuthSubmit}>
              <label>Email<input type="email" autoComplete="email" required maxLength={254} value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="ban@example.com" /></label>
              <label>Mật khẩu<input type="password" autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} required minLength={authMode === 'register' ? 10 : 1} maxLength={128} value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder={authMode === 'register' ? 'Tối thiểu 10 ký tự' : 'Nhập mật khẩu'} /></label>
              <div className="auth-form-footer"><button className="primary-button" type="submit" disabled={authBusy}>{authBusy ? 'Đang xử lý…' : authMode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'} <span>→</span></button><button className="auth-mode-toggle" type="button" disabled={authBusy} onClick={() => { setAuthMode((mode) => mode === 'login' ? 'register' : 'login'); setNotice(''); }}>{authMode === 'login' ? 'Chưa có tài khoản? Đăng ký' : 'Đã có tài khoản? Đăng nhập'}</button></div>
            </form>
            <p className="auth-footnote">Phiên đăng nhập được giữ trong tab hiện tại; khi đăng xuất, dữ liệu học cục bộ không bị xóa.</p>
          </section>}

          <div className="page-intro">
            <div>
              <p className="eyebrow"><span className="eyebrow-line" /> THỨ HAI · HÀNH TRÌNH CỦA BẠN</p>
              <h1>{activeNav === 'overview' ? <>Chào mừng trở lại,<br /><span>nhà thám hiểm.</span></> : activeTitle + '.'}</h1>
              <p className="intro-copy">{activeNav === 'map' ? 'Chọn một điểm trên bản đồ và tiếp tục hành trình chinh phục kiến thức.' : activeNav === 'lessons' ? 'Khám phá bài học theo chủ đề, cấp độ và trạng thái của hành trình.' : activeNav === 'practice' ? 'Rèn luyện mỗi ngày để biến kiến thức thành kỹ năng.' : activeNav === 'achievements' ? 'Mỗi cột mốc là bằng chứng cho nỗ lực của bạn.' : 'Một bước nhỏ hôm nay, một phiên bản giỏi hơn vào ngày mai.'}</p>
            </div>
            <div className="level-card">
              <div className="level-orb"><span>{String(level).padStart(2, '0')}</span><small>LVL</small></div>
              <div className="level-details"><span className="level-label">CẤP ĐỘ HIỆN TẠI</span><strong>{level >= 4 ? 'Người chinh phục' : 'Người khai phá'}</strong><div className="progress-track"><span style={{ width: `${levelProgress / 10}%` }} /></div><small>{levelProgress.toLocaleString('vi-VN')} / 1.000 XP đến cấp {level + 1}</small></div>
            </div>
          </div>

          {notice && <div className="notice" role="status"><span>✦</span>{notice}<button type="button" onClick={() => setNotice('')} aria-label="Đóng thông báo">×</button></div>}

          {selectedQuest && (
            <section className="lesson-panel" aria-live="polite">
              <div className="lesson-symbol">{selectedQuest.icon}</div>
              <div className="lesson-body"><span className="section-kicker">NHIỆM VỤ ĐANG CHỌN · +{selectedQuest.xp} XP</span><h2>{selectedQuest.title}</h2><p>{selectedQuest.subtitle}. Sẵn sàng bắt đầu phiên học ngắn của bạn?</p></div>
              <button className="primary-button" type="button" onClick={completeSelectedQuest}>Hoàn thành nhiệm vụ <span>↗</span></button>
              <button className="close-button" type="button" aria-label="Đóng nhiệm vụ" onClick={() => setSelectedQuest(null)}>×</button>
            </section>
          )}

          {activeNav === 'overview' && (
            <>
              <section className="stats-grid" aria-label="Thống kê học tập">
                <article className="stat-card"><div className="stat-top"><span className="stat-icon purple-icon">✧</span><span className="stat-trend">+12% ↗</span></div><span className="stat-label">TỔNG KINH NGHIỆM</span><div className="stat-value">{xp.toLocaleString('vi-VN')} <small>XP</small></div><div className="stat-foot">Bạn đang tiến bộ mỗi ngày</div></article>
                <article className="stat-card"><div className="stat-top"><span className="stat-icon orange-icon">♨</span><span className="stat-note">MỤC TIÊU: 7 NGÀY</span></div><span className="stat-label">CHUỖI NGÀY HỌC</span><div className="stat-value">5 <small>ngày</small></div><div className="mini-week"><span className="day-done">T2</span><span className="day-done">T3</span><span className="day-done">T4</span><span className="day-done">T5</span><span className="day-today">T6</span><span>T7</span><span>CN</span></div></article>
                <article className="stat-card"><div className="stat-top"><span className="stat-icon cyan-icon">◈</span><span className="stat-note">HÔM NAY</span></div><span className="stat-label">NHIỆM VỤ HOÀN THÀNH</span><div className="stat-value">{completedCount}<small> / {quests.length}</small></div><div className="stat-progress"><span style={{ width: `${completedCount / quests.length * 100}%` }} /></div><div className="stat-foot">{Math.round(completedCount / quests.length * 100)}% hành trình hiện tại</div></article>
              </section>

              <section className="quest-map-section" id="map">
                <div className="section-heading"><div><p className="section-kicker">THE LEARNING ODYSSEY</p><h2>Bản đồ nhiệm vụ <span className="heading-spark">✦</span></h2><p className="section-description">Mỗi chặng mở ra một kỹ năng mới.</p></div><button className="text-button" type="button" onClick={() => setActiveNav('map')}>Xem bản đồ đầy đủ <span>↗</span></button></div>
                <div className="map-card">
                  <div className="map-topline"><div><span className="chapter-tag">CHƯƠNG 01</span><span className="map-muted"> / KHỞI NGUYÊN TRI THỨC</span></div><span className="map-completion">{completedCount} / {quests.length} HOÀN THÀNH</span></div>
                  <div className="quest-path" aria-label="Các nhiệm vụ trong chương">
                    <div className="path-line"><span style={{ width: `${completedCount / quests.length * 100}%` }} /></div>
                    {quests.map((quest, index) => (
                      <button key={quest.id} className={`quest-node-wrap node-${index + 1}`} type="button" onClick={() => startQuest(quest)} aria-label={`${quest.title}, ${quest.status === 'done' ? 'đã hoàn thành' : quest.status === 'active' ? 'đang mở' : 'đang khóa'}`}>
                        <span className={`quest-node ${quest.status}`}>{quest.status === 'done' ? '✓' : quest.status === 'locked' ? '⌑' : quest.icon}</span>
                        <span className="node-caption">{quest.status === 'done' ? 'HOÀN THÀNH' : quest.status === 'active' ? 'TIẾP TỤC' : 'ĐANG KHÓA'}</span>
                        <strong>{quest.title}</strong><small>+{quest.xp} XP</small>
                      </button>
                    ))}
                  </div>
                  <div className="map-bottom"><span><span className="legend-dot completed-dot" /> Đã hoàn thành</span><span><span className="legend-dot active-dot" /> Nhiệm vụ hiện tại</span><span><span className="legend-dot locked-dot" /> Chưa mở khóa</span><span className="map-footer-note">TIẾP TỤC ĐỂ NHẬN THƯỞNG <span>✧</span></span></div>
                </div>
              </section>

              <section className="bottom-grid">
                <article className="daily-card"><div className="section-heading compact"><div><p className="section-kicker">DAILY QUESTS</p><h2>Nhiệm vụ hôm nay</h2></div><span className="daily-count">1 / 3</span></div><div className="daily-row"><span className="daily-icon">◉</span><div className="daily-copy"><strong>Hoàn thành một bài học</strong><span>Tiến thêm một bước trên bản đồ</span><div className="daily-track"><span style={{ width: '100%' }} /></div></div><span className="daily-reward">+30 XP</span><span className="daily-check">✓</span></div><div className="daily-row"><span className="daily-icon">⌁</span><div className="daily-copy"><strong>Học liên tục 10 phút</strong><span>Giữ nhịp học tập của bạn</span><div className="daily-track"><span style={{ width: '40%' }} /></div></div><span className="daily-reward">+20 XP</span></div><div className="daily-row"><span className="daily-icon">✧</span><div className="daily-copy"><strong>Đạt 80% bài luyện tập</strong><span>Chính xác và bền bỉ</span><div className="daily-track"><span style={{ width: '0%' }} /></div></div><span className="daily-reward">+50 XP</span></div></article>
                <article className="focus-card"><div className="focus-glow" /><p className="section-kicker">YOUR NEXT MILESTONE</p><div className="focus-art" aria-hidden="true">✧</div><h2>Mở khóa<br /><span>chân trời mới.</span></h2><p>Hoàn thành chặng tiếp theo để tiến gần hơn tới cấp độ 4.</p><button className="primary-button full-button" type="button" onClick={() => startQuest(quests.find((quest) => quest.status === 'active') ?? quests[0])}>Tiếp tục hành trình <span>→</span></button><span className="focus-footer">MỌI BƯỚC TIẾN ĐỀU ĐÁNG GIÁ</span></article>
              </section>
            </>
          )}

          {activeNav === 'lessons' && <LessonLibrary onNotice={setNotice} onQuizComplete={handleQuizComplete} completedLessonIds={Object.keys(completedLessons).map(Number)} />}

          {activeNav === 'map' && (
            <section className="alternate-panel"><div className="section-heading"><div><p className="section-kicker">CHAPTER SELECT</p><h2>Chọn chặng tiếp theo</h2><p className="section-description">Nhấn vào nhiệm vụ đang mở hoặc đã hoàn thành để xem chi tiết.</p></div></div><div className="alternate-quests">{quests.map((quest) => <button type="button" key={quest.id} className="alternate-quest" onClick={() => startQuest(quest)}><span className={`quest-node ${quest.status}`}>{quest.status === 'done' ? '✓' : quest.status === 'locked' ? '⌑' : quest.icon}</span><span className="alternate-quest-copy"><strong>{quest.title}</strong><small>{quest.subtitle}</small></span><span className="daily-reward">+{quest.xp} XP</span><span className="alternate-status">{quest.status === 'done' ? 'ĐÃ XONG' : quest.status === 'active' ? 'TIẾP TỤC' : 'ĐANG KHÓA'}</span></button>)}</div></section>
          )}
          {activeNav === 'practice' && <section className="alternate-panel"><p className="section-kicker">PRACTICE HUB</p><h2>Chọn cách bạn muốn luyện tập</h2><div className="practice-grid"><button type="button" onClick={() => startQuest(quests.find((quest) => quest.status === 'active') ?? quests[0])}><span>✧</span><strong>Luyện tập nhanh</strong><small>Ôn lại kiến thức trong vài phút</small></button><button type="button" onClick={() => setNotice('Chế độ thử thách sẽ được phát triển ở P2 — Learning Core.')}><span>⚡</span><strong>Thử thách kiến thức</strong><small>Kiểm tra mức độ ghi nhớ</small></button><button type="button" onClick={() => setNotice('Lịch sử học tập sẽ được kết nối với dữ liệu thực ở giai đoạn backend.')}><span>◷</span><strong>Lịch sử học tập</strong><small>Theo dõi những gì bạn đã học</small></button></div></section>}
          {activeNav === 'achievements' && <section className="alternate-panel"><p className="section-kicker">YOUR COLLECTION</p><h2>Thành tựu của nhà thám hiểm</h2><div className="achievement-grid"><article><span>✦</span><strong>Bước đầu tiên</strong><small>Hoàn thành nhiệm vụ đầu tiên</small><em>ĐÃ MỞ KHÓA</em></article><article><span>♨</span><strong>Giữ lửa</strong><small>Học 5 ngày liên tiếp</small><em>ĐÃ MỞ KHÓA</em></article><article className="achievement-locked"><span>♛</span><strong>Bậc thầy tri thức</strong><small>Hoàn thành toàn bộ chương 1</small><em>CHƯA MỞ KHÓA</em></article></div></section>}

          <footer className="footer"><span>HOC TAP QUEST <span className="footer-muted">· LEARN THROUGH PLAY</span></span><span className="footer-status"><span className="status-dot" /> P2.4 · SAVED PROGRESS</span></footer>
        </div>
      </section>
    </main>
  );
}

export default App;
