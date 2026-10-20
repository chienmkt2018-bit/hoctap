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
| P2.1 | Danh sách và chi tiết bài học | Đã triển khai, chờ CI xác nhận | Bộ lọc chủ đề/cấp độ/trạng thái; bài học có trạng thái hoàn thành, có thể học, khóa |
| P2.2 | Quiz tương tác | Chưa bắt đầu | Chấm đáp án và giải thích |
| P2.3 | Kết quả và XP theo kết quả học | Chưa bắt đầu | Không cộng XP chỉ bằng thao tác bấm hoàn thành |
| P2.4 | Lưu tiến độ học | Chưa bắt đầu | Trước mắt lưu trên trình duyệt |
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

## Kiểm tra tự động

Workflow chạy `npm run build` (TypeScript + Vite) khi có thay đổi trong `frontend/**`. Theo dõi tại [GitHub Actions](https://github.com/chienmkt2018-bit/hoctap/actions).

## Bảo mật

Không lưu thông tin đăng nhập, token hoặc bí mật trong mã nguồn.
