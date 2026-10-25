import { useCallback, useEffect, useState } from 'react';
import { getStagingHealth, type StagingHealth } from './stagingApi';
import './staging.css';

type Section = 'overview' | 'quests' | 'lessons';

const lessons = [
  { id: '01', title: 'Khởi động tư duy', subject: 'TƯ DUY NỀN TẢNG', level: 'CƠ BẢN', duration: '5 phút', icon: '✦', state: 'Sẵn sàng xem' },
  { id: '02', title: 'Mở khóa kiến thức', subject: 'TƯ DUY NỀN TẢNG', level: 'CƠ BẢN', duration: '8 phút', icon: '◈', state: 'Sẵn sàng xem' },
  { id: '03', title: 'Thử thách nhanh', subject: 'TƯ DUY NỀN TẢNG', level: 'TRUNG CẤP', duration: '4 phút', icon: 'ϟ', state: 'Bản xem trước' },
  { id: '04', title: 'Từ vựng mỗi ngày', subject: 'TIẾNG ANH', level: 'CƠ BẢN', duration: '6 phút', icon: 'Aa', state: 'Sẵn sàng xem' },
];

const quests = [
  { number: '01', title: 'Khởi động tư duy', note: 'Làm quen với hành trình học tập', xp: '+18 XP', status: 'ĐIỂM KHỞI ĐẦU' },
  { number: '02', title: 'Mở khóa kiến thức', note: 'Kết nối thông tin và ví dụ', xp: '+18 XP', status: 'BẢN XEM TRƯỚC' },
  { number: '03', title: 'Thử thách nhanh', note: 'Ôn tập các khái niệm trọng tâm', xp: '+36 XP', status: 'BẢN XEM TRƯỚC' },
  { number: '04', title: 'Trùm chương', note: 'Tổng hợp kiến thức trong chương', xp: '+63 XP', status: 'BẢN XEM TRƯỚC' },
];

function formatTime(value: string | null): string {
  if (!value) return 'Chưa kiểm tra';
  return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(value));
}

