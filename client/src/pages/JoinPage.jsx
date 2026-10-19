import { useState } from "react";
import { Brand } from "../components/Brand.jsx";

const teamNumbers = [1, 2, 3, 5, 6, 7, 8];

export function JoinPage({ state, onJoin, error, connected }) {
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [loading, setLoading] = useState(false);
  const join = async (teamNumber) => {
    setSelectedTeam(teamNumber);
    setLoading(true);
    try { await onJoin(teamNumber); } finally { setLoading(false); }
  };
  return (
    <main className="welcome-page">
      <div className="welcome-copy"><Brand/><div className="display-title"><span>Capitalism</span><strong>Mystery</strong></div><p>Giải mã từng mảnh ghép. Tích lũy quyền đoán. Tìm ra nhà kinh tế học bí ẩn trước các đối thủ.</p><div className="edition">MLN122 · Classroom Edition</div></div>
      <section className="join-card">
        <div className="step">01 / Tham gia</div><h1>Chọn đội của bạn</h1><p>Chọn đúng số đội đã được phân công. Team 4 không tham gia trò chơi này.</p>
        <div className="fixed-team-options">
          {teamNumbers.map((teamNumber) => {
            const team = state.teams.find((item) => item.name === `Team ${teamNumber}`);
            const unavailable = team?.isConnected;
            return (
              <button
                key={teamNumber}
                type="button"
                className="fixed-team-option"
                disabled={!connected || loading || unavailable}
                onClick={() => join(teamNumber)}
              >
                <span>Team {teamNumber}</span>
                <small>{unavailable ? "Đã có người" : loading && selectedTeam === teamNumber ? "Đang vào…" : "Chọn đội"}</small>
              </button>
            );
          })}
        </div>
        {error && <div className="form-error">{error}</div>}
        <small>Không cần tài khoản hoặc mã phòng.</small>
      </section>
    </main>
  );
}
