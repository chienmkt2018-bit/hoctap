# HOC TAP QUEST

**HOC TAP QUEST — Learn Through Play.**  
Nền tảng học tập dạng phiêu lưu nhập vai (Fantasy RPG), xây dựng bằng React, TypeScript và Vite ở frontend; Node.js, Express và MongoDB Atlas ở backend.

> **Mục tiêu thiết kế giao diện:** tái tạo trải nghiệm trong concept Fantasy Adventure được người dùng cung cấp — không phải chỉ đổi màu giao diện hiện tại, không phải tự do sáng tác một phong cách fantasy khác.

## 1. Design North Star — chuẩn thiết kế bắt buộc

Khi xem xét, thiết kế, viết code, tạo asset hoặc kiểm thử giao diện HOC TAP QUEST, hãy đọc phần này trước.

### 1.1 Concept tham chiếu

Người dùng đã chọn một concept gồm hai bố cục đặt cạnh nhau:

- **Mobile:** giao diện dọc trong khung điện thoại; thương hiệu và hồ sơ ở đầu trang; banner chương dạng giấy da; bản đồ nhiệm vụ fantasy; nhân vật đồng hành; các điểm nhiệm vụ trên đường dẫn phát sáng; nút bắt đầu nhiệm vụ màu vàng; thanh điều hướng dưới.
- **Desktop:** sidebar điều hướng bên trái; bản đồ thế giới chiếm vùng trung tâm; hồ sơ người chơi phía trên; banner chương nằm trên bản đồ; nhân vật và tuyến nhiệm vụ; thẻ nhiệm vụ hôm nay bên phải; các thẻ XP, streak, gems và thành tựu ở phần dưới.

**Ảnh concept gốc:** người dùng sẽ tải ảnh tham chiếu lên repository GitHub. Khi ảnh được tải lên:
1. Tìm đúng file ảnh đã tải trong repository và ghi đường dẫn thực tế tại đây.
2. Dùng ảnh đó làm chuẩn đối chiếu trực quan chính (visual source of truth).
3. Không tự suy đoán tên file hoặc đường dẫn khi chưa kiểm tra repository.

**Đường dẫn concept trong repository:** [`frontend/concept.png`](frontend/concept.png)  
**GitHub:** https://github.com/chienmkt2018-bit/hoctap/blob/feat/fantasy-game-assets-v1/frontend/concept.png  
**Trạng thái:** Đã xác nhận file tồn tại trên nhánh `feat/fantasy-game-assets-v1`. Đây là ảnh concept gốc được dùng làm chuẩn đối chiếu trực quan.

Ảnh concept là chuẩn về bố cục, phong cách và cảm nhận thị giác; không có nghĩa mọi chi tiết minh họa trong ảnh phải được ghép thành một ảnh nền duy nhất. Ưu tiên UI React/CSS thực, asset 2D có thể tái sử dụng và thành phần responsive.

### 1.2 Ngôn ngữ hình ảnh

| Thành phần | Chuẩn định hướng |
|---|---|
| Thế giới | Fantasy adventure: lâu đài, đảo bay, núi đá, rừng, thung lũng và bầu trời huyền ảo |
| Nền chính | Midnight navy, xanh đêm và tím sâu |
| Ánh sáng | Cyan/electric blue, điểm sáng ma thuật và đường dẫn nhiệm vụ |
| Phần thưởng | Vàng kim, ánh kim và đá quý |
| Bảng nội dung | Khung fantasy có chiều sâu; giấy da/parchment cho banner chương |
| Nhân vật | Chibi/cartoon 2D, thân thiện, nhất quán giữa các màn hình |
| Biểu tượng | Huy hiệu, cúp, khiên, đá quý, ngọn lửa, khóa và biểu tượng nhiệm vụ |
| Trạng thái | Mở, đang hoạt động, hoàn thành và khóa phải phân biệt rõ bằng hình ảnh lẫn nhãn |

### 1.3 Bản đồ nhiệm vụ là trọng tâm

Bản đồ không được biến thành một danh sách card thông thường đặt trên nền gradient. Cần thể hiện được:

- Một thế giới có chiều sâu và địa hình, không phải nền màu phẳng.
- Tuyến đường nhiệm vụ nối các điểm theo thứ tự tiến trình.
- Nhiệm vụ mở/đang hoạt động/đã hoàn thành/đang khóa có trạng thái riêng.
- Phần thưởng và XP gắn với từng điểm nhiệm vụ.
- Nhân vật đồng hành có vị trí rõ ràng trên thế giới và không che nội dung tương tác.
- CTA nhiệm vụ hiện tại nổi bật, dễ nhận biết.

