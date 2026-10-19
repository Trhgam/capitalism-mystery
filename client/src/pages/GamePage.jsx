import { Brand } from "../components/Brand.jsx";
import { TeamSidebar } from "../components/TeamSidebar.jsx";
import { PuzzleBoard } from "../components/PuzzleBoard.jsx";
import { GamePanel } from "../components/GamePanel.jsx";
import { AdminControls } from "../components/AdminControls.jsx";

export function GamePage({ state, team, adminMode, connected, error, actions }) {
  const fallbackTeam = state.teams.find((item) => item.id === state.currentTeamId) || state.teams.find((item) => item.isConnected) || state.teams[0];
  const liveTeam = (team && state.teams.find((item) => item.id === team.id || (team.name && item.name.toLowerCase() === team.name.toLowerCase()))) || team || (adminMode ? fallbackTeam : null);
  const queueItem = state.guessQueue?.find((item) => item.teamId === liveTeam?.id);

  if (state.phase === "FINISHED") {
    return <Winner state={state} actions={actions} adminMode={adminMode} />;
  }

  return (
    <main className="game-page-root">
      {/* Top Header matching Figma & user screenshot */}
      <header className="game-top-header">
        <Brand />
        <div className="figma-token-card">
          <span className="figma-token-icon">
            <img src="/figma/guess-token.svg" alt="" />
          </span>
          <span>
            <small>{adminMode ? "CHẾ ĐỘ QUẢN TRÒ" : "LƯỢT DỰ ĐOÁN"}</small>
            <strong>{adminMode ? "HOST" : (state.teams.find((t) => t.id === liveTeam?.id)?.guessTokens ?? liveTeam?.guessTokens ?? 0)}</strong>
          </span>
        </div>
      </header>

      {error && <div className="global-error">{error}</div>}

      {/* Main 3-Column Layout */}
      <div className="game-main-layout">
        <TeamSidebar
          teams={state.teams}
          currentTeamId={state.currentTeamId}
          selfId={liveTeam?.id}
          guessQueue={state.guessQueue}
        />

        <PuzzleBoard
          pieces={state.puzzle}
          finished={false}
          veiled={(!state.winner && state.phase === "FINAL_MYSTERY") || (!state.winner && state.phase === "FINISHED")}
          state={state}
          self={liveTeam}
          actions={actions}
        />

        <GamePanel
          state={state}
          self={liveTeam}
          adminMode={adminMode}
          actions={actions}
        />
      </div>

      {adminMode && (
        <div className="admin-dock">
          <AdminControls state={state} actions={actions} />
        </div>
      )}
    </main>
  );
}

function Winner({ state, actions, adminMode }) {
  const hasWinner = Boolean(state.winner);
  const isRevealed = hasWinner || Boolean(state.mysteryRevealed);

  return (
    <main className="winner-page">
      <div className="winner-art">
        <PuzzleBoard
          pieces={state.puzzle}
          finished={isRevealed}
          veiled={!isRevealed}
          state={state}
        />
      </div>
      <div className="winner-copy">
        <div className="eyebrow">
          {hasWinner ? "Mystery solved" : isRevealed ? "Mystery revealed" : "Mystery unsolved"}
        </div>
        <h1>
          {isRevealed ? (
            <>
              Adam Smith <span className="winner-years">(1723 – 1790)</span>
            </>
          ) : (
            "Chưa có đội chiến thắng"
          )}
        </h1>
        {hasWinner ? (
          <>
            <p>Đội chiến thắng</p>
            <strong>{state.winner.teamName}</strong>
            <blockquote>“The great affair, we always find, is to get money.”</blockquote>
            <p className="winner-bio-summary">
              Nhà kinh tế học lỗi lạc người Scotland, người khai sinh trường phái Kinh tế học Cổ điển và tác giả của kiệt tác <em>&quot;Sự giàu có của các quốc gia&quot;</em> (1776).
            </p>
          </>
        ) : isRevealed ? (
          <>
            <div style={{
              display: "inline-block",
              padding: "4px 12px",
              background: "rgba(212, 175, 55, 0.2)",
              border: "1px solid rgba(212, 175, 55, 0.6)",
              borderRadius: "20px",
              fontSize: "11px",
              fontWeight: 700,
              color: "#ffd978",
              marginBottom: "8px",
              letterSpacing: "0.05em"
            }}>
              CÔNG BỐ ĐÁP ÁN CHÍNH THỨC
            </div>
            <blockquote>“Không phải từ lòng nhân từ của người bán thịt, người nấu bia hay người làm bánh mì mà chúng ta mong đợi bữa ăn của mình, mà từ sự quan tâm của họ đến lợi ích của chính họ.”</blockquote>
            <p className="winner-bio-summary">
              Adam Smith (1723 – 1790) là nhà triết học và kinh tế học chính trị người Scotland, được coi là <strong>cha đẻ của kinh tế học hiện đại</strong> với tác phẩm kinh điển <em>&quot;Sự giàu có của các quốc gia&quot; (The Wealth of Nations - 1776)</em>.
            </p>
          </>
        ) : (
          <p>12 mảnh đã được xử lý nhưng không có dự đoán chính xác. Chân dung được giữ kín!</p>
        )}
        {adminMode && (
          <div style={{ display: "flex", gap: "12px", marginTop: "18px", flexWrap: "wrap" }}>
            <button className="primary" onClick={actions.reset}>
              Chuẩn bị trận mới
            </button>
            {!hasWinner && (
              <>
                <button
                  className="primary"
                  style={{ background: "linear-gradient(135deg, #d4af37, #997819)", color: "#161822" }}
                  onClick={actions.startFinalMystery}
                >
                  Mở Vòng Gợi Ý (Final Mystery) →
                </button>
                <button
                  className="primary"
                  style={{
                    background: state.mysteryRevealed
                      ? "rgba(46, 204, 113, 0.25)"
                      : "linear-gradient(135deg, #c0392b, #8e1b1b)",
                    border: state.mysteryRevealed ? "1px solid #2ecc71" : "1px solid #e74c3c",
                    color: state.mysteryRevealed ? "#afffd0" : "#fff",
                    fontWeight: 700,
                  }}
                  onClick={actions.revealMystery}
                >
                  {state.mysteryRevealed ? "✓ Đã công bố chân dung" : "Công bố chân dung & đáp án ✦"}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
