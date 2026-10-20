import { useMemo, useState } from 'react';
import QuizPanel, { type QuizResult } from './QuizPanel';

type LessonStatus = 'completed' | 'available' | 'locked';
type Lesson = {
  id: number; title: string; subject: string; level: string; duration: number; xp: number;
  status: LessonStatus; icon: string; summary: string; objectives: string[]; outline: string[];
};

const lessons: Lesson[] = [
  { id: 1, title: 'Khởi động tư duy', subject: 'Tư duy nền tảng', level: 'Cơ bản', duration: 5, xp: 30, status: 'completed', icon: '✦', summary: 'Làm quen với cách chia một vấn đề lớn thành những bước nhỏ, dễ xử lý.', objectives: ['Nhận diện mục tiêu của một nhiệm vụ', 'Chia vấn đề thành các bước rõ ràng', 'Tự đánh giá điều đã hiểu'], outline: ['Xác định điều cần giải quyết', 'Tách vấn đề thành từng phần', 'Tóm tắt bằng một câu'] },
  { id: 2, title: 'Mở khóa kiến thức', subject: 'Tư duy nền tảng', level: 'Cơ bản', duration: 8, xp: 40, status: 'available', icon: '◈', summary: 'Học cách kết nối thông tin mới với kiến thức đã biết và ghi nhớ bằng ví dụ.', objectives: ['Phân biệt dữ kiện và ý kiến', 'Tạo ví dụ cho khái niệm mới', 'Tóm tắt kiến thức bằng lời của mình'], outline: ['Kết nối kiến thức cũ và mới', 'Phân tích một ví dụ ngắn', 'Viết phần tóm tắt của riêng bạn'] },
  { id: 3, title: 'Thử thách nhanh', subject: 'Tư duy nền tảng', level: 'Trung cấp', duration: 4, xp: 50, status: 'locked', icon: '⚡', summary: 'Ôn tập các khái niệm đã học qua một thử thách ngắn.', objectives: ['Nhận biết khái niệm trọng tâm', 'Áp dụng kiến thức vào tình huống', 'Chuẩn bị cho bài kiểm tra'], outline: ['Ôn tập từ khóa', 'Xem tình huống mẫu', 'Chuẩn bị làm bài luyện tập'] },
  { id: 4, title: 'Trùm chương', subject: 'Tư duy nền tảng', level: 'Nâng cao', duration: 10, xp: 100, status: 'locked', icon: '♜', summary: 'Tổng hợp kiến thức trong chương và chuẩn bị cho bài đánh giá cuối chương.', objectives: ['Kết nối các ý chính', 'Giải thích cách áp dụng', 'Tự kiểm tra mức độ sẵn sàng'], outline: ['Sơ đồ hóa kiến thức', 'Phân tích tình huống tổng hợp', 'Tổng kết chương'] },
  { id: 5, title: 'Từ vựng mỗi ngày', subject: 'Tiếng Anh', level: 'Cơ bản', duration: 6, xp: 35, status: 'available', icon: 'Aa', summary: 'Xây dựng thói quen học từ vựng theo ngữ cảnh và ví dụ thực tế.', objectives: ['Nhận biết từ trong ngữ cảnh', 'Liên hệ từ với ví dụ', 'Ôn tập bằng cách tự nhớ lại'], outline: ['Chọn nhóm từ theo chủ đề', 'Đọc ví dụ ngắn', 'Tự đặt câu'] },
  { id: 6, title: 'Đọc hiểu có chiến lược', subject: 'Tiếng Anh', level: 'Trung cấp', duration: 9, xp: 55, status: 'locked', icon: '⌕', summary: 'Luyện tìm ý chính, từ khóa và thông tin hỗ trợ trong một đoạn văn.', objectives: ['Tìm ý chính', 'Nhận diện từ khóa', 'Phân biệt ý chính và chi tiết'], outline: ['Đọc lướt để nắm chủ đề', 'Đánh dấu từ khóa', 'Đối chiếu chi tiết với ý chính'] },
  { id: 7, title: 'Logic từng bước', subject: 'Toán & Logic', level: 'Cơ bản', duration: 7, xp: 40, status: 'available', icon: '∑', summary: 'Luyện phân tích dữ kiện và sắp xếp các bước giải quyết theo trình tự.', objectives: ['Xác định dữ kiện đã cho', 'Sắp xếp các bước hợp lý', 'Kiểm tra lại kết quả'], outline: ['Đọc kỹ yêu cầu', 'Lập trình tự giải quyết', 'Kiểm tra tính hợp lý'] },
  { id: 8, title: 'Giải quyết vấn đề', subject: 'Toán & Logic', level: 'Nâng cao', duration: 12, xp: 75, status: 'locked', icon: '⌘', summary: 'Áp dụng tư duy có cấu trúc vào một tình huống nhiều bước.', objectives: ['Phân tích các điều kiện', 'So sánh phương án', 'Giải thích lựa chọn'], outline: ['Phân rã tình huống', 'Đánh giá các phương án', 'Trình bày lập luận'] }
];