### 1.4 Responsive theo đúng tinh thần concept

**Mobile**
- Ưu tiên bố cục dọc, bản đồ là nội dung chính.
- Thông tin người chơi và chương được tổ chức gọn ở phía trên.
- Nhiệm vụ, nhân vật và CTA không chồng lấn hoặc bị cắt.
- Điều hướng chính ở cạnh dưới theo concept.
- Vùng chạm đủ lớn; nội dung quan trọng không phụ thuộc hover.

**Desktop**
- Sidebar trái dành cho điều hướng.
- Bản đồ chiếm phần lớn không gian làm việc.
- Thông tin người chơi ở phía trên; nhiệm vụ hôm nay và thông tin phụ ở vùng bên phải/dưới.
- XP, streak, gems và thành tựu được trình bày thành các khu vực riêng, có phân cấp thị giác.

### 1.5 Những cách làm không đạt mục tiêu

Không coi các phương án sau là hoàn thành concept:

- Chỉ đổi màu tím/cyan, bo góc và thêm glow lên giao diện Practice Hub cũ.
- Dùng một ảnh fantasy bất kỳ không khớp bố cục, ánh sáng hoặc chủ đề của concept.
- Dùng ảnh chụp toàn bộ giao diện làm nền thay cho UI thật.
- Dùng asset có phong cách không đồng nhất (3D, pixel art, realistic và chibi trộn lẫn tùy tiện).
- Để nhân vật, banner, nhiệm vụ hoặc hiệu ứng che chữ và nút.
- Chỉ kiểm tra desktop hoặc chỉ kiểm tra mobile.
- Tự thay đổi nội dung, quy tắc XP, trạng thái nhiệm vụ hoặc dữ liệu học tập để làm ảnh demo đẹp hơn.

## 2. Checklist nghiệm thu giao diện

Một thay đổi giao diện chỉ được đánh giá đạt khi có bằng chứng cho các mục phù hợp:

- [ ] Bố cục tổng thể bám concept tham chiếu trên cả mobile và desktop.
- [ ] Bản đồ thế giới là trọng tâm, có địa hình, tuyến đường và điểm nhiệm vụ.
- [ ] Nhân vật đồng hành có phong cách nhất quán và vị trí hợp lý.
- [ ] Banner chương, nhiệm vụ, khóa, phần thưởng và CTA có phân cấp rõ.
- [ ] Bảng màu, ánh sáng, khung fantasy và icon nhất quán.
- [ ] Không có ảnh vỡ, asset thiếu, chữ tràn, phần tử chồng lấn hoặc vùng bị cắt.
- [ ] Điều hướng, trạng thái khóa/mở và các CTA phản ánh đúng logic hiện có.
- [ ] Kiểm tra tối thiểu viewport mobile 390×844 và các viewport desktop phù hợp.
- [ ] Kiểm tra keyboard focus, vùng chạm và reduced motion.
- [ ] Không phát sinh request ghi dữ liệu ngoài hành vi đã được cho phép.
- [ ] Build/type-check và các kiểm thử liên quan thành công.

**Báo cáo kiểm tra phải phân biệt rõ:** PASS (có bằng chứng), FAIL (có lỗi/bằng chứng), BLOCKED (thiếu môi trường, dữ liệu hoặc quyền). Không kết luận đạt chỉ dựa vào build thành công hoặc một ảnh chụp màn hình.

## 3. Nguyên tắc bảo toàn sản phẩm

Đây là dự án học tập có dữ liệu và nghiệp vụ thật. Làm mới giao diện không phải lý do để viết lại hoặc làm sai nghiệp vụ.

- Giữ nguyên luồng đăng nhập, xác thực, bài học, quiz, tiến độ, XP, streak, gems, thành tựu và API trừ khi có yêu cầu riêng.
- Không để client tự quyết định XP có thẩm quyền; XP và phần thưởng phía tài khoản phải theo quy tắc server hiện có.
- Không tạo dữ liệu học tập, lịch sử quiz, streak hoặc phần thưởng giả để phục vụ demo.
- Không xóa hoặc thay đổi dữ liệu người dùng, schema, khóa lưu trữ hay hợp đồng API trong một nhiệm vụ UI.
- Không đưa secret, token, mật khẩu hoặc MongoDB URI thật vào repository.
- Không gộp thay đổi thiết kế với thay đổi backend không liên quan.

## 4. Quy trình làm việc với concept và assets

