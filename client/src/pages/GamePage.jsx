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
    ["ANSWERING", "ANSWER_RESULT"].includes(state.phase);

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
        />

        <PuzzleBoard
          pieces={state.puzzle}
          finished={false}
          onGuessClick={actions.requestGuess}
          canGuess={canRequestGuess}
          isQueued={Boolean(queueItem)}
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
  return (
    <main className="winner-page">
      <div className="winner-art">
        <PuzzleBoard pieces={state.puzzle} finished />
      </div>
      <div className="winner-copy">
        <div className="eyebrow">Mystery solved</div>
        <h1>{state.winner ? "Adam Smith" : "Chưa có đội chiến thắng"}</h1>
        {state.winner ? (
          <>
            <p>Đội chiến thắng</p>
            <strong>{state.winner.teamName}</strong>
            <blockquote>“The great affair, we always find, is to get money.”</blockquote>
          </>
        ) : (
          <p>12 mảnh đã được xử lý nhưng không có dự đoán chính xác.</p>
        )}
        {adminMode && (
          <button className="primary" onClick={actions.reset}>
            Chuẩn bị trận mới
          </button>
        )}
      </div>
    </main>
  );
}
