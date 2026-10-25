import { useRef, useState } from 'react';
import { readAccessToken, submitQuizAttempt } from './auth';
import { calculateDisplayQuizXp, type QuizDifficulty } from './xp';

type Question = {
  prompt: string;
  options: string[];
  answer: number;
  explanation: string;
};

export type QuizResult = {
  lessonId: number;
  lessonTitle: string;
  correctCount: number;
  totalQuestions: number;
  percentage: number;
  calculatedXp: number;
  serverAwardedXp?: number;
  serverBonusXpAwarded?: number;
  serverTotalXp?: number;
};

type Props = {
  lessonId: number;
  lessonTitle: string;
  isFirstValidCompletion: boolean;
  onBack: () => void;
  onQuizComplete: (result: QuizResult) => number;
};

const questionBank: Record<number, Question[]> = {
  1: [
    { prompt: 'Khi gặp một nhiệm vụ lớn, bước đầu tiên hữu ích nhất là gì?', options: ['Làm tất cả cùng lúc', 'Xác định mục tiêu cần đạt', 'Bỏ qua phần khó'], answer: 1, explanation: 'Xác định mục tiêu giúp bạn biết kết quả cần đạt trước khi chia nhiệm vụ thành các bước nhỏ.' },
    { prompt: 'Vì sao nên chia vấn đề thành các phần nhỏ?', options: ['Để dễ xử lý và theo dõi tiến độ', 'Để có thêm nhiều việc hơn', 'Để không cần kiểm tra kết quả'], answer: 0, explanation: 'Các phần nhỏ giúp công việc rõ ràng, dễ thực hiện và dễ kiểm tra hơn.' },
    { prompt: 'Sau khi hoàn thành một bước, bạn nên làm gì?', options: ['Luôn chuyển tiếp mà không xem lại', 'Đổi mục tiêu ngay lập tức', 'Kiểm tra kết quả rồi tiếp tục'], answer: 2, explanation: 'Kiểm tra từng bước giúp phát hiện sai sót sớm và bảo đảm tiến độ đi đúng hướng.' },
  ],
  2: [
    { prompt: 'Cách nào giúp kết nối kiến thức mới với kiến thức đã biết?', options: ['Học thuộc mà không suy nghĩ', 'Tạo một ví dụ liên quan', 'Bỏ qua khái niệm chưa quen'], answer: 1, explanation: 'Ví dụ liên quan giúp biến khái niệm trừu tượng thành điều dễ hiểu và dễ nhớ.' },
    { prompt: 'Đâu là cách tóm tắt kiến thức hiệu quả?', options: ['Chép nguyên văn toàn bộ', 'Chỉ ghi tiêu đề', 'Diễn đạt ý chính bằng lời của mình'], answer: 2, explanation: 'Diễn đạt bằng lời của mình giúp kiểm tra xem bạn thực sự hiểu nội dung hay chưa.' },
    { prompt: 'Khi đọc một thông tin, điều gì cần phân biệt?', options: ['Dữ kiện và ý kiến', 'Chữ dài và chữ ngắn', 'Tiêu đề và màu nền'], answer: 0, explanation: 'Dữ kiện có thể kiểm chứng; ý kiến thể hiện nhận định hoặc đánh giá của người nói.' },
  ],
  5: [
    { prompt: 'Cách học từ vựng nào giúp hiểu cách dùng từ tốt hơn?', options: ['Chỉ nhìn danh sách từ', 'Học từ trong câu và ngữ cảnh', 'Bỏ qua ví dụ'], answer: 1, explanation: 'Ngữ cảnh và câu ví dụ cho thấy nghĩa cũng như cách sử dụng từ trong tình huống thực tế.' },
    { prompt: 'Sau khi học một từ mới, bạn nên làm gì để ôn tập?', options: ['Tự nhớ lại và đặt câu', 'Không xem lại từ đó', 'Chỉ đọc tiêu đề bài'], answer: 0, explanation: 'Tự nhớ lại và tự đặt câu giúp củng cố khả năng ghi nhớ và sử dụng từ.' },
    { prompt: 'Nếu quên nghĩa của một từ, lựa chọn nào hợp lý?', options: ['Đoán rồi không kiểm tra', 'Dừng học hoàn toàn', 'Xem lại ngữ cảnh, kiểm tra nghĩa rồi thử lại'], answer: 2, explanation: 'Kết hợp ngữ cảnh với việc kiểm tra nghĩa giúp sửa hiểu nhầm và học chính xác hơn.' },
  ],
  7: [
    { prompt: 'Khi giải quyết bài toán, điều gì nên làm trước?', options: ['Chọn đáp án ngẫu nhiên', 'Xác định dữ kiện và yêu cầu', 'Bỏ qua điều kiện đề bài'], answer: 1, explanation: 'Nắm dữ kiện và yêu cầu là nền tảng để chọn phương pháp giải phù hợp.' },
    { prompt: 'Vì sao cần sắp xếp các bước giải theo trình tự?', options: ['Để lập luận rõ ràng và có thể kiểm tra', 'Để làm bài dài hơn', 'Để tránh đọc lại đề'], answer: 0, explanation: 'Một trình tự hợp lý giúp theo dõi lập luận và phát hiện bước sai dễ dàng hơn.' },
    { prompt: 'Sau khi có kết quả, bạn nên làm gì?', options: ['Chấp nhận ngay mọi kết quả', 'Xóa các bước đã làm', 'Đối chiếu kết quả với dữ kiện và yêu cầu'], answer: 2, explanation: 'Đối chiếu kết quả với đề bài giúp xác nhận đáp án có hợp lý và trả lời đúng yêu cầu hay không.' },
  ],
};