1. Kiểm tra nhánh, trạng thái repository, README và các tài liệu thiết kế trước khi sửa.
2. Tìm ảnh concept gốc người dùng đã tải lên; xác minh đúng file và cập nhật đường dẫn ở mục 1.1.
3. Phân rã concept thành layout, component, design tokens, nhân vật, background, icon và hiệu ứng.
4. Kiểm tra asset hiện có trước khi tạo asset mới; tránh tạo nhiều hình ảnh trùng chức năng hoặc khác phong cách.
5. Ưu tiên tài nguyên có thể quản lý bằng GitHub và công cụ miễn phí. Không yêu cầu quy trình local/PowerShell hoặc dịch vụ trả phí nếu người dùng chưa thay đổi ràng buộc.
6. Triển khai theo từng phần nhỏ, giữ thay đổi trong đúng nhánh được cho phép.
7. Chạy build và kiểm thử responsive/interaction; lưu artifact và bằng chứng khi workflow hỗ trợ.
8. Đối chiếu kết quả với ảnh concept gốc, không chỉ đối chiếu với phiên bản giao diện ngay trước đó.
9. Báo cáo commit, file thay đổi, workflow/test run, ảnh/artifact, PASS/FAIL/BLOCKED và phần còn thiếu.

### Phạm vi quyền mặc định

- Chỉ thực hiện đúng phạm vi người dùng cho phép.
- Không tự ý merge, deploy, thay đổi production hoặc ghi/xóa dữ liệu MongoDB.
- Không chạy quiz hoặc thao tác làm thay đổi tiến độ học tập trong kiểm thử read-only.
- Nếu cần mở rộng phạm vi, phải hỏi người dùng trước.

## 5. Cấu trúc công nghệ

- **Frontend:** React 19, TypeScript, Vite.
- **Backend:** Node.js, Express 5, TypeScript.
- **Database:** MongoDB Atlas, Mongoose.
- **Authentication:** JWT bearer token và bcryptjs.
- **Automation:** GitHub Actions; kiểm tra type-check, build và Playwright khi workflow tương ứng được cấu hình.

## 6. Cấu trúc repository

- `frontend/` — ứng dụng React/Vite.
- `backend/` — API Express và nghiệp vụ phía máy chủ.
- `docs/` — tài liệu kiến trúc, API và hướng dẫn.
- `tools/` — công cụ hỗ trợ asset/QA.
- `.github/workflows/` — workflow CI và kiểm thử.

Các thư mục và file thực tế có thể thay đổi; luôn kiểm tra repository trước khi giả định đường dẫn.

## 7. Chạy và kiểm tra

Yêu cầu phiên bản Node.js phù hợp với `package.json` và workflow CI của repository.

Frontend:

```bash
cd frontend
npm install
npm run dev
npm run build
```

Backend:

```bash
cd backend
npm install
npm run typecheck
npm run build
npm test
```

Các lệnh trên là hướng dẫn tham khảo; trước khi chạy phải kiểm tra scripts hiện có. Integration test cần môi trường MongoDB hỗ trợ transaction/replica set theo cấu hình test. Không dùng production database cho test.

## 8. Tài liệu và API

- OpenAPI: [docs/openapi.yaml](docs/openapi.yaml) (nếu file tồn tại trên nhánh đang làm việc).
- Health endpoint: `GET /api/v1/health`.
- Frontend API base URL được cấu hình qua `VITE_API_BASE_URL` khi cần.
- Không coi CI build/type-check là bằng chứng cho API hoặc production end-to-end.

## 9. Quy tắc cập nhật README

Mỗi khi concept, asset, nhánh triển khai hoặc tiêu chí nghiệm thu thay đổi:

- Cập nhật đường dẫn ảnh concept thực tế và ghi rõ phiên bản/ngày cập nhật nếu người dùng cung cấp.
- Ghi nhận asset mới, nguồn, giấy phép và vị trí sử dụng.
- Cập nhật checklist nếu người dùng duyệt thay đổi mục tiêu.
- Chỉ ghi trạng thái PASS khi có bằng chứng kiểm tra; nếu không, dùng NOT TESTED hoặc BLOCKED.
- Không ghi một tính năng là đã hoàn thành chỉ vì đã tạo file hoặc merge code.

---

**Ưu tiên cao nhất khi tiếp tục HOC TAP QUEST:** mở README này, tìm ảnh concept gốc trong repository, rồi đánh giá mọi đề xuất và kết quả giao diện theo đúng concept Fantasy Adventure đã được người dùng chọn.
