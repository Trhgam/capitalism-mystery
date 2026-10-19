import { Brand } from "../components/Brand.jsx";

export function LobbyPage({
  state,
  team,
  adminMode,
  connected,
  error,
  actions,
}) {
  const liveTeam = state.teams.find((item) => item.id === team?.id) || team;
  const slots = Array.from(
    { length: 7 },
    (_, index) => state.teams[index] || null,
  );
  const connectedTeamCount = state.teams.filter((item) => item.isConnected).length;


  return (
    <main className="figma-lobby">
      <header className="figma-header">
        <Brand />
      </header>

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
          {adminMode ? (
            <button className="figma-control-button" onClick={actions.start}>
              Bắt đầu trận <img src="/figma/arrow-right.svg" alt="" />
            </button>
          ) : (
            <button
              className="figma-control-button secondary"
              onClick={() => {
                window.location.href = "/admin";
              }}
            >
              Mở bảng điều khiển <img src="/figma/arrow-right.svg" alt="" />
            </button>
          )}
        </footer>
      </section>
    </main>
  );
}
