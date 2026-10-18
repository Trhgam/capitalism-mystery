import { useState } from "react";
import { Brand } from "../components/Brand.jsx";

export function JoinPage({ onJoin, error, connected }) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    try { await onJoin(name); } finally { setLoading(false); }
  };
  return (
    <main className="welcome-page">
      <div className="welcome-copy"><Brand/><div className="display-title"><span>Capitalism</span><strong>Mystery</strong></div><p>Giải mã từng mảnh ghép. Tích lũy quyền đoán. Tìm ra nhà kinh tế học bí ẩn trước các đối thủ.</p><div className="edition">MLN122 · Classroom Edition</div></div>
      <form className="join-card" onSubmit={submit}>
        <div className="step">01 / Tham gia</div><h1>Đặt tên cho đội</h1><p>Tên này sẽ xuất hiện trên bảng thi đấu của cả lớp.</p>
        <label>Tên đội<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ví dụ: Invisible Hands" maxLength={24} autoFocus /></label>
        {error && <div className="form-error">{error}</div>}
        <button className="primary wide" disabled={!connected || loading || name.trim().length < 2}>{loading ? "Đang tham gia…" : connected ? "Join Game →" : "Đang kết nối…"}</button>
        <small>Không cần tài khoản hoặc mã phòng.</small>
      </form>
    </main>
  );
}
