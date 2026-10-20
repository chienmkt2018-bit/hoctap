# HOC TAP QUEST

Nền tảng học tập theo phong cách trò chơi — React + TypeScript + Vite, giao diện responsive nền tối với điểm nhấn tím–cyan.

## Công nghệ

- React 19 + TypeScript + Vite
- Express 5 + TypeScript + MongoDB Atlas (Mongoose)
- JWT bearer token, băm mật khẩu bằng bcryptjs, giới hạn tần suất đăng nhập
- GitHub Actions kiểm tra TypeScript và build frontend/backend

## Yêu cầu

- Node.js 20.19+ hoặc 22.12+
- npm
- MongoDB Atlas hoặc MongoDB tương thích để chạy các API dữ liệu

## Chạy trên Windows

Mở PowerShell tại thư mục dự án:

```powershell
cd frontend
npm install
npm run dev
```

Mở URL Vite hiển thị trong terminal (thường là http://localhost:5173).

## Kiểm tra bản build

```powershell
cd frontend
npm run build
npm run preview
```

## Bảng theo dõi tiến độ

| Mã | Hạng mục | Trạng thái | Ghi chú |
|---|---|---|---|
| P0 | Lập kế hoạch và kiến trúc | Hoàn thành | Đã xác định lộ trình P0–P6 |
| P1.1 | Khởi tạo React + Vite + TypeScript và CI | Hoàn thành | Workflow Frontend build |
| P1.2 | Dashboard và Quest Map | Hoàn thành | Dashboard, XP, chuỗi ngày học, nhiệm vụ và bản đồ chặng |
| P2.1 | Danh sách và chi tiết bài học | Hoàn thành | 8 bài mẫu; bộ lọc chủ đề/cấp độ/trạng thái; trang chi tiết |
| P2.2 | Quiz tương tác | Hoàn thành | Chọn đáp án, kiểm tra, giải thích đúng/sai, chuyển câu và tổng kết |
| P2.3 | Kết quả và XP theo kết quả học | Hoàn thành | Tính XP theo số câu đúng; cộng XP; chống nhận XP lặp khi làm lại cùng bài |
| P2.4 | Lưu tiến độ học | Hoàn thành | localStorage lưu XP quiz, điểm tốt nhất, bài đã làm và trạng thái nhiệm vụ |
| P3.1 | Thiết kế backend và API | Hoàn thành | Express + TypeScript, OpenAPI và health endpoint; Actions run #16 thành công |
| P3.2 | Kết nối MongoDB Atlas | Hoàn thành xác minh kết nối | Render health endpoint trả `status: ok`, `database: connected` ngày 2026-10-20; chưa có API quiz server-authoritative |
| P3.3 | Xác thực, phân quyền và bảo vệ tiến độ | CI thành công; chờ kiểm thử Render | GitHub Actions run #25 thành công cho frontend và backend; PR #1 đang chờ hợp nhất và cấu hình `JWT_SECRET` trên Render |
| P4 | Gamification mở rộng | Chưa bắt đầu | Thành tựu và nhiệm vụ nâng cao |
| P5 | Kiểm thử và triển khai production | Đang triển khai từng phần | Backend hiện có trên Render; cần kiểm thử xác thực sau khi cấu hình JWT_SECRET |
| P6 | AI và học tập thích ứng | Chưa bắt đầu | Sau khi nền tảng ổn định |

## P2.4 — Lưu tiến độ học

- Lưu tự động trên trình duyệt bằng `localStorage` với khóa `hoc-tap-quest-progress-v1`.
- Dashboard khôi phục nhiệm vụ, XP quiz, XP tốt nhất theo từng bài và danh sách bài đã làm sau khi tải lại trang.
- Dữ liệu được kiểm tra cơ bản khi đọc. Nếu JSON hỏng hoặc trình duyệt chặn lưu trữ, ứng dụng dùng trạng thái mặc định.
- Đây là lưu cục bộ theo trình duyệt/thiết bị, chưa tự đồng bộ tài khoản hoặc thiết bị. Frontend chưa bị thay đổi trong P3.3.

## P3.1 — Backend và hợp đồng API

- Express + TypeScript với `GET /api/v1/health`, Helmet, CORS theo `CORS_ORIGIN`, giới hạn JSON body 100 KB và phản hồi lỗi JSON.
- Đặc tả OpenAPI nằm tại `docs/openapi.yaml`. Các endpoint `/lessons` và `/quizzes/{quizId}/attempts` vẫn là thiết kế, chưa được triển khai.
- GitHub Actions build/type-check frontend và backend khi có thay đổi trong thư mục tương ứng hoặc OpenAPI.

## P3.2 — Kết nối MongoDB Atlas

- Mongoose được cấu hình qua biến môi trường `MONGODB_URI`; model `Progress` lưu tiến độ theo một `learnerId` duy nhất.
- `GET /api/v1/health` phản ánh trạng thái database và không tiết lộ URI hoặc thông tin xác thực.
- **Xác minh production:** Render log báo `Connected to MongoDB.` và endpoint health trả `{"status":"ok","service":"hoc-tap-quest-api","version":"0.2.0","database":"connected"}` (trước khi nâng phiên bản backend lên 0.3.0) ngày 2026-10-20.
- URI MongoDB thật chỉ được lưu trong Render Environment hoặc tệp `.env` cục bộ; tuyệt đối không commit lên GitHub.

## P3.3 — Xác thực và bảo vệ tiến độ (đang chờ CI)

- `POST /api/v1/auth/register`: tạo tài khoản bằng email và mật khẩu; mật khẩu được băm bằng bcryptjs, không lưu dạng văn bản thuần.
- `POST /api/v1/auth/login`: kiểm tra thông tin đăng nhập và cấp JWT bearer token có thời hạn 1 giờ.
- `GET /api/v1/auth/me`: trả thông tin tài khoản của token hợp lệ.
- `GET /api/v1/progress` và `PUT /api/v1/progress`: chỉ thao tác tiến độ của người dùng được xác định từ token đã xác minh; client không thể chọn `learnerId` khác.
- Xác thực có giới hạn tần suất 10 lần/15 phút trên mỗi IP. Token được kiểm tra issuer, audience và thời hạn.
- API cập nhật tiến độ chỉ nhận danh sách bài hoàn thành và trạng thái nhiệm vụ; không nhận `totalXp` hoặc `bestXpByLesson` từ client. XP có thẩm quyền cần được tính bởi endpoint nộp quiz phía server trong bước tiếp theo.
- Cần thêm biến môi trường `JWT_SECRET` (tối thiểu 32 byte ngẫu nhiên) trên Render trước khi dùng đăng ký/đăng nhập. Tạo giá trị an toàn bằng lệnh:
  ```powershell
  node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
  ```
  Dán kết quả trực tiếp vào Render → Environment; không gửi token/secret vào chat hoặc commit vào repository.
- **CI:** GitHub Actions run #25 thành công cho cả hai job frontend và backend sau khi sửa lỗi TypeScript phát hiện ở run #24.
- **Chưa hoàn tất:** cần hợp nhất thay đổi đã kiểm tra, thêm `JWT_SECRET` vào Render Environment và kiểm thử đăng ký/đăng nhập, token không hợp lệ, đọc/ghi tiến độ trong môi trường triển khai.

## Kiểm tra tự động

Theo dõi workflow tại [GitHub Actions](https://github.com/chienmkt2018-bit/hoctap/actions).

## Bảo mật

Không lưu thông tin đăng nhập, token, JWT secret hoặc URI cơ sở dữ liệu thật trong mã nguồn.
