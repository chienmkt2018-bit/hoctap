# HOC TAP QUEST

**HOC TAP QUEST** là nền tảng học tập theo phong cách trò chơi, giúp người học theo dõi bài học, nhiệm vụ, XP, thành tích và chuỗi ngày học.

- Frontend: React 19, TypeScript, Vite.
- Backend: Node.js, Express 5, TypeScript.
- Database: MongoDB Atlas, Mongoose.
- Hosting: Render.
- Source control và CI/QA: GitHub, GitHub Actions, Playwright.
- Giao diện: responsive, nền tối với điểm nhấn tím–cyan.

> Tài liệu này mô tả **repository ứng dụng** `chienmkt2018-bit/hoctap`. Hệ thống GitHub Gateway nằm trong repository riêng `chienmkt2018-bit/hoctap-github-gateway`; Gateway không phải backend API phục vụ người học.

## 1. Tổng quan kiến trúc

```text
Người học
   |
   v
Render Frontend (React + Vite)
   |
   | HTTPS; Bearer JWT khi đăng nhập
   v
Render Backend API (Express)
   |
   | Mongoose
   v
MongoDB Atlas


Người vận hành / GitHub Actions
   |
   v
HOC TAP QUEST GitHub Gateway (repository riêng, Render service riêng)
   |
   | GitHub App installation authentication
   v
GitHub API
   |
   v
chienmkt2018-bit/hoctap
```

### Trách nhiệm từng thành phần

| Thành phần | Trách nhiệm |
|---|---|
| Frontend | Dashboard, Quest Map, danh sách/chi tiết bài học, quiz, XP và trạng thái học tập |
| Backend API | Đăng ký/đăng nhập, xác thực JWT, đọc/lưu tiến độ, chấm quiz và tính XP có thẩm quyền |
| MongoDB Atlas | Lưu tài khoản, tiến độ, lần làm quiz và sổ ghi nhận phần thưởng |
| GitHub Actions | Build/type-check và chạy các workflow QA được cấu hình |
| Playwright | Kiểm thử luồng trình duyệt theo phạm vi của từng workflow |
| GitHub Gateway | Lớp automation giới hạn để thao tác GitHub; không xử lý request học tập và không thay thế Backend API |
| Render | Host frontend, backend API và Gateway ở các service độc lập |

