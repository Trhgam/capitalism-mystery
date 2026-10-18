import { Brand } from "../components/Brand.jsx";
import { TeamSidebar } from "../components/TeamSidebar.jsx";
import { PuzzleBoard } from "../components/PuzzleBoard.jsx";
import { GamePanel } from "../components/GamePanel.jsx";
import { AdminControls } from "../components/AdminControls.jsx";

export function GamePage({ state, team, adminMode, connected, error, actions }) {
  const liveTeam = state.teams.find((item) => item.id === team?.id) || team;
  const queueItem = state.guessQueue?.find((item) => item.teamId === liveTeam?.id);
  const canRequestGuess =
    liveTeam &&
    liveTeam.guessTokens > 0 &&
    !queueItem &&
    (state.phase === "ANSWERING" ||
      (state.phase === "ANSWER_RESULT" && state.lastResult?.isCorrect));

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
            <small>LƯỢT DỰ ĐOÁN</small>
            <strong>{liveTeam?.guessTokens || 0}</strong>
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
  return (
    <main className="winner-page">
      <div className="winner-art">
        <PuzzleBoard
          pieces={state.puzzle}
          finished={hasWinner}
          veiled={!hasWinner}
        />
      </div>
      <div className="winner-copy">
        <div className="eyebrow">{hasWinner ? "Mystery solved" : "Mystery unsolved"}</div>
        <h1>{hasWinner ? "Adam Smith" : "Chưa có đội chiến thắng"}</h1>
        {hasWinner ? (
          <>
            <p>Đội chiến thắng</p>
            <strong>{state.winner.teamName}</strong>
            <blockquote>“The great affair, we always find, is to get money.”</blockquote>
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
              <button
                className="primary"
                style={{ background: "linear-gradient(135deg, #d4af37, #997819)", color: "#161822" }}
                onClick={actions.startFinalMystery}
              >
                Mở Vòng Gợi Ý (Final Mystery) →
              </button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
