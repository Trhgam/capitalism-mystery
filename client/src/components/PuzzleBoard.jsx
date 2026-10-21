import { useMemo } from "react";
import { getJigsawPieces } from "./jigsawGeometry.js";
import { Countdown } from "./Countdown.jsx";

export function PuzzleBoard({ pieces, finished, veiled = false, state, self, actions, adminMode }) {
  const jigsawLayout = useMemo(() => getJigsawPieces(), []);

  const revealedCount = finished
    ? 12
    : pieces.filter((piece) => piece.status === "revealed").length;
  const progressPercent = Math.min(100, Math.round((revealedCount / 12) * 100));
  const activePieceIndex = state?.phase === "ANSWERING" ? state.currentPieceIndex : null;
  const orderedJigsawLayout = activePieceIndex == null
    ? jigsawLayout
    : [...jigsawLayout].sort((a, b) => Number(a.index === activePieceIndex) - Number(b.index === activePieceIndex));

  const isFinalMystery = state?.phase === "FINAL_MYSTERY";
  const fm = state?.finalMystery;
  const isRegistered = fm?.registeredTeamIds?.includes(self?.id);
  const hasAnswered = fm?.answeredTeamIds?.includes(self?.id);
  const isRegPhase = fm?.subphase === "REGISTRATION";
  const isAnsPhase = fm?.subphase === "ANSWERING";
  const showingFeedback = Boolean(fm?.feedbackUntil && fm?.lastAttempt && !fm.lastAttempt.isCorrect);
  const currentFinalTeam = state?.teams?.find((team) => team.id === fm?.currentTeamId);

  return (
    <section className="puzzle-section">
      {/* Top Header of Center Section */}
      <div className="puzzle-header">
        <div className="puzzle-header-title">
          <span className="puzzle-eyebrow">CHÂN DUNG BÍ ẨN</span>
          <h1 className="puzzle-main-title">
            {isFinalMystery ? "FINAL MYSTERY – VÒNG CUỐI" : "Khám phá nhà kinh tế học"}
          </h1>
        </div>
        <div className="puzzle-header-progress">
          <span className="puzzle-progress-text">{revealedCount} / 12 MẢNH GHÉP</span>
          <div className="puzzle-progress-track">
            <div
              className="puzzle-progress-bar"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Puzzle Card */}
      <div className={`puzzle-card ${finished ? "complete" : ""} ${isFinalMystery ? "final-mystery-card" : ""}`}>
        <div
          className={`puzzle-canvas ${(veiled || isFinalMystery) ? "veiled" : ""}`}
          onContextMenu={(e) => e.preventDefault()}
          onDragStart={(e) => e.preventDefault()}
        >
          {isFinalMystery ? (
            <div className="puzzle-mystery-veil">
              <div className="mystery-veil-card final-center-card">
                <div className="final-center-header">
                  <span className="final-center-seal-icon">?</span>
                  <span className="final-center-phase-badge">
                    {isRegPhase
                      ? `VÒNG QUYẾT ĐỊNH — ĐỌC GỢI Ý (${fm?.registrationSeconds || 30}S)`
                      : `VÒNG QUYẾT ĐỊNH — TRẢ LỜI CÂU HỎI (${fm?.answerSeconds || 20}S)`}
                  </span>
                </div>

                <div className="final-center-question-box">
                  <span className="final-center-eyebrow">CÂU HỎI QUYẾT ĐỊNH</span>
                  <p className="final-center-question-quote">
                    “Tôi là nhà kinh tế học người Scotland, được xem là một trong những người đặt nền móng cho kinh tế học hiện đại. Năm 1776, tôi xuất bản tác phẩm <b>‘Sự giàu có của các quốc gia’</b>. Tôi là ai?”
                  </p>
                </div>

                <div className="final-center-options-section">
                  {isAnsPhase ? (
                    showingFeedback ? null :
                    adminMode ? (
                      <div className="final-center-grid">
                        {["Adam Smith", "Karl Marx", "John Maynard Keynes", "David Ricardo"].map((option, index) => (
                          <button
                            key={option}
                            type="button"
                            className="final-center-btn player-action"
                            onClick={() => actions.answer(index, currentFinalTeam?.id)}
                          >
                            <span className="opt-key">{String.fromCharCode(65 + index)}</span>
                            <span className="opt-text">{option}</span>
                          </button>
                        ))}
                      </div>
                    ) : hasAnswered ? (
                      <div className="final-center-notice success">
                        ✓ Đội bạn đã gửi câu trả lời thành công! Vui lòng chờ công bố kết quả…
                      </div>
                    ) : !isRegistered ? (
                      <div className="final-center-notice disabled">
                        Đội bạn không đăng ký tham gia vòng quyết định này.
                      </div>
                    ) : (
                      <div className="final-center-grid">
                        {["Adam Smith", "Karl Marx", "John Maynard Keynes", "David Ricardo"].map((option, index) => (
                          <button
                            key={option}
                            type="button"
                            className="final-center-btn player-action"
                            onClick={() => actions.answer(index, self?.id)}
                          >
                            <span className="opt-key">{String.fromCharCode(65 + index)}</span>
                            <span className="opt-text">{option}</span>
                          </button>
                        ))}
                      </div>
                    )
                  ) : (
                    <div className="final-center-grid preview-mode">
                      {["Adam Smith", "Karl Marx", "John Maynard Keynes", "David Ricardo"].map((option, index) => (
                        <div key={option} className="final-center-btn preview">
                          <span className="opt-key">{String.fromCharCode(65 + index)}</span>
                          <span className="opt-text">{option}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : veiled ? (
            <div className="puzzle-mystery-veil">
              <div className="mystery-veil-card">
                <div className="mystery-veil-seal">
                  <span>?</span>
                </div>
                <h2 className="mystery-veil-title">BẢO MẬT CHÂN DUNG</h2>
                <div className="mystery-veil-divider">✦ ❖ ✦</div>
                <p className="mystery-veil-desc">
                  Trận đấu đã khép lại nhưng không có đội nào giải mã chính xác!
                  <br />
                  Chân dung nhà kinh tế học bí ẩn được giữ bí mật.
                </p>
                <span className="mystery-veil-badge">CHƯA CÓ ĐỘI CHIẾN THẮNG</span>
              </div>
            </div>
          ) : (
            <svg
              className="puzzle-svg-overlay"
              viewBox="0 0 800 600"
              preserveAspectRatio="none"
            >
              {orderedJigsawLayout.map((jigsaw) => {
                const pieceState = pieces.find((p) => p.index === jigsaw.index) || {
                  status: "hidden",
                };
                const isRevealed = finished || pieceState.status === "revealed";
                const isLocked = !finished && pieceState.status === "locked";
                const isActive = !finished && jigsaw.index === activePieceIndex;

                if (isRevealed) {
                  // When revealed, piece is transparent so image shows
                  return null;
                }

                return (
                  <g
                    key={jigsaw.index}
                    className={`jigsaw-piece ${isLocked ? "locked" : "hidden"} ${isActive ? "active" : ""}`}
                  >
                    <path
                      d={jigsaw.path}
                      className="jigsaw-path"
                    />
                    {/* Piece index number */}
                    <text
                      x={jigsaw.labelX}
                      y={jigsaw.labelY}
                      className="jigsaw-label"
                    >
                      {jigsaw.displayNumber}
                    </text>
                    {/* Center coin/badge */}
                    <circle
                      cx={jigsaw.centerX}
                      cy={jigsaw.centerY}
                      r="20"
                      className="jigsaw-circle"
                    />
                    <text
                      x={jigsaw.centerX}
                      y={jigsaw.centerY + 1}
                      className="jigsaw-symbol"
                      textAnchor="middle"
                      dominantBaseline="central"
                    >
                      {isLocked ? "✕" : "$"}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
        </div>

        {/* Puzzle Footer Note & Legend */}
        <div className="puzzle-card-footer">
          <div className="puzzle-legend">
            <span className="legend-item">
              <i className="legend-icon opened" /> Đã mở
            </span>
            <span className="legend-item">
              <i className="legend-icon locked" /> Đã khóa
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
