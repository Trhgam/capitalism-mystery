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
          className={`puzzle-canvas ${veiled ? "veiled" : ""}`}
          onContextMenu={(e) => e.preventDefault()}
          onDragStart={(e) => e.preventDefault()}
        >
          {isFinalMystery ? (
            <div className="puzzle-mystery-veil final-mystery-overlay">
              <div className="final-mystery-panel">
                <div className="final-mystery-header">
                  <div className="mystery-veil-seal small">
                    <span>?</span>
                  </div>
                  <div>
                    <span className="fm-phase-badge">
                      {isRegPhase
                        ? "GIAI ĐOẠN 1: ĐĂNG KÝ VÀO QUEUE (10 GIÂY)"
                        : "GIAI ĐOẠN 2: TRẢ LỜI CÂU HỎI (15 GIÂY)"}
                    </span>
                    <h2 className="fm-title">VÒNG GỢI Ý QUYẾT ĐỊNH</h2>
                  </div>
                  <div className="fm-countdown-wrap">
                    <Countdown deadline={state.deadline} serverNow={state.serverNow} />
                  </div>
                </div>

                {/* Announcement Notice explaining WHY Final Mystery is triggered */}
                <div className="fm-trigger-reason-banner">
                  <span className="fm-reason-icon">✦</span>
                  <div className="fm-reason-text-wrap">
                    <strong className="fm-reason-heading">
                      12 CÂU HỎI ĐÃ HOÀN TẤT – CHƯA CÓ ĐỘI NÀO ĐOÁN ĐƯỢC NHÂN VẬT!
                    </strong>
                    <p className="fm-reason-sub">
                      Bức tranh tạm thời được che lại. Các đội có lượt dự đoán đăng ký tham gia giải mã câu hỏi tối hậu để tìm ra nhà vô địch.
                    </p>
                  </div>
                </div>

                <div className="fm-question-box">
                  <span className="fm-question-tag">CÂU HỎI GỢI Ý NHÂN VẬT:</span>
                  <p className="fm-question-quote">
                    “Tôi là nhà kinh tế học người Scotland, được xem là một trong những người đặt nền móng cho kinh tế học hiện đại. Năm 1776, tôi xuất bản tác phẩm <strong>&quot;Sự giàu có của các quốc gia&quot;</strong>. Tôi là ai?”
                  </p>
                </div>

                {/* Subphase 1: Registration */}
                {isRegPhase && (
                  <div className="fm-reg-block">
                    {isRegistered ? (
                      <div className="fm-reg-banner success">
                        ✓ Đội bạn đã vào Queue dự đoán thành công! Chuẩn bị trả lời khi hết 10 giây.
                      </div>
                    ) : (self?.guessTokens || 0) > 0 ? (
                      <div className="fm-reg-action-row">
                        <button
                          type="button"
                          className="fm-reg-btn"
                          onClick={() => {
                            if (actions?.registerFinalMystery) actions.registerFinalMystery();
                            else if (actions?.requestGuess) actions.requestGuess();
                          }}
                        >
                          Đăng ký dự đoán (Dùng 1 Token) <span>→</span>
                        </button>
                        {self?.grantedFinalChance && (
                          <span className="fm-chance-note">
                            ★ Cả phòng hết token: Đội bạn đã được cấp 1 Final Chance Token miễn phí!
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="fm-no-tokens-banner">
                        ✕ Đội bạn không còn lượt dự đoán (0 Token) nên không thể tham gia vòng này.
                      </div>
                    )}

                    <div className="fm-queue-chips">
                      <span className="fm-queue-label">
                        Các đội đã vào Queue ({fm?.registeredTeamIds?.length || 0}):
                      </span>
                      {fm?.registeredTeamIds?.length === 0 ? (
                        <em className="fm-empty-queue">Chưa có đội nào đăng ký…</em>
                      ) : (
                        <div className="fm-chips-wrap">
                          {fm?.registeredTeamIds?.map((tId) => {
                            const tName = state.teams.find((item) => item.id === tId)?.name || "Đội chơi";
                            return (
                              <span key={tId} className={`fm-chip ${tId === self?.id ? "self" : ""}`}>
                                {tName}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Subphase 2: Answering */}
                {isAnsPhase && (
                  <div className="fm-ans-block">
                    {hasAnswered ? (
                      <div className="fm-ans-banner failure">
                        ✕ Đội bạn đã gửi dự đoán chưa chính xác và không được đoán lại trong vòng cuối.
                      </div>
                    ) : !isRegistered ? (
                      <div className="fm-ans-banner warning">
                        Đội bạn không đăng ký tham gia vòng cuối. Hãy theo dõi các đội khác đưa ra đáp án!
                      </div>
                    ) : (
                      <div className="fm-ans-banner prompt">
                        ⚡ Đội đoán đúng đầu tiên sẽ giành chiến thắng chung cuộc! Hãy chọn nhanh:
                      </div>
                    )}

                    <div className="fm-options-grid">
                      {["Adam Smith", "Karl Marx", "John Maynard Keynes", "David Ricardo"].map((opt, idx) => {
                        const letter = String.fromCharCode(65 + idx);
                        const canClick = isRegistered && !hasAnswered;
                        return (
                          <button
                            key={opt}
                            type="button"
                            disabled={!canClick}
                            className="fm-option-btn"
                            onClick={() => actions?.answer?.(idx)}
                          >
                            <span className="fm-opt-letter">{letter}</span>
                            <span className="fm-opt-text">{opt}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
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