const fallbackQuestions: Question[] = [
  { prompt: 'Bước nào giúp bắt đầu học một chủ đề mới hiệu quả?', options: ['Xác định mục tiêu học tập', 'Bỏ qua hướng dẫn', 'Chọn câu trả lời ngẫu nhiên'], answer: 0, explanation: 'Mục tiêu rõ ràng giúp bạn tập trung vào điều cần hiểu và biết khi nào đã đạt yêu cầu.' },
  { prompt: 'Điều gì giúp kiểm tra mức độ hiểu bài?', options: ['Chỉ đọc tiêu đề', 'Tự giải thích bằng lời của mình', 'Bỏ qua ví dụ'], answer: 1, explanation: 'Tự giải thích buộc bạn tổ chức lại kiến thức và nhận ra phần chưa hiểu.' },
  { prompt: 'Sau khi trả lời một câu hỏi, cách nào giúp tiến bộ?', options: ['Không xem phản hồi', 'Luôn giữ nguyên suy đoán', 'Đọc giải thích và rút kinh nghiệm'], answer: 2, explanation: 'Phản hồi cho biết lý do đúng hoặc sai, giúp điều chỉnh cách hiểu trước câu tiếp theo.' },
];

export default function QuizPanel({ lessonId, lessonTitle, isFirstValidCompletion, onBack, onQuizComplete }: Props) {
  const questions = questionBank[lessonId] ?? fallbackQuestions;
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isChecked, setIsChecked] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);
  const [awardedXp, setAwardedXp] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [serverScored, setServerScored] = useState(false);
  const completionHandled = useRef(false);
  const attemptIdRef = useRef<string | null>(null);
  const answersRef = useRef<Record<string, number>>({});
  const serverSubmissionRequired = useRef(false);

  const question = questions[questionIndex];

  function checkAnswer() {
    if (selectedOption === null || isChecked) return;
    answersRef.current[`q${questionIndex + 1}`] = selectedOption;
    if (selectedOption === question.answer) setCorrectCount((count) => count + 1);
    setIsChecked(true);
  }

  async function finishQuiz() {
    if (completionHandled.current || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError('');
    const percentage = Math.round((correctCount / questions.length) * 100);
    const difficulty: QuizDifficulty = [4, 8].includes(lessonId) ? 'hard' : [3, 6].includes(lessonId) ? 'medium' : 'easy';
    const calculatedXp = calculateDisplayQuizXp(difficulty, percentage, isFirstValidCompletion);
    const localResult: QuizResult = { lessonId, lessonTitle, correctCount, totalQuestions: questions.length, percentage, calculatedXp };

    try {
      const token = readAccessToken();
      if (token) serverSubmissionRequired.current = true;
      if (serverSubmissionRequired.current && !token) {
        throw new Error('Phiên đăng nhập không còn hợp lệ. Hãy đăng nhập lại rồi gửi lại kết quả; XP chưa được ghi nhận ở chế độ cục bộ.');
      }
      if (token) {
        const attemptId = attemptIdRef.current ?? crypto.randomUUID().replace(/-/g, '');
        attemptIdRef.current = attemptId;
        const answers = questions.map((_, index) => ({
          questionId: `q${index + 1}`,
          selectedOptionId: String(answersRef.current[`q${index + 1}`] ?? 0),
        }));
        const serverResult = await submitQuizAttempt(token, lessonId, attemptId, answers);
        setCorrectCount(serverResult.correctCount);
        const awarded = onQuizComplete({
          ...localResult,
          correctCount: serverResult.correctCount,
          percentage: serverResult.percentage,
          calculatedXp: calculateDisplayQuizXp(difficulty, serverResult.percentage, isFirstValidCompletion),
          serverAwardedXp: serverResult.replayed ? 0 : serverResult.xpAwarded,
          serverBonusXpAwarded: serverResult.replayed ? 0 : serverResult.bonusXpAwarded,
          serverTotalXp: serverResult.totalXp,
        });
        setAwardedXp(awarded);
        setServerScored(true);
      } else {
        setAwardedXp(onQuizComplete(localResult));
        setServerScored(false);
      }
      completionHandled.current = true;
      setFinished(true);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Không thể gửi kết quả quiz. Hãy thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function nextQuestion() {
    if (!isChecked) return;
    if (questionIndex === questions.length - 1) {
      finishQuiz();
      return;
    }
    setQuestionIndex((index) => index + 1);
    setSelectedOption(null);
    setIsChecked(false);
  }

  function retryQuiz() {
    setQuestionIndex(0);
    setSelectedOption(null);
    setIsChecked(false);
    setCorrectCount(0);
    setAwardedXp(0);
    setSubmitError('');
    setServerScored(false);
    attemptIdRef.current = null;
    answersRef.current = {};
    serverSubmissionRequired.current = false;
    completionHandled.current = false;
    setFinished(false);
  }

  if (finished) {
    const percentage = Math.round((correctCount / questions.length) * 100);
    return (
      <section className="quiz-panel quiz-results" aria-live="polite">
        <div className="quiz-topline"><span className="section-kicker">P2.3 · KẾT QUẢ LUYỆN TẬP</span><span className="quiz-count">{questions.length}/{questions.length} câu</span></div>
        <div className="quiz-result-orb"><span>{percentage}%</span><small>CHÍNH XÁC</small></div>
        <h3>{percentage >= 80 ? 'Làm tốt lắm!' : percentage >= 50 ? 'Bạn đang tiến bộ!' : 'Hãy thử lại nhé!'}</h3>
        <p className="quiz-result-copy">Bạn trả lời đúng <strong>{correctCount}/{questions.length}</strong> câu trong bài “{lessonTitle}”. Hãy xem lại phần giải thích để củng cố kiến thức.</p>
        <div className="quiz-result-stats"><div><span>Đúng</span><strong>{correctCount}/{questions.length}</strong></div><div><span>Độ chính xác</span><strong>{percentage}%</strong></div><div><span>XP nhận lần này</span><strong>+{awardedXp}</strong></div></div>
        <p className="quiz-note">{serverScored ? 'Kết quả và XP đã được máy chủ xác nhận, lưu vào tài khoản. Gửi lại cùng một lượt làm không cộng XP lần hai.' : 'Chế độ cục bộ: XP được tính theo số câu đúng và lưu trên trình duyệt. Đăng nhập để lưu kết quả quiz vào tài khoản.'}</p>
        <div className="quiz-actions"><button className="secondary-button" type="button" onClick={onBack}>← Quay lại bài học</button><button className="primary-button" type="button" onClick={retryQuiz}>Làm lại quiz <span>↻</span></button></div>
      </section>
    );
  }

  return (
    <section className="quiz-panel" aria-labelledby="quiz-question-title">
      <div className="quiz-topline"><span className="section-kicker">QUIZ TƯƠNG TÁC · P2.3</span><span className="quiz-count">CÂU {questionIndex + 1}/{questions.length}</span></div>
      <div className="quiz-progress" aria-label={`Tiến độ câu hỏi ${questionIndex + 1} trên ${questions.length}`}><span style={{ width: `${((questionIndex + 1) / questions.length) * 100}%` }} /></div>
      <div className="quiz-context"><span className="lesson-card-icon">✦</span><div><span className="lesson-subject">BÀI HỌC</span><h3>{lessonTitle}</h3></div></div>
      <h2 id="quiz-question-title">{question.prompt}</h2>
      <div className="quiz-options" role="group" aria-label="Các phương án trả lời">
        {question.options.map((option, index) => {
          const isCorrectOption = index === question.answer;
          const isSelected = selectedOption === index;
          const stateClass = isChecked && isCorrectOption ? ' quiz-option-correct' : isChecked && isSelected && !isCorrectOption ? ' quiz-option-wrong' : isSelected ? ' quiz-option-selected' : '';
          return <button key={option} className={`quiz-option${stateClass}`} type="button" disabled={isChecked} aria-pressed={isSelected} onClick={() => setSelectedOption(index)}><span className="quiz-option-letter">{String.fromCharCode(65 + index)}</span><span>{option}</span>{isChecked && isCorrectOption && <strong aria-label="Đáp án đúng">✓</strong>}{isChecked && isSelected && !isCorrectOption && <strong aria-label="Đáp án đã chọn">×</strong>}</button>;
        })}
      </div>
      {isChecked && <div className={`quiz-feedback ${selectedOption === question.answer ? 'feedback-correct' : 'feedback-wrong'}`} role="status"><strong>{selectedOption === question.answer ? 'Chính xác!' : 'Chưa chính xác.'}</strong><p>{question.explanation}</p></div>}
      {submitError && <div className="quiz-feedback feedback-wrong" role="alert"><strong>Chưa lưu được kết quả.</strong><p>{submitError} Tiến độ cục bộ vẫn được giữ; hãy gửi lại để máy chủ ghi nhận XP.</p></div>}
      <div className="quiz-actions">
        <button className="secondary-button" type="button" onClick={onBack}>← Quay lại bài học</button>
        {!isChecked ? <button className="primary-button" type="button" disabled={selectedOption === null} onClick={checkAnswer}>Kiểm tra đáp án <span>✓</span></button> : <button className="primary-button" type="button" disabled={isSubmitting} onClick={questionIndex === questions.length - 1 ? finishQuiz : nextQuestion}>{isSubmitting ? 'Đang lưu kết quả…' : submitError && questionIndex === questions.length - 1 ? 'Gửi lại kết quả' : questionIndex === questions.length - 1 ? 'Xem kết quả' : 'Câu tiếp theo'} <span>→</span></button>}
      </div>
    </section>
  );
}
