# HOC TAP QUEST

Nền tảng học tập theo phong cách trò chơi — React + TypeScript + Vite, giao diện responsive nền tối với điểm nhấn tím–cyan.

## Công nghệ

- React 19 + TypeScript
- Vite 6
- CSS responsive, hỗ trợ reduced motion
- GitHub Actions kiểm tra TypeScript và build frontend

## Yêu cầu

- Node.js 20.19+ hoặc 22.12+
- npm

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
| P2.1 | Danh sách và chi tiết bài học | Hoàn thành | 8 bài mẫu; bộ lọc chủ đề/cấp độ/trạng thái; trang chi tiết; GitHub Actions thành công |
| P2.2 | Quiz tương tác | Hoàn thành | Chọn đáp án, kiểm tra, giải thích đúng/sai, chuyển câu, tổng kết; GitHub Actions thành công |
| P2.3 | Kết quả và XP theo kết quả học | Hoàn thành | Tính XP theo số câu đúng; cộng vào tổng XP và cấp độ; chống nhận XP lặp khi làm lại cùng bài; Actions run #12 thành công |
| P2.4 | Lưu tiến độ học | Hoàn thành | localStorage lưu XP quiz, điểm tốt nhất, bài đã làm và trạng thái nhiệm vụ; Actions run #13 thành công |
| P3 | Backend, API, MongoDB và bảo mật | Chưa bắt đầu | Sau Learning Core |
| P4 | Gamification mở rộng | Chưa bắt đầu | Thành tựu và nhiệm vụ nâng cao |
| P5 | Kiểm thử và triển khai production | Chưa bắt đầu | Kiểm tra chức năng và triển khai |
| P6 | AI và học tập thích ứng | Chưa bắt đầu | Sau khi nền tảng ổn định |

## P2.1 — Thư viện bài học

- 8 bài học mẫu thuộc các chủ đề Tư duy nền tảng, Tiếng Anh, Toán & Logic.
- Lọc theo chủ đề, cấp độ và trạng thái.
- Xem trang chi tiết gồm mô tả, mục tiêu học tập, dàn ý, thời lượng và XP dự kiến.
- Bài khóa không thể mở; nút bắt đầu hiện chỉ là điểm nối giao diện. Quiz, chấm điểm và thưởng XP sẽ được làm ở P2.2–P2.3.
- Dữ liệu hiện là dữ liệu mẫu phía frontend, chưa kết nối tài khoản hoặc cơ sở dữ liệu.

## P2.2 — Quiz tương tác

- Mở quiz từ trang chi tiết của bài học đang mở hoặc đã hoàn thành.
- Luồng học: chọn một phương án → kiểm tra đáp án → xem trạng thái đúng/sai và giải thích → chuyển câu tiếp theo.
- Có thanh tiến độ, khóa lựa chọn sau khi kiểm tra, màn hình tổng kết số câu đúng và nút làm lại.
- Đã có bộ câu hỏi mẫu cho các bài Tư duy nền tảng, Tiếng Anh và Toán & Logic; các bài chưa có bộ riêng dùng bộ câu hỏi dự phòng.
- Dữ liệu câu hỏi hiện nằm trong frontend, chưa lấy từ API/MongoDB. Điểm được tổng kết ở quiz nhưng chưa lưu lịch sử; XP chỉ hiển thị là mức dự kiến và chưa được cộng thực tế (dự kiến P2.3).
- GitHub Actions run #9: build và type-check thành công cho commit `46d3875fc2dfe76402cf8628de8b6faaf3a68403`.

## P2.3 — Kết quả và XP theo kết quả học

- Tổng kết hiển thị số câu đúng, tỷ lệ chính xác và XP thực nhận của lần làm bài.
- XP được tính theo công thức: `round(XP cơ bản của bài × số câu đúng / tổng số câu)`. Bài đạt 0 câu đúng nhận 0 XP; đạt toàn bộ câu hỏi nhận đủ XP cơ bản.
- Mỗi bài chỉ nhận thưởng theo mức XP tương ứng với kết quả tốt nhất trong phiên ứng dụng hiện tại. Nếu làm lại đạt kết quả tốt hơn, chỉ nhận phần XP chênh lệch; kết quả bằng hoặc thấp hơn không cộng XP lần nữa.
- Tổng XP trên Dashboard và thanh tiến độ cấp độ được cập nhật theo XP quiz đã nhận. XP nhiệm vụ hiện có vẫn hoạt động.
- Trạng thái XP và kết quả tốt nhất hiện chỉ giữ trong bộ nhớ phiên ứng dụng; tải lại trang sẽ làm mất dữ liệu. Lưu bền vững thuộc P2.4.
- GitHub Actions run #12: type-check và build thành công cho commit `e13f07dc5b1e9b885e7c58b3bbebb779ac5f1395`.

## P2.4 — Lưu tiến độ học

- Lưu tự động trên trình duyệt bằng `localStorage` với khóa phiên bản `hoc-tap-quest-progress-v1`.
- Sau khi tải lại hoặc mở lại website trong cùng trình duyệt, Dashboard khôi phục trạng thái nhiệm vụ, tổng XP quiz, XP tốt nhất theo từng bài và danh sách bài đã làm.
- Thư viện bài học cập nhật nhãn **Đã hoàn thành** và bộ lọc theo trạng thái từ tiến độ đã lưu; quiz đạt 0 XP vẫn được ghi nhận là đã làm.
- Dữ liệu được kiểm tra cơ bản khi đọc. Nếu JSON hỏng hoặc trình duyệt chặn lưu trữ, ứng dụng dùng trạng thái mặc định; thông báo sẽ xuất hiện nếu không thể ghi dữ liệu.
- Đây là lưu cục bộ theo trình duyệt/thiết bị, chưa đồng bộ giữa thiết bị hoặc tài khoản và có thể mất nếu người dùng xóa dữ liệu website. Đồng bộ máy chủ thuộc giai đoạn P3.
- GitHub Actions run #13: type-check và build thành công cho commit `8df96b76d60601434e4c4677b60bc3d8d944b01c`.

## Kiểm tra tự động

Workflow chạy `npm run build` (TypeScript + Vite) khi có thay đổi trong `frontend/**`. Theo dõi tại [GitHub Actions](https://github.com/chienmkt2018-bit/hoctap/actions).

## Bảo mật

Không lưu thông tin đăng nhập, token hoặc bí mật trong mã nguồn.
