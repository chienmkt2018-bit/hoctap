# HOC TAP QUEST

Nền tảng học tập theo phong cách trò chơi — React + TypeScript + Vite, giao diện responsive nền tối với điểm nhấn tím–cyan.

## Công nghệ

- React 19 + TypeScript + Vite
- Express 5 + TypeScript + MongoDB Atlas (Mongoose)
- JWT bearer token, bcryptjs và giới hạn tần suất đăng nhập
- GitHub Actions kiểm tra TypeScript và build frontend/backend

## Chạy trên Windows

Mở PowerShell tại thư mục dự án:

```powershell
cd frontend
npm install
npm run dev
```

Mở URL Vite hiển thị trong terminal (thường là http://localhost:5173).

Để build frontend:

```powershell
npm run build
```

Backend:

```powershell
cd ..\backend
npm install
npm run typecheck
npm run build
```

Cần Node.js 20.19+ hoặc 22.12+, npm và MongoDB tương thích để chạy API có dữ liệu.

## Bảng theo dõi tiến độ

| Mã | Hạng mục | Trạng thái theo bằng chứng | Ghi chú |
|---|---|---|---|
| P0 | Lập kế hoạch và kiến trúc | Hoàn thành | Lộ trình P0–P6 đã xác định |
| P1.1 | React + Vite + TypeScript và CI | Hoàn thành | Workflow CI đã tồn tại |
| P1.2 | Dashboard và Quest Map | Hoàn thành | Dashboard, XP, nhiệm vụ và bản đồ chặng |
| P2.1 | Danh sách và chi tiết bài học | Hoàn thành | 8 bài học mẫu, bộ lọc và trang chi tiết |
| P2.2 | Quiz tương tác | Hoàn thành | Chọn đáp án, giải thích và tổng kết |
| P2.3 | Kết quả và XP cục bộ | Hoàn thành | XP dựa trên điểm; chống cộng lặp trong phiên/trạng thái local |
| P2.4 | Lưu tiến độ cục bộ | Hoàn thành | localStorage; theo trình duyệt/thiết bị |
| P3.1 | Backend và hợp đồng API | Đã triển khai | Express + TypeScript; OpenAPI được chỉnh lại trong nhánh tài liệu này |
| P3.2 | MongoDB Atlas | Đã xác minh trước đó trên Render | Health từng trả database=connected ngày 2026-10-20; cần kiểm tra lại nếu xác nhận trạng thái hiện tại |
| P3.3 | Xác thực và bảo vệ tiến độ | Đã kiểm thử bởi người dùng trên Render | Đăng ký/đăng nhập, /auth/me và GET/PUT progress đã được xác nhận ngày 2026-10-20 |
| P3.4 | Đăng nhập frontend và đồng bộ tiến độ | Đã hợp nhất; CI #35 được xác nhận thành công | CORS và luồng trình duyệt production vẫn cần kiểm thử thủ công |
| P3.5 | API chấm quiz và XP phía máy chủ | Đã merge; backend production và Health đã xác minh | PR #4 đã merge; Actions run #40 thành công; Render log báo build/khởi động thành công và Health trả `status: ok`, `database: connected` ngày 2026-10-20. Endpoint quiz vẫn cần kiểm thử riêng. |
| P3.6 | Nối giao diện quiz với API server | Chưa hoàn thành | QuizPanel vẫn tự chấm ở frontend; cần gửi câu trả lời tới API khi đăng nhập, xử lý loading/error và giữ chế độ local khi chưa đăng nhập |
| P4 | Gamification mở rộng | Chưa bắt đầu | Thành tựu và nhiệm vụ nâng cao |
| P5 | Kiểm thử và triển khai production | Một phần đã xác minh | Health và kết nối MongoDB đã xác minh ngày 2026-10-20; API quiz và luồng quiz trên trình duyệt production vẫn chưa được kiểm thử end-to-end |
| P6 | AI và học tập thích ứng | Chưa bắt đầu | Sau khi nền tảng ổn định |

## Lưu trữ và tài khoản

- Tiến độ cục bộ dùng khóa `hoc-tap-quest-progress-v1`.
- Token đăng nhập được lưu trong `sessionStorage` của tab, không phải `localStorage`.
- API progress chỉ nhận `completedLessonIds` và `questStatuses`; client không được gửi `totalXp` hoặc `bestXpByLesson` để quyết định XP.
- Khi đăng xuất hoặc API lỗi, dữ liệu cục bộ không bị xóa.

## API và triển khai

- Đặc tả API: [docs/openapi.yaml](docs/openapi.yaml).
- Health endpoint: `GET /api/v1/health`.
- API mặc định của frontend: `https://hoctap-6oeu.onrender.com`; có thể ghi đè bằng `VITE_API_BASE_URL`.
- Render backend cần `MONGODB_URI`, `JWT_SECRET` mạnh (ít nhất 32 bytes) và `CORS_ORIGIN` trùng chính xác origin frontend.
- Không commit mật khẩu, JWT secret, token hoặc URI MongoDB thật.

## Kiểm tra tự động

Theo dõi workflow tại [GitHub Actions](https://github.com/chienmkt2018-bit/hoctap/actions). CI build/type-check không thay thế kiểm thử API hoặc kiểm thử trình duyệt production.

## P3.5 — API chấm quiz phía máy chủ

- `POST /api/v1/quizzes/{quizId}/attempts` yêu cầu JWT.
- Client gửi `attemptId` và lựa chọn của ba câu; không gửi số câu đúng hoặc XP.
- Server tính điểm từ đáp án phía backend, ghi lịch sử vào `QuizAttempt`, cập nhật XP và điểm tốt nhất trong `Progress`.
- Gửi lại cùng `attemptId` cho cùng tài khoản không cộng XP lần hai.
- Lịch sử và tiến độ được cập nhật trong MongoDB transaction; môi trường MongoDB phải hỗ trợ transaction.
- **Bằng chứng production ngày 2026-10-20:** Render build thành công, backend khởi động trên cổng 10000, log xác nhận MongoDB kết nối và Health trả `status: ok`, `database: connected`. Chưa có bằng chứng kiểm thử chức năng endpoint quiz trên production.

## P3.6 — Tích hợp quiz frontend (công việc kế tiếp)

- Khi đã đăng nhập, gửi câu trả lời tới API chấm điểm; hiển thị kết quả máy chủ và cập nhật XP từ phản hồi.
- Khi chưa đăng nhập, giữ chế độ quiz cục bộ để không chặn trải nghiệm hiện tại.
- Không coi XP do frontend tự tính là XP có thẩm quyền của tài khoản.
- Kiểm tra loading, lỗi mạng, token hết hạn, gửi lại yêu cầu và không cộng XP hai lần trước khi đánh dấu hoàn thành.
