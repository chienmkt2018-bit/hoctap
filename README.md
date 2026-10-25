# HOC TAP QUEST

Nền tảng học tập theo phong cách trò chơi — React + TypeScript + Vite, giao diện responsive nền tối với điểm nhấn tím–cyan.

## Trạng thái dự án (cập nhật 2026-10-25)

- **Nhánh chính:** `main`.
- **Favicon HOC TAP QUEST:** đã hợp nhất qua [PR #24](https://github.com/chienmkt2018-bit/hoctap/pull/24), merge commit `6ad193b63bb183c527bdf5b3229b464c76690f66`. Thay đổi thêm `frontend/public/favicon.svg` và liên kết favicon trong `frontend/index.html`.
- **CI sau merge:** [GitHub Actions run #94](https://github.com/chienmkt2018-bit/hoctap/actions/runs/40116072778) đã hoàn tất thành công; hai job Frontend và Backend type-check/build đều `success`.
- **Kiểm tra giao diện:** người dùng xác nhận đã kiểm tra và thấy OK. Đây là xác nhận thủ công của người dùng, không phải báo cáo kiểm thử trình duyệt tự động.
- **Giới hạn xác minh:** CI build/type-check không thay thế kiểm thử end-to-end. Chưa coi luồng quiz trên production là đã xác minh chỉ dựa trên CI; trạng thái triển khai Render cần kiểm tra riêng.

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
| P3.5 | API chấm quiz và XP phía máy chủ | Đã hợp nhất; CI thành công; Health production đã xác minh; endpoint quiz chưa kiểm thử riêng | PR #4 đã merge; Actions run #40 thành công; Render Health từng trả `status: ok`, `database: connected` ngày 2026-10-20. Chưa xác minh POST attempts trên production. |
| P3.6 | Nối giao diện quiz với API server | Đã hợp nhất; Actions #47 thành công; production chưa xác minh | PR #8 tích hợp gửi đáp án khi đăng nhập, hiển thị loading/lỗi, giữ chế độ local khi chưa đăng nhập và dùng XP từ phản hồi máy chủ; cần kiểm thử end-to-end sau deploy |
| P4 | Gamification mở rộng | Đang triển khai | Theo dõi riêng trạng thái từng mục P4; không cộng thưởng ngoài hệ XP phía máy chủ |
| P4.1 | Thành tựu dựa trên tiến độ | Hoàn thành trong PR #11; CI #53 thành công | 6 thành tựu suy ra từ tiến độ thực; không thêm API hay schema mới |
| P4.2 | Nhiệm vụ hằng ngày | Đã hợp nhất trong PR #12; CI thành công | 3 nhiệm vụ suy ra từ quiz thực tế; không phát XP thưởng; tiến độ lưu cục bộ |
| P4.3 | Chuỗi ngày học thực tế | Đã hợp nhất trong PR #13; CI thành công | Chỉ ghi ngày khi hoàn thành quiz; không còn số ngày giả lập; ban đầu lưu cục bộ |
| P4.4 | Đồng bộ chuỗi ngày học theo tài khoản | Đang triển khai / cần tiếp tục xác minh | API ghi ngày học khi quiz có xác thực hoàn tất; GET progress trả lịch sử theo tài khoản. Không xem CI build là bằng chứng đồng bộ đa thiết bị đã hoạt động end-to-end. |
| P5 | Kiểm thử và triển khai production | Một phần đã xác minh | CI #94 sau merge favicon: Frontend và Backend type-check/build đều thành công ngày 2026-10-24; người dùng xác nhận giao diện OK. API quiz và luồng quiz trên trình duyệt production vẫn chưa được xác minh end-to-end trong bằng chứng hiện có; trạng thái deploy Render cần kiểm tra riêng. |
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

## P3.6 — Tích hợp quiz frontend (đã hợp nhất; production chưa xác minh)

- PR #8 đã được hợp nhất vào `main`; GitHub Actions run #47 thành công cho type-check/build frontend và backend.
- Khi đã đăng nhập, `QuizPanel` gửi lựa chọn của ba câu và một `attemptId` tới `POST /api/v1/quizzes/:quizId/attempts`; client không gửi số câu đúng hoặc XP có thẩm quyền.
- Điểm, XP cộng thêm và tổng XP quiz tài khoản được lấy từ phản hồi máy chủ; dashboard cộng phần XP nền/nhiệm vụ cục bộ riêng để tránh làm XP hiển thị tụt về 0 khi đăng nhập.
- Điểm tốt nhất từ tiến độ máy chủ được hợp nhất vào trạng thái giao diện; giá trị XP thưởng có thẩm quyền vẫn do API quyết định.
- Khi chưa đăng nhập, quiz tiếp tục dùng chế độ cục bộ.
- Nếu gửi thất bại, giao diện hiển thị lỗi và cho phép gửi lại cùng `attemptId`; nếu token bị từ chối, không âm thầm chuyển lượt đó sang chấm cục bộ.
- **Chưa xác minh production:** chưa có bằng chứng trong lượt làm việc này rằng Render đã triển khai phiên bản frontend mới hoặc luồng quiz đã được thử thành công trên trình duyệt. Cần kiểm tra deploy, CORS, MongoDB transaction, gửi quiz khi đăng nhập, replay cùng attemptId và chế độ local khi đăng xuất.


## P4.2 — Nhiệm vụ hằng ngày (đang triển khai)

- Nhiệm vụ dựa trên kết quả quiz thực tế: hoàn thành một quiz, luyện tập ở hai bài khác nhau và đạt ít nhất 80% ở một quiz trong ngày.
- Tiến độ nhiệm vụ được ghi trong khóa localStorage hiện có `hoc-tap-quest-progress-v1`; dữ liệu tiến độ cũ được giữ và bổ sung trường mới khi lưu lần tiếp theo.
- Bản MVP không cộng XP thưởng từ nhiệm vụ; XP tiếp tục theo quy tắc chấm quiz hiện tại, tránh cộng trùng.
- Tiến độ nhiệm vụ hằng ngày hiện chỉ đồng bộ trên cùng trình duyệt/thiết bị, chưa đồng bộ giữa thiết bị hoặc tài khoản.


## P4.3 — Chuỗi ngày học thực tế (đã hợp nhất)

- Một ngày chỉ được ghi nhận khi người học hoàn thành và nhận được kết quả quiz; mở ứng dụng hoặc xem bài học không làm tăng chuỗi.
- Chuỗi hiện tại được tính từ các ngày có bằng chứng quiz liên tiếp. Nếu hôm nay chưa học, chuỗi vẫn được giữ nếu hôm qua có hoạt động; mất nhịp khi bỏ qua cả hôm nay lẫn hôm qua.
- Lịch ngày trong tuần hiển thị dựa trên lịch sử quiz, không dùng số ngày giả lập.
- Lịch sử streak cục bộ vẫn dùng khóa `hoc-tap-quest-progress-v1`; không xóa hoặc đổi khóa lưu trữ.
- Với tài khoản đã đăng nhập, API chỉ thêm ngày khi một lần quiz được chấm/lưu thành công trong transaction MongoDB; ngày được tính từ thời điểm máy chủ và múi giờ trình duyệt gửi kèm, không nhận danh sách ngày do client tự khai báo.
- `GET /api/v1/progress` trả `learningDates`; frontend hợp nhất ngày tài khoản với lịch sử cục bộ để giữ dữ liệu hiện có. Những ngày quiz ở chế độ khách vẫn chỉ tồn tại trên thiết bị đó và không được tự động đẩy lên tài khoản.
- Không tạo dữ liệu lịch sử giả cho các ngày trước khi tính năng đồng bộ được triển khai. Các ngày cũ chỉ xuất hiện trên tài khoản nếu đã có bằng chứng server-side.

## Sửa lỗi — Nhiệm vụ hàng ngày bị reset khi đăng nhập lại

- Trạng thái nhiệm vụ ngày hiện tại được lưu cùng tiến độ tài khoản trong MongoDB khi máy chủ chấm và lưu quiz thành công.
- Khi tải tiến độ hoặc đăng nhập, frontend hợp nhất hoạt động trong ngày từ tài khoản với dữ liệu cục bộ của cùng ngày; không hợp nhất dữ liệu khác ngày.
- Hoạt động quiz ở chế độ khách vẫn lưu cục bộ và không được tự xác nhận thành dữ liệu máy chủ.
- Nhiệm vụ ngày tự bắt đầu lại khi ngày địa phương đổi; không xóa XP, bài học đã hoàn thành hoặc lịch sử streak.

## P4.4 — Đồng bộ chuỗi ngày học theo tài khoản (đang triển khai)

- Lịch sử ngày học phía tài khoản chỉ được thêm trong cùng transaction lưu quiz đã xác thực; cùng một ngày chỉ xuất hiện một lần dù người học hoàn thành nhiều quiz.
- API không nhận danh sách ngày học từ trình duyệt; client chỉ gửi độ lệch múi giờ hợp lệ để máy chủ xác định ngày lịch địa phương tại thời điểm nhận quiz.
- `GET /api/v1/progress` trả lịch sử `learningDates`, cho phép streak tài khoản hiển thị trên thiết bị khác sau khi đăng nhập.
- Dữ liệu quiz ở chế độ khách không được tự động tải lên tài khoản; không tạo ngày lịch sử giả và không cộng XP thưởng cho streak.


## XP v1.0 — quy tắc đề xuất trong nhánh feature/xp-balance-v1.0

- XP cần để lên cấp tiếp theo: `round(100 × level^1.5)`; XP tổng cũ được giữ nguyên, cấp độ được suy ra lại từ tổng XP.
- XP quiz được tính phía server từ độ khó, tỷ lệ đúng và hệ số 1,2 cho lần hoàn thành hợp lệ đầu tiên; các lần tiếp theo dùng hệ số 1,0.
- XP quiz được lưu theo điểm tốt nhất mỗi bài: chỉ phần XP vượt mức tốt nhất đã ghi nhận mới được cộng.
- Thưởng sự kiện: streak 7/30 ngày +100 XP, hoàn thành chương 1 +200 XP, đủ nhiệm vụ ngày (ít nhất hai bài khác nhau và một kết quả từ 80% trở lên trong cùng ngày) +50 XP.
- `RewardLedger` dùng unique index theo tài khoản và khóa sự kiện; ghi sổ, cập nhật tổng XP và lưu quiz được thực hiện trong cùng MongoDB transaction.
- Không có migration cộng thưởng hồi tố. Các phần thưởng chỉ được xét khi server nhận một quiz hợp lệ mới.
- Các giá trị XP hiển thị trên thẻ bài học là mức tối đa theo độ khó và lần hoàn thành đầu tiên; XP thực tế phụ thuộc kết quả.
- Chạy kiểm thử backend: `npm test` trong thư mục `backend`. Integration test với MongoDB replica set và kiểm thử production vẫn cần chạy riêng trước khi phát hành.
