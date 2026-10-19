const foundationItems = [
  { number: '01', title: 'React + TypeScript', detail: 'Giao diện theo component, có kiểm tra kiểu dữ liệu.' },
  { number: '02', title: 'Vite development server', detail: 'Khởi động nhanh và hỗ trợ cập nhật giao diện tức thì.' },
  { number: '03', title: 'Responsive design system', detail: 'Nền tảng màu tối tím–cyan cho desktop và mobile.' },
];

function App() {
  return (
    <main className="page-shell">
      <div className="ambient ambient-purple" aria-hidden="true" />
      <div className="ambient ambient-cyan" aria-hidden="true" />

      <header className="topbar">
        <a className="brand" href="/" aria-label="HOC TAP QUEST trang chủ">
          <span className="brand-mark" aria-hidden="true">HQ</span>
          <span className="brand-name">HOC TAP <strong>QUEST</strong></span>
        </a>
        <span className="status-pill"><span className="status-dot" /> PROJECT INITIALIZED</span>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <div className="eyebrow"><span className="eyebrow-line" /> YOUR NEXT LEVEL STARTS HERE</div>
        <h1 id="hero-title">Học tập.<br /><span>Thăng cấp.</span><br />Chinh phục.</h1>
        <p className="hero-copy">
          Mỗi kiến thức là một nhiệm vụ. Mỗi bước tiến là một cấp độ mới.
          Hành trình HOC TAP QUEST bắt đầu từ đây.
        </p>
        <div className="hero-actions">
          <span className="primary-action"><span aria-hidden="true">✦</span> NỀN TẢNG ĐÃ SẴN SÀNG</span>
          <span className="version-label">FOUNDATION / v0.1.0</span>
        </div>
      </section>

      <section className="foundation" aria-labelledby="foundation-title">
        <div className="section-heading">
          <div>
            <p className="section-kicker">PHASE 01 · FOUNDATION</p>
            <h2 id="foundation-title">Khởi đầu vững chắc</h2>
          </div>
          <span className="section-count">03 MODULES</span>
        </div>
        <div className="foundation-grid">
          {foundationItems.map((item) => (
            <article className="foundation-card" key={item.number}>
              <span className="card-number">{item.number}</span>
              <h3>{item.title}</h3>
              <p>{item.detail}</p>
              <span className="card-indicator" aria-hidden="true">↗</span>
            </article>
          ))}
        </div>
      </section>

      <footer className="footer">
        <span>HOC TAP QUEST <span className="footer-muted">· LEARN THROUGH PLAY</span></span>
        <span className="footer-status"><span className="status-dot" /> P1.1 FOUNDATION</span>
      </footer>
    </main>
  );
}

export default App;
