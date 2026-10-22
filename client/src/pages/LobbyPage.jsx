import { useEffect, useState } from "react";
import { Brand } from "../components/Brand.jsx";
import { JoinQrButton } from "../components/JoinQrButton.jsx";

export function LobbyPage({
  state,
  team,
  adminMode,
  connected,
  error,
  actions,
}) {
  const [showRules, setShowRules] = useState(false);
  const liveTeam = state.teams.find((item) => item.id === team?.id) || team;
  const slots = Array.from(
    { length: 7 },
    (_, index) => state.teams[index] || null,
  );
  const connectedTeamCount = state.teams.filter((item) => item.isConnected).length;

  useEffect(() => {
    if (!showRules) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setShowRules(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [showRules]);


  return (
    <main className="figma-lobby">
      <header className="figma-header">
        <Brand />
        <div className="figma-header-actions">
          {adminMode && <JoinQrButton />}
          <button
            type="button"
            className="rules-help-button"
            aria-label="Xem thể lệ trò chơi"
            title="Xem thể lệ trò chơi"
            onClick={() => setShowRules(true)}
          >
            ?
          </button>
        </div>
      </header>

      {showRules && (
        <div
          className="rules-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowRules(false);
          }}
        >
          <section className="rules-modal" role="dialog" aria-modal="true" aria-labelledby="rules-title">
            <button type="button" className="rules-modal-close" aria-label="Đóng thể lệ" onClick={() => setShowRules(false)}>×</button>
            <span className="rules-modal-eyebrow">HƯỚNG DẪN NHANH</span>
            <h2 id="rules-title">Thể lệ trò chơi</h2>
            <ol className="rules-steps">
              <li><b>Trả lời câu hỏi:</b> Đội đến lượt chọn một đáp án trước khi hết giờ.</li>
              <li><b>Tích lũy lượt dự đoán:</b> Trò chơi không tính điểm. Trả lời đúng mở một mảnh và nhận +1 lượt dự đoán; trả lời sai khóa mảnh.</li>
              <li><b>Dự đoán nhân vật:</b> Sau khi trả lời đúng, đội có thể dùng lượt ngay hoặc lưu lại. Các đội đăng ký sẽ vào hàng đợi.</li>
              <li><b>Chuyển lượt:</b> Sau mỗi lượt, hệ thống tự chọn ngẫu nhiên một đội đang kết nối; nếu có nhiều đội, đội vừa chơi sẽ không được chọn liên tiếp.</li>
              <li><b>Final Mystery:</b> Đội có lượt dự đoán phải đăng ký. Nếu tất cả đã hết lượt, mỗi đội đang chơi được cấp 1 lượt miễn phí.</li>
            </ol>
            <div className="rules-modal-tip">Không xếp hạng bằng điểm — đội dự đoán đúng nhà kinh tế học bí ẩn đầu tiên sẽ chiến thắng.</div>
            <button type="button" className="rules-understood-button" onClick={() => setShowRules(false)}>Đã hiểu, bắt đầu thôi</button>
          </section>
        </div>
      )}

      {error && <div className="global-error">{error}</div>}

      <section className="figma-lobby-content">
        <div className="figma-lobby-intro">
          <div className="figma-room-label">PHÒNG CHỜ TRỰC TUYẾN</div>
          <h1>Cuộc điều tra đang chờ</h1>
          <p>
            Bảy đội, một nhà kinh tế học bí ẩn. Trò chơi bắt đầu khi Admin mở
            vòng đấu.
          </p>
        </div>

        <section className="figma-team-card">
          <div className="figma-team-card-head">
            <div>
              <img src="/figma/teams.svg" alt="" />
              <span>CÁC ĐỘI TRONG PHÒNG</span>
            </div>
            <strong>
              {connectedTeamCount} / 7{" "}
              {connectedTeamCount === 7 ? "SẴN SÀNG" : "ĐANG KẾT NỐI"}
            </strong>
          </div>
          <div className="figma-team-grid">
            {slots.map((slot, index) =>
              slot ? (
                <div className="figma-team-slot" key={slot.id}>
                  <span className="figma-team-index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="figma-team-avatar">
                    {slot.name.trim().charAt(0).toLocaleUpperCase("vi")}
                  </span>
                  <span className="figma-team-info">
                    <b>{slot.name}</b>
                    <small>
                      <i
                        className={
                          slot.isConnected ? "connected" : "disconnected"
                        }
                      />
                      {slot.isConnected ? "Đã kết nối" : "Mất kết nối"}
                    </small>
                  </span>
                  {slot.id === liveTeam?.id && <em>BẠN</em>}
                </div>
              ) : (
                <div
                  className="figma-team-slot empty-slot"
                  key={`slot-${index}`}
                >
                  <span className="figma-team-index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="figma-team-avatar">?</span>
                  <span className="figma-team-info">
                    <b>Đang chờ đội…</b>
                    <small>
                      <i />
                      Chưa kết nối
                    </small>
                  </span>
                </div>
              ),
            )}
          </div>
        </section>

        <footer className="figma-lobby-footer">
          <div className="figma-waiting">
            <span>
              <i />
              <i />
              <i />
            </span>
            {connected ? "Đang chờ Admin" : "Đang kết nối lại…"}
          </div>
          {adminMode && (
            <button className="figma-control-button" onClick={actions.start}>
              Bắt đầu trận <img src="/figma/arrow-right.svg" alt="" />
            </button>
          )}
        </footer>
      </section>
    </main>
  );
}
