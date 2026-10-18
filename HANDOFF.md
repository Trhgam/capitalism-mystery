# Kế hoạch triển khai và tài liệu bàn giao

Tài liệu này dành cho agent tiếp quản dự án **Capitalism Mystery – Guess Adam Smith**. Đọc `README.md`, tài liệu này và chạy bộ kiểm tra trước khi sửa mã.

## 1. Mục tiêu sản phẩm

Xây dựng game lớp học realtime cho 8 thiết bị: 1 Admin và tối đa 7 đội. Cả lớp giải cùng một tranh Adam Smith gồm 12 mảnh. Đúng câu hỏi mở mảnh và nhận token; sai hoặc hết giờ khóa mảnh; đội có token phải đăng ký hàng đợi trước khi được đoán nhân vật.

Các quyết định đã chốt:

- Nhân vật duy nhất: Adam Smith.
- 24 câu hỏi, mỗi câu 4 lựa chọn; 20 giây trả lời.
- Guess Phase thường: 10 giây; sau mảnh thứ 12: 20 giây.
- Chấp nhận `Adam Smith`, `Smith`, `A Smith`, `A. Smith` sau khi chuẩn hóa.
- Gửi dự đoán mới trừ token; Request Guess không trừ token.
- Backend quyết định toàn bộ quyền, timer, kết quả, token và Winner.
- Khi hết lượt đoán cuối mà chưa đúng, trận kết thúc không có Winner.

## 2. Trạng thái hiện tại

### Đã hoàn thành

- Monorepo npm workspaces: `client` và `server`.
- React/Vite responsive UI: Join, Lobby, Game, Guess, Winner và Admin.
- Lobby bám Figma node `1:92` của file `gxfYzaalurU9fGBDsMBugH`; DM Sans, Playfair Display và ba SVG đã được đóng gói local.
- Ảnh Adam Smith của người dùng đã được tối ưu từ khoảng 11 MB xuống khoảng 190 KB và đưa vào `client/public/adam-smith.jpg`.
- Puzzle 12 mảnh với clip-path không đều và ba trạng thái `hidden/revealed/locked`.
- Join tối đa 7 đội, tên duy nhất, session token và resume sau F5.
- Admin login bằng `ADMIN_CODE`.
- State machine server-authoritative.
- Random câu hỏi không lặp; active-team authorization; server timer.
- Chấm đáp án, mở/khóa mảnh, token và điểm.
- Guess Queue, Guess Phase, chuẩn hóa đáp án, trừ token và Winner.
- Chọn đội tiếp theo; Admin Pause/Resume/Reset.
- SQLite snapshot và event log.
- Production server tự phục vụ `client/dist` nếu đã build.
- Unit test game rules và health response.
- `npm audit`: 0 lỗ hổng sau khi nâng Vitest lên 5.0.5.

### Đã xác minh

```text
npm test      → 2 test files, 6 tests passed
npm run build → Vite production build succeeded
npm audit     → 0 vulnerabilities
npm start     → server booted on http://localhost:3000
```

Lưu ý: môi trường sandbox chặn cả loopback localhost (`EACCES`), nên health payload được unit test còn server boot được xác nhận riêng qua log `Capitalism Mystery server: http://localhost:3000`. Agent chạy ngoài sandbox cần gọi thêm `/api/health` và test UI bằng trình duyệt.

## 3. Kiến trúc và luồng dữ liệu

### Backend

`server/src/game/GameService.js` chứa state machine và mọi luật quan trọng. Mỗi thay đổi gọi `commit()` để:

1. Ghi snapshot vào SQLite.
2. Ghi event audit.
3. Phát `changed` để Socket.IO broadcast `game:state`.

`server/src/socket/registerHandlers.js` gắn identity vào từng socket (`teamId` hoặc `isAdmin`) và kiểm tra Zod trước khi gọi service. Không chuyển logic chấm điểm hoặc phân quyền xuống client.