const statusLabels: Record<LessonStatus, string> = { completed: 'Đã hoàn thành', available: 'Có thể học', locked: 'Chưa mở khóa' };
type Props = { onNotice: (message: string) => void; onQuizComplete: (result: QuizResult) => number };

export default function LessonLibrary({ onNotice, onQuizComplete }: Props) {
  const [subject, setSubject] = useState('Tất cả');
  const [level, setLevel] = useState('Tất cả');
  const [status, setStatus] = useState('Tất cả');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [quizStarted, setQuizStarted] = useState(false);
  const subjects = ['Tất cả', ...Array.from(new Set(lessons.map((lesson) => lesson.subject)))];
  const levels = ['Tất cả', ...Array.from(new Set(lessons.map((lesson) => lesson.level)))];
  const filteredLessons = useMemo(() => lessons.filter((lesson) =>
    (subject === 'Tất cả' || lesson.subject === subject) &&
    (level === 'Tất cả' || lesson.level === level) &&
    (status === 'Tất cả' || statusLabels[lesson.status] === status)
  ), [subject, level, status]);
  const selectedLesson = lessons.find((lesson) => lesson.id === selectedId) ?? null;
  if (selectedId !== null && !selectedLesson) setSelectedId(null);
  const availableCount = lessons.filter((lesson) => lesson.status === 'available').length;
  const completedCount = lessons.filter((lesson) => lesson.status === 'completed').length;

  function selectLesson(lesson: Lesson) {
    if (lesson.status === 'locked') { onNotice('Bài học này đang khóa. Hãy hoàn thành các chặng đang mở trước nhé.'); return; }
    setSelectedId(lesson.id); onNotice('');
  }

  return (
    <section className="lesson-library" aria-label="Thư viện bài học">
      <div className="lesson-library-heading">
        <div><p className="section-kicker">LEARNING LIBRARY · P2.1</p><h2>{quizStarted ? 'Đang luyện tập' : selectedLesson ? 'Chi tiết bài học' : 'Khám phá bài học'}</h2><p className="section-description">{quizStarted ? 'Trả lời từng câu, kiểm tra và đọc giải thích trước khi tiếp tục.' : selectedLesson ? 'Xem mục tiêu và nội dung dự kiến trước khi bắt đầu.' : 'Chọn chủ đề, cấp độ và trạng thái phù hợp với hành trình của bạn.'}</p></div>
        {selectedLesson && <button className="text-button" type="button" onClick={() => { if (quizStarted) setQuizStarted(false); else setSelectedId(null); }}>← {quizStarted ? 'Quay lại chi tiết bài học' : 'Quay lại danh sách'}</button>}
      </div>
      {quizStarted && selectedLesson ? <QuizPanel lessonId={selectedLesson.id} lessonTitle={selectedLesson.title} lessonXp={selectedLesson.xp} onBack={() => setQuizStarted(false)} onQuizComplete={onQuizComplete} /> : !selectedLesson ? <>
        <div className="lesson-summary-grid">
          <article><span className="lesson-summary-icon">▤</span><span><strong>{lessons.length}</strong><small>Tổng bài học mẫu</small></span></article>
          <article><span className="lesson-summary-icon">◈</span><span><strong>{availableCount}</strong><small>Có thể bắt đầu</small></span></article>
          <article><span className="lesson-summary-icon">✓</span><span><strong>{completedCount}</strong><small>Đã hoàn thành</small></span></article>
        </div>
        <div className="lesson-filters" aria-label="Bộ lọc bài học">
          <label>Chủ đề<select value={subject} onChange={(event) => setSubject(event.target.value)}>{subjects.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>Cấp độ<select value={level} onChange={(event) => setLevel(event.target.value)}>{levels.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>Trạng thái<select value={status} onChange={(event) => setStatus(event.target.value)}>{['Tất cả', ...Object.values(statusLabels)].map((item) => <option key={item}>{item}</option>)}</select></label>
          <button className="reset-filters" type="button" onClick={() => { setSubject('Tất cả'); setLevel('Tất cả'); setStatus('Tất cả'); }}>Xóa lọc</button>
        </div>
        <div className="lesson-results-line"><span>{filteredLessons.length} bài học phù hợp</span><span>CHƯƠNG 01 · KHỞI NGUYÊN TRI THỨC</span></div>
        {filteredLessons.length > 0 ? <div className="lesson-catalog">
          {filteredLessons.map((lesson) => <article className={`lesson-card lesson-card-${lesson.status}`} key={lesson.id}>
            <div className="lesson-card-top"><span className="lesson-card-icon">{lesson.icon}</span><span className={`lesson-status status-${lesson.status}`}>{statusLabels[lesson.status]}</span></div>
            <span className="lesson-subject">{lesson.subject} · {lesson.level}</span><h3>{lesson.title}</h3><p>{lesson.summary}</p>
            <div className="lesson-card-meta"><span>◷ {lesson.duration} phút</span><span>✧ {lesson.xp} XP</span></div>
            <button className={lesson.status === 'locked' ? 'lesson-action lesson-action-disabled' : 'lesson-action'} type="button" onClick={() => selectLesson(lesson)}>{lesson.status === 'locked' ? 'Đang khóa' : lesson.status === 'completed' ? 'Xem lại bài học' : 'Xem chi tiết'} <span>↗</span></button>
          </article>)}
        </div> : <div className="lesson-empty"><span>⌕</span><strong>Không tìm thấy bài học</strong><p>Thử thay đổi bộ lọc để xem các bài học khác.</p><button className="text-button" type="button" onClick={() => { setSubject('Tất cả'); setLevel('Tất cả'); setStatus('Tất cả'); }}>Hiển thị tất cả bài học</button></div>}
      </> : <div className="lesson-detail">
        <div className="lesson-detail-hero"><span className="lesson-card-icon">{selectedLesson.icon}</span><div><span className="lesson-subject">{selectedLesson.subject} · {selectedLesson.level}</span><h3>{selectedLesson.title}</h3><p>{selectedLesson.summary}</p><div className="lesson-card-meta"><span>◷ {selectedLesson.duration} phút</span><span>✧ {selectedLesson.xp} XP</span><span className={`lesson-status status-${selectedLesson.status}`}>{statusLabels[selectedLesson.status]}</span></div></div></div>
        <div className="lesson-detail-columns">
          <section className="lesson-detail-block"><p className="section-kicker">LEARNING OBJECTIVES</p><h4>Sau bài học, bạn có thể</h4><ul>{selectedLesson.objectives.map((objective) => <li key={objective}><span>✓</span>{objective}</li>)}</ul></section>
          <section className="lesson-detail-block"><p className="section-kicker">LESSON OUTLINE</p><h4>Nội dung dự kiến</h4><ol>{selectedLesson.outline.map((item, index) => <li key={item}><span>{String(index + 1).padStart(2, '0')}</span>{item}</li>)}</ol></section>
        </div>
        <div className="lesson-detail-footer"><p>Bắt đầu quiz gồm các câu hỏi trắc nghiệm. Sau mỗi câu, hãy kiểm tra đáp án và đọc giải thích trước khi chuyển tiếp. XP theo kết quả sẽ được xử lý ở P2.3.</p><button className="primary-button" type="button" onClick={() => { setQuizStarted(true); onNotice(''); }}>Bắt đầu quiz <span>→</span></button></div>
      </div>}
    </section>
  );
}
