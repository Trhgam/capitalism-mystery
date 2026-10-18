import { useMemo } from "react";
import { getJigsawPieces } from "./jigsawGeometry.js";

export function PuzzleBoard({ pieces, finished, onGuessClick, canGuess, isQueued }) {
  const jigsawLayout = useMemo(() => getJigsawPieces(), []);

  const revealedCount = finished
    ? 12
    : pieces.filter((piece) => piece.status === "revealed").length;
  const progressPercent = Math.min(100, Math.round((revealedCount / 12) * 100));

  return (
    <section className="puzzle-section">
      {/* Top Header of Center Section */}
      <div className="puzzle-header">
        <div className="puzzle-header-title">
          <span className="puzzle-eyebrow">CHÂN DUNG BÍ ẨN</span>
          <h1 className="puzzle-main-title">Khám phá nhà kinh tế học</h1>
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
      <div className={`puzzle-card ${finished ? "complete" : ""}`}>
        <div className="puzzle-canvas">
          {/* Base portrait image of Adam Smith underneath */}
          <img
            src="/adam-smith.jpg"
            alt="Chân dung Adam Smith"
            className="puzzle-base-image"
          />

          {/* SVG Overlay of Interlocking Jigsaw Pieces */}
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
        </div>

        {/* Puzzle Footer Note & Legend */}
        <div className="puzzle-card-footer">
          <span className="puzzle-note">
            Mảnh ghép được chọn ngẫu nhiên từ ngoài vào trong
          </span>
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

      {/* Action Banner directly below the Puzzle Card */}
      <div className="puzzle-guess-bar">
        <div className="puzzle-guess-text">
          <strong>Đã nhận ra nhân vật?</strong>
          <p>Dùng một lượt đoán hoặc giữ lại cho vòng sau.</p>
        </div>
        <button
          type="button"
          className={`puzzle-guess-btn ${isQueued ? "queued" : ""}`}
          onClick={onGuessClick}
          disabled={!canGuess && !isQueued}
          title={
            isQueued
              ? "Bạn đã đăng ký hàng đợi dự đoán"
              : canGuess
              ? "Nhấn để yêu cầu dự đoán"
              : "Cần có lượt dự đoán và đang trong lượt chơi"
          }
        >
          {isQueued ? "✓ Đã vào hàng đợi" : <>Dự đoán ngay <span>→</span></>}
        </button>
      </div>
    </section>
  );
}
