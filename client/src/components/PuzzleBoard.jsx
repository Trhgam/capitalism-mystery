import { useMemo } from "react";
import { getJigsawPieces } from "./jigsawGeometry.js";
import { Countdown } from "./Countdown.jsx";

export function PuzzleBoard({ pieces, finished, veiled = false, state, self, actions }) {
  const jigsawLayout = useMemo(() => getJigsawPieces(), []);

  const revealedCount = finished
    ? 12
    : pieces.filter((piece) => piece.status === "revealed").length;
  const progressPercent = Math.min(100, Math.round((revealedCount / 12) * 100));

  const isFinalMystery = state?.phase === "FINAL_MYSTERY";
  const fm = state?.finalMystery;
  const isRegistered = fm?.registeredTeamIds?.includes(self?.id);
  const hasAnswered = fm?.answeredTeamIds?.includes(self?.id);
  const isRegPhase = fm?.subphase === "REGISTRATION";
  const isAnsPhase = fm?.subphase === "ANSWERING";

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
              <div className="mystery-veil-card">
                <div className="mystery-veil-seal">
                  <span>?</span>
                </div>
                <h2 className="mystery-veil-title">CHÂN DUNG BÍ ẨN</h2>
                <div className="mystery-veil-divider">✦ ❖ ✦</div>
                <p className="mystery-veil-desc">
                  Các đội đang tranh giải mã nhà kinh tế học bí ẩn.<br />
                  Ai sẽ là người đầu tiên tìm ra danh tính?
                </p>
                <span className="mystery-veil-badge">VÒNG QUYẾT ĐỊNH</span>
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
              {jigsawLayout.map((jigsaw) => {
                const pieceState = pieces.find((p) => p.index === jigsaw.index) || {
                  status: "hidden",
                };
                const isRevealed = finished || pieceState.status === "revealed";
                const isLocked = !finished && pieceState.status === "locked";

                if (isRevealed) {
                  // When revealed, piece is transparent so image shows
                  return null;
                }

                return (
                  <g
                    key={jigsaw.index}
                    className={`jigsaw-piece ${isLocked ? "locked" : "hidden"}`}
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
