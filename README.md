# Capitalism Mystery – Guess Adam Smith

Web game realtime dành cho 1 Admin và tối đa 7 đội. Mọi máy cùng nhìn một câu hỏi và một tranh ghép 12 mảnh; server là nguồn trạng thái duy nhất.

UI Lobby được triển khai theo Figma file `gxfYzaalurU9fGBDsMBugH`, node `1:92`. SVG và font được đóng gói local nên máy trong lớp không cần Internet để tải giao diện.

## Chạy nhanh

Yêu cầu: Node.js 22.5 trở lên.

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

- Team: `http://localhost:5173`
- Admin: `http://localhost:5173/admin`
- Mã Admin mặc định khi chưa cấu hình `.env`: `123456`

Hãy đổi `ADMIN_CODE` trong `.env` trước khi chơi thật.

## Chạy production trên mạng LAN

```powershell
npm run build
npm start
```

Sau đó mở `http://IP-CUA-MAY-CHU:3000` trên các máy đội và `/admin` trên máy Admin. Windows Firewall có thể yêu cầu cho phép Node.js nhận kết nối trong mạng Private.

## Lệnh kiểm tra

```powershell
npm test
npm run build
npm audit
```

## Luật đang được triển khai

- Team Name duy nhất, tối đa 7 đội; session token trong `localStorage` dùng để reconnect.
- Admin có mã riêng và không tham gia trả lời.
- Active Team rút một câu ngẫu nhiên chưa dùng và có 20 giây trả lời.
- Đúng: mở mảnh và nhận +1 Guess Token. Sai/hết giờ: khóa mảnh. Trò chơi không tính điểm.
- Đội có token đăng ký Guess Queue trong lúc trả lời/xem kết quả.
- Guess Phase kéo dài 10 giây; lượt cuối kéo dài 20 giây.
- Gửi dự đoán hợp lệ tiêu hao 1 token. Dự đoán đúng đầu tiên thắng.
- Sau Guess Phase, đội vừa trả lời chọn đội tiếp theo; không được tự chọn mình khi có đội khác.
- Admin có Start, Pause, Resume và Reset.
- State và nhật ký sự kiện được lưu trong `server/data/game.sqlite`.

## Cấu trúc

```text
client/                 React + Vite
  public/adam-smith.jpg Ảnh puzzle đã tối ưu cho mạng LAN
  src/components/       Thành phần game
  src/hooks/useGame.js  Socket client + reconnect
server/                 Express + Socket.IO
  src/game/             State machine và luật chơi
  src/socket/           Event handlers + phân quyền
  src/data/             Ngân hàng 24 câu hỏi
  src/lib/              SQLite persistence
  test/                 Unit/integration tests
HANDOFF.md              Kế hoạch tiếp quản chi tiết
```

SQLite dùng module tích hợp của Node và được bật tự động bằng `--experimental-sqlite` trong scripts.