SQLite hiện dùng hai bảng:

- `app_state`: snapshot JSON của trận hiện hành.
- `game_events`: nhật ký append-only phục vụ debug/audit.

Đây là lựa chọn MVP. Khi cần truy vấn báo cáo hoặc nhiều game đồng thời, migrate sang schema quan hệ/Prisma.

### Frontend

`client/src/hooks/useGame.js` là lớp giao tiếp Socket.IO, giữ identity cục bộ và tự gửi `team:resume`/`admin:login` sau reconnect. `game:state` luôn thay thế state phía client; client không tự cộng token hay chuyển phase.

`client/src/pages/LobbyPage.jsx` và nhóm class `.figma-*` trong `client/src/styles.css` là phần chuyển từ Figma node `1:92`. Không thay bằng ảnh screenshot. Các asset chính xác nằm trong `client/public/figma/`; không được đổi lại sang URL Figma tạm thời.

Production dùng `window.location.origin`, vì vậy các máy trong LAN kết nối đúng máy chủ thay vì `localhost` của chính chúng. Dev có thể đặt `VITE_SERVER_URL=http://IP-MAY-CHU:3000` khi test nhiều máy với Vite.

## 4. Event contract

| Event | Ai gửi | Payload | Điều kiện |
|---|---|---|---|
| `game:get-state` | mọi client | `{}` | đọc state |
| `team:join` | team | `{name}` | phase LOBBY, dưới 7 đội, tên duy nhất |
| `team:resume` | team | `{token}` | token hợp lệ |
| `admin:login` | admin | `{code}` | trùng `ADMIN_CODE` |
| `game:start` | admin | `{}` | LOBBY, có ít nhất 1 đội |
| `question:select` | active team | `{}` | SELECT_QUESTION |
| `question:answer` | active team | `{optionIndex}` | ANSWERING, trước deadline |
| `guess:request` | team | `{}` | ANSWERING/ANSWER_RESULT, có token, chưa queue |
| `guess:submit` | queued team | `{answer}` | GUESS_PHASE, còn token, chưa submit |
| `turn:select-next` | active team/admin | `{teamId}` | SELECT_NEXT_TEAM |
| `game:pause` | admin | `{}` | phase đang chạy |
| `game:resume` | admin | `{}` | PAUSED |
| `game:reset` | admin | `{}` | mọi phase |

Mọi event dùng acknowledgement dạng `{ok: true, ...}` hoặc `{ok: false, error}`.

## 5. State machine

```text
LOBBY
  → SELECT_QUESTION
  → ANSWERING
  → ANSWER_RESULT
  → GUESS_PHASE
      → FINISHED (đúng hoặc hết final guess)
      → SELECT_NEXT_TEAM
  → SELECT_QUESTION
```

`PAUSED` lưu `phaseBeforePause` và số mili-giây còn lại, sau Resume dựng lại deadline theo giờ server.

## 6. Backlog ưu tiên cho agent tiếp theo

### P0 — Phải làm trước buổi chơi thật

1. Chạy test thủ công với 8 browser/device trên cùng Wi-Fi.
2. Kiểm tra Windows Firewall và IP LAN; ghi IP thật lên slide/hướng dẫn lớp.
3. Thay `ADMIN_CODE`, không dùng `123456`.
4. Review học thuật toàn bộ 24 câu với giảng viên MLN122; hiện câu hỏi là bộ dữ liệu mẫu kỹ thuật.
5. Kiểm tra ảnh puzzle trên màn chiếu; crop lại nếu khuôn mặt chưa nằm ở vùng mở hợp lý.
6. Test restart server giữa `ANSWERING`, `ANSWER_RESULT` và `GUESS_PHASE`.
7. Quyết định Admin có được Start khi chưa đủ 7 đội hay bắt buộc đủ 7. Hiện tại chỉ cần ít nhất 1 để dễ demo.

### P1 — Cứng hóa trước khi nghiệm thu