Tài liệu kiến trúc/vận hành chi tiết của Gateway được duy trì trong [README Gateway](https://github.com/chienmkt2018-bit/hoctap-github-gateway#readme).

## 2. Repository, branch và môi trường

### Repository ứng dụng

- GitHub: [chienmkt2018-bit/hoctap](https://github.com/chienmkt2018-bit/hoctap)
- `main`: nhánh production.
- `staging`: nhánh tích hợp staging.
- `test/playwright-readonly-staging`: nhánh QA được dùng cho workflow kiểm thử staging/QA theo cấu hình tương ứng.
- Các nhánh `feat/*`, `fix/*`, `docs/*`, `test/*`: nhánh công việc theo phạm vi; phải kiểm tra PR và workflow tham chiếu trước khi sử dụng hoặc dọn dẹp.

**Lưu ý về phân kỳ branch:** tại lần rà soát ngày 04/11/2026, `staging` và `main` đã phân kỳ (compare ghi nhận staging ahead 12, behind 5 so với main). Không mặc định README hoặc mã nguồn ở hai nhánh giống nhau. Trước khi tạo PR, chọn đúng base và kiểm tra diff/commit của cả hai nhánh.

### URL dịch vụ đã được ghi nhận

| Môi trường | Frontend | Backend API |
|---|---|---|
| Production | https://hoctap-frontend.onrender.com | https://hoctap-6oeu.onrender.com |
| Staging | https://hoctap-staging-frontend.onrender.com | https://hoctap-staging-api.onrender.com |

Health endpoint:

- Production: [https://hoctap-6oeu.onrender.com/api/v1/health](https://hoctap-6oeu.onrender.com/api/v1/health)
- Staging: [https://hoctap-staging-api.onrender.com/api/v1/health](https://hoctap-staging-api.onrender.com/api/v1/health)

URL là thông tin định danh môi trường đã được ghi nhận, không phải cam kết dịch vụ đang hoạt động tại mọi thời điểm. Khi xác minh deploy, đối chiếu Render service, branch, deployed commit SHA, log và health response.

### Render service mapping đã được ghi nhận

| Service | Loại | Repository / branch | Root |
|---|---|---|---|
| Production frontend | Static Site | `hoctap` / `main` | `frontend/` |
| Production API | Web Service | `hoctap` / `main` | `backend/` |
| Staging frontend | Static Site | `hoctap` / `staging` | `frontend/` |
| Staging API | Web Service | `hoctap` / `staging` | `backend/` |

Cấu hình Render có thể thay đổi độc lập với repository. Luôn kiểm tra Settings/Events/Deploys trên Render trước khi thao tác. Không tự ý đổi branch, build command, publish directory, environment variables hoặc deploy.

## 3. Cấu trúc mã nguồn

| Đường dẫn | Vai trò |
|---|---|
| `frontend/` | Ứng dụng React/Vite |
| `frontend/src/` | Component, trang, logic giao diện và trạng thái |
| `frontend/public/` | Tài nguyên tĩnh, favicon |
| `backend/` | Backend API Express/TypeScript |
| `backend/src/` | Server, routes, models, middleware và nghiệp vụ |
| `backend/test/` | Unit/integration tests phía backend |
| `docs/openapi.yaml` | Hợp đồng API OpenAPI 3.1 |
| `.github/workflows/` | GitHub Actions workflows |

Các package scripts được khai báo tại `frontend/package.json` và `backend/package.json`. Không giả định một script hoặc workflow tồn tại nếu chưa kiểm tra file tương ứng ở branch đang làm việc.

## 4. Chức năng sản phẩm

Các nhóm chức năng chính:

1. **Dashboard:** tổng quan tiến độ và hoạt động học.
2. **Quest Map:** điều hướng hành trình/chặng học.
3. **Lessons:** danh sách, bộ lọc và trang chi tiết bài học.
4. **Quiz:** câu hỏi, lựa chọn, giải thích và kết quả.
5. **Progress:** bài học hoàn thành, trạng thái nhiệm vụ và dữ liệu theo tài khoản.
6. **Gamification:** XP, cấp độ, thành tích, nhiệm vụ ngày và learning streak.

Không coi một mục roadmap là hoàn tất chỉ vì component đã tồn tại. Trạng thái hoàn tất phải dựa trên code đã hợp nhất và bằng chứng kiểm thử phù hợp.

## 5. Backend API

Đặc tả chính thức: [docs/openapi.yaml](docs/openapi.yaml).

Base path: `/api/v1`.

| Method | Endpoint | Mục đích | Xác thực |
|---|---|---|---|
| GET | `/health` | Trạng thái API/database | Không |
| POST | `/auth/register` | Tạo tài khoản | Không |
| POST | `/auth/login` | Đăng nhập | Không |
| GET | `/auth/me` | Lấy tài khoản hiện tại | Bearer JWT |
| GET | `/progress` | Đọc tiến độ tài khoản | Bearer JWT |
| PUT | `/progress` | Cập nhật trường tiến độ được phép | Bearer JWT |
| POST | `/quizzes/{quizId}/attempts` | Gửi lần làm quiz và nhận kết quả do server chấm | Bearer JWT |

Luôn đối chiếu OpenAPI và source backend để xác nhận schema/status code trước khi tích hợp hoặc thay đổi API.

### Quy tắc bảo mật và dữ liệu

- Mật khẩu được băm bằng `bcryptjs`; API dùng JWT bearer token.
- Endpoint nhạy cảm phải xác thực và kiểm tra quyền sở hữu dữ liệu ở server.
- Frontend giữ access token trong `sessionStorage` theo triển khai đã ghi nhận; không ghi token vào log hoặc tài liệu.
- Backend kiểm tra dữ liệu đầu vào; không tin điểm, XP hoặc quyền sở hữu do client tự khai báo.
- API progress không cho client quyết định `totalXp` hoặc `bestXpByLesson`.
- Không đưa password, JWT secret, MongoDB URI, GitHub App private key, token hoặc cookie vào repository.
- CORS phải giới hạn đúng origin frontend theo cấu hình môi trường; không mở rộng tùy tiện để xử lý lỗi tích hợp.

### Quiz API: idempotency và tính nhất quán

- Quiz có đăng nhập được gửi tới `POST /api/v1/quizzes/{quizId}/attempts`.
- Request có `attemptId` và các lựa chọn đáp án; server tự chấm theo đáp án phía backend.
- Client không gửi số câu đúng hoặc XP có thẩm quyền.
- Gửi lại cùng `attemptId` của cùng tài khoản với cùng payload phải trả kết quả đã xử lý, không cộng XP lần hai.
- Dùng lại `attemptId` với payload khác phải bị từ chối theo hợp đồng/triển khai idempotency hiện hành.
- Ghi QuizAttempt, Progress và RewardLedger liên quan phải tuân thủ transaction/unique index trong môi trường MongoDB hỗ trợ transaction.
- Kiểm thử ghi dữ liệu chỉ được thực hiện trên database test cô lập với dữ liệu giả và phạm vi được phê duyệt.

## 6. XP, progress và learning streak

- XP và điểm quiz có thẩm quyền do backend quyết định đối với tài khoản đã đăng nhập.
- Trạng thái local/guest được lưu trên thiết bị; không tự động xem dữ liệu guest là dữ liệu tài khoản.
- Khóa lưu tiến độ cục bộ đã ghi nhận: `hoc-tap-quest-progress-v1`. Không đổi/xóa khóa nếu chưa có kế hoạch migration và kiểm tra tương thích dữ liệu cũ.
- Token đăng nhập không được lưu chung với tiến độ học tập.
- Learning dates của tài khoản phải xuất phát từ hoạt động quiz hợp lệ phía server; không nhận danh sách ngày tùy ý từ client.
- Không tạo lịch sử streak giả hoặc cộng XP thưởng hồi tố khi chưa có thiết kế, migration và kiểm thử được phê duyệt.
- Công thức XP v1.0 từng được đề xuất trong branch feature; không xem đề xuất ở branch chưa hợp nhất là quy tắc production. Kiểm tra code trên branch triển khai trước khi mô tả công thức đang chạy.

## 7. Cấu hình và biến môi trường

### Frontend

| Biến | Mục đích |
|---|---|
| `VITE_API_BASE_URL` | Ghi đè API base URL mặc định |

Frontend có thể dùng API production mặc định nếu không cấu hình biến ghi đè; staging cần xác minh build command/environment để bảo đảm gọi đúng staging API.

### Backend

| Biến | Mục đích |
|---|---|
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Khóa ký JWT đủ mạnh |
| `CORS_ORIGIN` | Origin frontend được phép gọi API |
| `PORT` | Cổng do môi trường hosting cấp (nếu cấu hình runtime yêu cầu) |

Tên biến trên là các cấu hình đã được tài liệu/source ghi nhận; hãy kiểm tra backend config hiện tại trước khi thêm hoặc đổi biến. Chỉ lưu giá trị bí mật trong Render Environment, không ghi giá trị vào README.

MongoDB staging đã được ghi nhận ở cluster `hoctap2`, database `test`. Không suy luận production dùng cùng cluster/database. Cần kiểm tra Render environment và Atlas bằng quyền được cấp trước khi kết luận mapping thực tế.

## 8. Phát triển và kiểm tra

### Package scripts

Các script hiện được khai báo:

**Frontend** — `frontend/package.json`

- `dev`: chạy Vite development server.
- `build`: TypeScript build/check và Vite production build.
- `preview`: xem thử bản build.
- `typecheck`: kiểm tra TypeScript.

**Backend** — `backend/package.json`

- `dev`: chạy Express server ở chế độ watch.
- `build`: biên dịch TypeScript.
- `start`: chạy server đã build.
- `typecheck`: kiểm tra TypeScript.
- `test`: chạy các test được liệt kê trong script, bao gồm integration tests.

Môi trường integration test cần MongoDB phù hợp với transaction/replica set theo yêu cầu của test. Không chạy integration test có ghi dữ liệu trên database production.

### CI và QA

- GitHub Actions: [repository Actions](https://github.com/chienmkt2018-bit/hoctap/actions).
- OpenAPI: `docs/openapi.yaml`.
- Browser automation: Playwright.
- Kiểm tra frontend/backend build không thay thế API integration hoặc E2E browser tests.
- Mỗi test report cần ghi Test ID, môi trường/URL, điều kiện ban đầu, bước thao tác, expected, actual, trạng thái và bằng chứng.

### Nguyên tắc QA

**Read-only là mặc định.** Khi kiểm tra staging/production trên trình duyệt:

- Chỉ thực hiện các thao tác GET, HEAD, OPTIONS theo guard của workflow.
- Không tạo tài khoản, đăng nhập bằng tài khoản thật hoặc thay đổi mật khẩu.
- Không gửi quiz/attempt, không ghi progress, XP, streak, achievement hoặc reward.
- Không sửa/xóa dữ liệu database.
- Không đưa token, cookie, mật khẩu hoặc dữ liệu cá nhân vào artifact/báo cáo.

Phân loại kết quả:

- **PASS:** đã thực hiện và quan sát đúng kết quả mong đợi, có bằng chứng.
- **FAIL:** có bằng chứng về kết quả sai hoặc lỗi tái hiện được.
- **BLOCKED:** thiếu quyền, môi trường, công cụ hoặc bằng chứng.
- Không suy luận PASS từ việc trang tải thành công.
- Chỉ báo cáo Console, Network hoặc database đã kiểm tra khi công cụ cung cấp bằng chứng tương ứng.

### Bằng chứng QA đã được ghi nhận

Các kết quả sau được ghi trong sổ tay vận hành Gateway ngày 04/11/2026; đây là kết quả của đúng workflow/run và phạm vi nêu dưới đây, không phải xác nhận mọi chức năng đã được kiểm thử:

| Hạng mục | Run / SHA | Kết quả được ghi nhận | Giới hạn |
|---|---|---|---|
| Staging read-only E2E | Run #34; SHA `1fc3c974029789605802aeedfc2c709967ec4f86` | 15 PASS, 0 FAIL | Luồng staging được kiểm tra; staging frontend có harness riêng, không chứng minh toàn bộ UI production |
| Quiz API idempotency/concurrency | Run #8; QA SHA `4645f30d2604a75b3f7d2b22ed4a9f9a8fd81b25` | Workflow success; integration test chạy trên MongoDB 7.0 replica set ephemeral | Không phải kiểm thử trên MongoDB Atlas production |
| Production read-only Playwright | Run ID `41621599091`; SHA `35f578e0c1571687c65945a0a3f4349f75e94f7a` | 10 PASS, 0 FAIL | Chỉ frontend load, lesson navigation/lock và mobile viewport; không kiểm thử luồng ghi |

Link workflow/run cần tra cứu tại tab Actions của repository và đối chiếu SHA/artifact. Artifact có thời hạn lưu; không coi artifact cũ là bằng chứng còn tồn tại nếu chưa kiểm tra.

## 9. Roadmap và trạng thái xác minh

Bảng dưới đây là snapshot định hướng theo thông tin dự án được ghi nhận đến 04/11/2026. Trạng thái phải được cập nhật sau khi kiểm tra branch, PR, CI và môi trường tương ứng.

| Mã | Hạng mục | Trạng thái ghi nhận | Điều kiện/ghi chú |
|---|---|---|---|
| P0 | Kiến trúc và kế hoạch | Hoàn thành | Kiến trúc frontend/backend/database và roadmap đã hình thành |
| P1 | Nền tảng, Dashboard, Quest Map | Đã triển khai | Cần regression theo từng thay đổi UI |
| P2 | Lesson, Quiz, kết quả và local progress | Đã triển khai | Cần tiếp tục kiểm tra hồi quy |
| P3 | Backend, auth, progress, quiz API | Đã triển khai nhiều phần | API contract và server-authoritative XP; tiếp tục xác minh integration trên môi trường được phép |
| P4 | Gamification | Đã triển khai nhiều phần | Thành tựu, daily quests, streak và đồng bộ tài khoản phải theo dõi riêng; không mặc định mọi phần đã PASS end-to-end |
| P5 | QA, idempotency, concurrency và production verification | Đang xác minh theo từng phạm vi | Có bằng chứng staging read-only, test API cô lập và production read-only; không đồng nghĩa mọi luồng production đã được xác minh |
| P5.4 | Production E2E mở rộng | Chưa kết luận hoàn tất | Chỉ mở rộng khi xác định test scope, môi trường, quyền, guard read-only hoặc database test cô lập và bằng chứng cần thu thập |
| P6 | AI và học tập thích ứng | Chưa bắt đầu | Chỉ triển khai sau khi nền tảng và dữ liệu được ổn định |

### Điều kiện trước khi mở rộng QA production

1. Xác minh commit SHA đang deploy trên production frontend và backend.
2. Xác định rõ test case, expected result và dữ liệu được phép quan sát.
3. Ưu tiên browser QA read-only; không gửi quiz hoặc ghi dữ liệu học tập.
4. Nếu cần test API có ghi, chỉ dùng database test cô lập, tài khoản giả và phê duyệt rõ ràng.
5. Có Playwright/browser, quyền truy cập và artifact/log phù hợp.
6. Báo cáo PASS/FAIL/BLOCKED theo bằng chứng; không suy rộng kết quả từ một test case.

## 10. Quy trình thay đổi và phát hành

1. **Khảo sát:** kiểm tra repository, branch, commit, PR, workflow, package scripts và file liên quan.
2. **Tách phạm vi:** tạo branch riêng từ base đã xác minh; tránh sửa trực tiếp branch Render đang theo dõi.
3. **Thực hiện:** thay đổi nhỏ nhất cần thiết; không sửa secrets hoặc dữ liệu ngoài phạm vi.
4. **Review:** kiểm tra diff, dependency, API contract và rủi ro bảo mật.
5. **CI/QA:** chạy đúng workflow được phép; đọc log và artifact, không chỉ dựa vào trạng thái dispatch.
6. **PR:** mô tả mục tiêu, file thay đổi, bằng chứng test, rủi ro và rollback.
7. **Merge/deploy:** chỉ thực hiện khi được phê duyệt; sau merge kiểm tra deployed SHA, Render logs và health.
8. **Bàn giao:** cập nhật README/operating notes khi branch, API, workflow, service hoặc chính sách thay đổi.

Không tự ý commit/push, merge, xóa branch, thay đổi Render service, đổi secrets, deploy production hoặc thao tác ghi/xóa database khi chưa được cho phép.

## 11. Xử lý sự cố

| Triệu chứng | Hướng kiểm tra |
|---|---|
| Frontend không tải | Render service state, deployed SHA, publish directory, asset và browser Network |
| API health lỗi | Render deploy/runtime log, port, environment và MongoDB connection state |
| CORS/preflight lỗi | Origin chính xác, cấu hình CORS và OPTIONS response |
| API trả 401 | JWT/session flow; không ghi token vào log |
| API trả 403 | Kiểm tra authorization/ownership phía server |
| Quiz retry có kết quả bất thường | attemptId, payload fingerprint, idempotency record và transaction trong database test |
| MongoDB transaction lỗi | Cluster topology/transaction support, session và transaction log |
| GitHub Actions thất bại | Workflow YAML, ref, permissions, job log và artifact |
| Staging khác production | So sánh branch, commit SHA, build config, environment và harness |

Không vô hiệu hóa authentication, authorization, CORS, rate limit hoặc test guard để che giấu lỗi.

## 12. Checklist bảo trì

- [ ] Xác minh đúng repository, branch, commit SHA và PR trước khi sửa.
- [ ] Kiểm tra mapping Render và deployed SHA cho đúng môi trường.
- [ ] Kiểm tra frontend gọi đúng API base URL.
- [ ] Đối chiếu API implementation với `docs/openapi.yaml`.
- [ ] Kiểm tra auth, authorization và ownership ở server.
- [ ] Kiểm tra idempotency/concurrency trên database test cô lập.
- [ ] Xác minh read-only guard trước browser QA.
- [ ] Đọc workflow logs và lưu evidence có thời hạn phù hợp.
- [ ] Không để secret/token/cookie trong repository, log hoặc artifact.
- [ ] Cập nhật README khi kiến trúc, API, branch, Render mapping hoặc QA policy thay đổi.

## 13. Tài liệu và liên kết

- [Repository ứng dụng](https://github.com/chienmkt2018-bit/hoctap)
- [GitHub Actions](https://github.com/chienmkt2018-bit/hoctap/actions)
- [API OpenAPI contract](docs/openapi.yaml)
- [HOC TAP QUEST GitHub Gateway và sổ tay vận hành](https://github.com/chienmkt2018-bit/hoctap-github-gateway#readme)
- [Production frontend](https://hoctap-frontend.onrender.com)
- [Production API health](https://hoctap-6oeu.onrender.com/api/v1/health)
- [Staging frontend](https://hoctap-staging-frontend.onrender.com)
- [Staging API health](https://hoctap-staging-api.onrender.com/api/v1/health)

---

**Nguyên tắc vận hành:** kiểm tra hiện trạng trước khi hành động; chỉ kết luận dựa trên bằng chứng; read-only là mặc định; khi thiếu quyền hoặc bằng chứng, ghi BLOCKED và dừng tại đó.