export default function StagingApp() {
  const [section, setSection] = useState<Section>('overview');
  const [health, setHealth] = useState<StagingHealth | null>(null);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshHealth = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getStagingHealth(signal);
      setHealth(result);
      setCheckedAt(new Date().toISOString());
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return;
      setError(cause instanceof Error ? cause.message : 'Không thể kiểm tra trạng thái API.');
      setHealth(null);
      setCheckedAt(new Date().toISOString());
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refreshHealth(controller.signal);
    return () => controller.abort();
  }, [refreshHealth]);

  const activeTitle = section === 'overview' ? 'Tổng quan' : section === 'quests' ? 'Bản đồ nhiệm vụ' : 'Thư viện bài học';
  const databaseReady = health?.database === 'connected' && health.status === 'ok';

  return (
    <div className="staging-shell">
      <aside className="staging-sidebar">
        <a className="staging-brand" href="#overview" onClick={(event) => { event.preventDefault(); setSection('overview'); }}>
          <span className="staging-brand-mark">HQ</span>
          <span className="staging-brand-copy">HOC TAP <b>QUEST</b><small>LEARNING ADVENTURE</small></span>
        </a>
        <p className="staging-side-label">KHÔNG GIAN HỌC TẬP</p>
        <nav className="staging-nav" aria-label="Điều hướng chính">
          <button className={section === 'overview' ? 'active' : ''} onClick={() => setSection('overview')}><span>⌂</span>Tổng quan</button>
          <button className={section === 'quests' ? 'active' : ''} onClick={() => setSection('quests')}><span>⌘</span>Bản đồ nhiệm vụ</button>
          <button className={section === 'lessons' ? 'active' : ''} onClick={() => setSection('lessons')}><span>▤</span>Bài học <em>XEM</em></button>
        </nav>
        <div className="staging-sidebar-spacer" />
        <div className="staging-side-note"><span className="spark">✧</span><p className="note-label">CHẾ ĐỘ STAGING</p><p>Không gửi câu trả lời, không lưu tiến độ. Chỉ xem giao diện và trạng thái hệ thống.</p><span className="note-orbit">✦</span></div>
        <div className="staging-profile"><span className="staging-avatar">HQ</span><span><b>Khách tham quan</b><small>Chế độ chỉ đọc</small></span><i>●</i></div>
      </aside>

      <main className="staging-main" id="overview">
        <header className="staging-topbar">
          <div className="staging-crumb"><span>HOC TAP QUEST</span><b>/</b>{activeTitle}</div>
          <div className="staging-top-actions"><span className="staging-environment"><i /> STAGING</span><span className="staging-readonly">◉ CHỈ ĐỌC</span></div>
        </header>
        <div className="staging-content">
          <section className="staging-intro">
            <div><p className="staging-eyebrow"><span /> YOUR NEXT CHAPTER STARTS HERE</p><h1>Chào mừng đến<br /><span>cuộc phiêu lưu học tập.</span></h1><p className="staging-intro-copy">Khám phá giao diện HOC TAP QUEST trong môi trường thử nghiệm độc lập.</p></div>
            <div className="staging-level-card"><div className="staging-level-orb">HQ</div><div><small>MÔI TRƯỜNG</small><strong>STAGING <span>↗</span></strong><p>Giao diện xem trước</p></div></div>
          </section>

          <section className="staging-health-card" aria-live="polite">
            <div className="staging-health-icon">{loading ? '◌' : databaseReady ? '✓' : '!'}</div>
            <div className="staging-health-copy"><small>TRẠNG THÁI HỆ THỐNG</small><strong>{loading ? 'Đang kiểm tra API staging…' : error ? 'Không thể kết nối API' : databaseReady ? 'API hoạt động · Database đã kết nối' : 'API phản hồi · Cần kiểm tra trạng thái'}</strong><p>{error ?? (health ? `Dịch vụ ${health.service} · phiên bản ${health.version} · database: ${health.database}` : 'Đang lấy thông tin health từ API staging.')}</p></div>
            <button className="staging-refresh" onClick={() => void refreshHealth()} disabled={loading}>{loading ? 'ĐANG KIỂM TRA' : '↻ KIỂM TRA LẠI'}</button>
            <div className="staging-health-meta">LẦN KIỂM TRA<br /><b>{formatTime(checkedAt)}</b></div>
          </section>

          {section === 'overview' && <>
            <div className="staging-section-heading"><div><p className="staging-section-kicker">YOUR ADVENTURE</p><h2>Hành trình của bạn</h2></div><span className="staging-preview-pill">BẢN XEM TRƯỚC</span></div>
            <section className="staging-stat-grid">
              <article className="staging-stat-card"><span className="stat-symbol purple">✧</span><small>ĐIỂM KINH NGHIỆM</small><strong>— <i>XP</i></strong><p>Không tải dữ liệu cá nhân</p></article>
              <article className="staging-stat-card"><span className="stat-symbol cyan">⌁</span><small>CHUỖI NGÀY HỌC</small><strong>— <i>ngày</i></strong><p>Chỉ hiển thị khi có API đọc phù hợp</p></article>
              <article className="staging-stat-card"><span className="stat-symbol amber">✦</span><small>NHIỆM VỤ HÔM NAY</small><strong>— <i>/ —</i></strong><p>Không tự tạo tiến độ giả</p></article>
            </section>
            <div className="staging-section-heading"><div><p className="staging-section-kicker">CONTINUE EXPLORING</p><h2>Điểm đến nổi bật</h2></div><button className="staging-text-button" onClick={() => setSection('quests')}>Xem bản đồ <span>↗</span></button></div>
            <section className="staging-feature-grid">
              <button className="staging-feature-card feature-quest" onClick={() => setSection('quests')}><span className="feature-glyph">⌘</span><small>01 / QUEST MAP</small><strong>Bản đồ nhiệm vụ</strong><p>Xem các chặng đường và nội dung mẫu.</p><span className="feature-arrow">↗</span></button>
              <button className="staging-feature-card feature-lessons" onClick={() => setSection('lessons')}><span className="feature-glyph">▤</span><small>02 / KNOWLEDGE BASE</small><strong>Thư viện bài học</strong><p>Duyệt các bài học mẫu hiện có.</p><span className="feature-arrow">↗</span></button>
            </section>
          </>}

          {section === 'quests' && <section className="staging-page-panel"><div className="staging-section-heading"><div><p className="staging-section-kicker">QUEST MAP / PREVIEW</p><h2>Bản đồ nhiệm vụ</h2></div><span className="staging-preview-pill">NỘI DUNG MẪU</span></div><div className="staging-quest-list">{quests.map((quest, index) => <article className="staging-quest-row" key={quest.number}><div className={index === 0 ? 'quest-number ready' : 'quest-number'}>{index === 0 ? '✦' : quest.number}</div><div className="quest-row-copy"><small>CHẶNG {quest.number} · {quest.status}</small><strong>{quest.title}</strong><p>{quest.note}</p></div><span className="quest-xp">{quest.xp}</span></article>)}</div><p className="staging-disclaimer">Các chặng trên là nội dung hiển thị mẫu; không đại diện cho trạng thái hoàn thành của tài khoản.</p></section>}

          {section === 'lessons' && <section className="staging-page-panel"><div className="staging-section-heading"><div><p className="staging-section-kicker">KNOWLEDGE BASE / PREVIEW</p><h2>Thư viện bài học</h2></div><span className="staging-preview-pill">{lessons.length} BÀI MẪU</span></div><div className="staging-lesson-grid">{lessons.map((lesson) => <article className="staging-lesson-card" key={lesson.id}><div className="lesson-card-top"><span className="lesson-icon">{lesson.icon}</span><span className="lesson-duration">{lesson.duration}</span></div><small className="lesson-subject">{lesson.subject}</small><h3>{lesson.title}</h3><p className="lesson-level">{lesson.level}</p><div className="lesson-card-footer"><span>{lesson.state}</span><span>↗</span></div></article>)}</div><p className="staging-disclaimer">Chỉ duyệt giao diện. Không mở quiz, gửi câu trả lời hoặc cập nhật tiến độ.</p></section>}

          <footer className="staging-footer"><span>HOC TAP QUEST <b>·</b> STAGING</span><span><i /> READ-ONLY MODE · API HEALTH GET ONLY</span></footer>
        </div>
      </main>
    </div>
  );
}