1. Hash session token trong database thay vì lưu plaintext.
2. Rate-limit Join, Login và Guess Submit.
3. Không dùng mã Admin gửi trực tiếp lại sau reconnect; đổi sang admin session token có thời hạn.
4. Thêm Socket.IO integration tests cho role/phase/deadline và cạnh tranh hai dự đoán đồng thời.
5. Thêm endpoint export/reset event log dành cho Admin.
6. Xử lý ngân hàng câu hỏi hết trước khi 12 mảnh được giải quyết.
7. Hiển thị đầy đủ Guess Queue trên Admin UI: requestedAt, token, Waiting/Incorrect/Winner.
8. Thêm dialog xác nhận và phản hồi thành công/thất bại thay cho lỗi banner duy nhất.

### P2 — Hoàn thiện trải nghiệm

1. Tạo SVG jigsaw thật có tab/blank khớp nhau; clip-path hiện tại đã bất quy tắc nhưng vẫn nằm trên lưới 4×3.
2. Có thể crop ảnh gần khuôn mặt hơn nếu màn chiếu thực tế cho thấy chủ thể còn quá nhỏ; file hiện đã được tối ưu còn khoảng 190 KB.
3. Thêm âm thanh đúng/sai/countdown/winner và nút mute.
4. Thêm animation chuyển phase và confetti vừa phải.
5. Thêm màn spectator/projector không có nút tương tác.
6. Thêm trang chỉnh câu hỏi/nhập CSV.
7. Thêm i18n hoặc chuẩn hóa toàn bộ nhãn sang tiếng Việt.

## 7. Checklist test thủ công

### Join/reconnect

- Join đủ 7 đội; đội thứ 8 bị từ chối.
- Hai tên khác hoa/thường bị coi là trùng.
- F5 từng máy không sinh đội mới và giữ token.
- Ngắt Wi-Fi rồi kết nối lại cập nhật `isConnected` đúng.

### Quiz/turn

- Chỉ active team rút câu và trả lời.
- Hai click nhanh không tạo hai kết quả/token.
- Hết 20 giây khóa đúng một mảnh.
- Cả 8 máy thấy cùng question, deadline và puzzle state.
- Không lặp câu trong một trận.

### Guess

- Đội 0 token không Request được.
- Request hai lần bị từ chối.
- Đội không queue không Submit được.
- Submit sai trừ đúng 1 token và không được submit lại trong phase đó.
- Hai đội đoán đúng gần đồng thời: server chỉ công nhận request hợp lệ đến trước.
- Khi Winner xuất hiện, toàn bộ mảnh mở và mọi thao tác khác dừng.

### Admin/recovery

- Pause đóng băng timer; Resume giữ gần đúng số giây còn lại.
- Reset đưa puzzle/token/score về đầu nhưng giữ danh sách đội.
- Restart server rồi client reconnect thấy lại state đã lưu.
- `/admin` không điều khiển được khi chưa đăng nhập.

## 8. Những vùng mã cần thận trọng

- Không đưa `correctAnswer` vào `currentQuestion`; chỉ cho phép nó xuất hiện trong `lastResult` sau khi câu đã chấm.
- Không broadcast `sessionToken`. `publicState()` đã loại trường này.
- Không dùng thời gian client để quyết định timeout hoặc winner.
- Khi sửa `tick()`, bảo đảm mỗi deadline chỉ gây một transition; JavaScript event loop hiện giúp thao tác tuần tự trong một process.
- Nếu scale nhiều Node process, phải chuyển atomic game operations sang database/Redis lock; code hiện chỉ hỗ trợ một server process.

## 9. Lệnh bắt đầu cho agent mới

```powershell
npm install
npm test
npm run build
npm run dev
```

Sau khi xác nhận baseline xanh, agent nên làm P0 theo thứ tự: test LAN → review câu hỏi → tối ưu ảnh → recovery test. Không redesign trước khi gameplay 8 máy đã ổn định.
