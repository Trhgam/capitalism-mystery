import { useState, useEffect } from "react";
import { Countdown } from "./Countdown.jsx";

export function GamePanel({ state, self, adminMode, actions }) {
  const [guess, setGuess] = useState("");
  const activeTeam = state.teams.find((item) => item.id === state.currentTeamId);
  const isActive = self?.id === state.currentTeamId;
  const queueItem = state.guessQueue?.find((item) => item.teamId === self?.id);
  const hasTokens = (self?.guessTokens || 0) > 0;
  const isWaitingInQueue = queueItem?.status === "waiting";

  useEffect(() => {
    if (state.phase === "SELECT_QUESTION" && isActive) {
      actions.selectQuestion();
    }
  }, [state.phase, isActive, actions]);

  const canRequestGuess =
    hasTokens &&
    !isWaitingInQueue &&
    (state.phase === "ANSWER_RESULT" ||
      state.phase === "GUESS_PHASE" ||
      state.phase === "FINAL_MYSTERY");

  const submitGuess = async (event) => {
    event.preventDefault();
    if (!guess.trim()) return;
    await actions.submitGuess(guess);
    setGuess("");
  };

  const isAnsweringOrResult = ["ANSWERING", "ANSWER_RESULT"].includes(state.phase);

  return (
    <div className="quiz-column-container">
      <section className="quiz-card-panel">
        {/* Top Header of the Question Card */}
        <div className="quiz-card-header">
          <div className="quiz-meta-left">
            <span className="quiz-category-tag">
              {state.phase === "FINAL_MYSTERY"
                ? "FINAL MYSTERY"
                : state.currentQuestion?.category || (state.phase === "SELECT_QUESTION" ? "CHUẨN BỊ" : "CÂU HỎI")}
            </span>
            <span className="quiz-team-turn">
              {state.phase === "FINAL_MYSTERY" || state.phase === "FINAL_CLUE_PHASE"
                ? "VÒNG GỢI Ý QUYẾT ĐỊNH"
                : `CÂU HỎI CHO ${activeTeam?.name || "ĐỘI CHƠI"}`}
            </span>
          </div>

          <div className="quiz-meta-right">
            <Countdown deadline={state.deadline} serverNow={state.serverNow} />
          </div>
        </div>

        {/* Main Content Body based on Phase */}
        <div className="quiz-card-body">
          {/* Phase: FINAL_MYSTERY */}
          {state.phase === "FINAL_MYSTERY" && (
            <FinalMysteryContent state={state} self={self} actions={actions} />
          )}

          {/* Phase: SELECT_QUESTION (auto-starts immediately without any confirm button) */}
          {state.phase === "SELECT_QUESTION" && (
            <div className="quiz-prompt-state">
              <h2 className="quiz-question-title">
                Đang mở câu hỏi cho {activeTeam?.name || "đội chơi"}…
              </h2>
              <div className="quiz-waiting-text">
                Hệ thống đang nạp câu hỏi ngẫu nhiên…
              </div>
            </div>
          )}

          {/* Phase: ANSWERING or ANSWER_RESULT */}
          {isAnsweringOrResult && state.currentQuestion && (
            <>
              <h2 className="quiz-question-title">
                {state.currentQuestion.text}
              </h2>

              {/* 2x2 Options Grid */}
              <div className="quiz-options-grid">
                {state.currentQuestion.options.map((option, index) => {
                  const letter = String.fromCharCode(65 + index);
                  const isCorrect =
                    state.phase === "ANSWER_RESULT" &&
                    state.lastResult?.correctAnswer === index;
                  const isSelectedWrong =
                    state.phase === "ANSWER_RESULT" &&
                    !state.lastResult?.isCorrect &&
                    state.lastResult?.chosenAnswer === index;

                  let cardClass = "quiz-option-card";
                  if (isCorrect) cardClass += " correct";
                  if (isSelectedWrong) cardClass += " incorrect";

                  return (
                    <button
                      key={option}
                      type="button"
                      disabled={!isActive || state.phase !== "ANSWERING"}
                      className={cardClass}
                      onClick={() => actions.answer(index)}
                    >
                      <span className="option-letter-badge">{letter}</span>
                      <span className="option-content-text">{option}</span>
                    </button>
                  );
                })}
              </div>

              {/* Answer Result Banner */}
              {state.phase === "ANSWER_RESULT" && (
                <div
                  className={`quiz-result-alert ${state.lastResult?.isCorrect ? "success" : "failure"
                    }`}
                >
                  {state.lastResult?.isCorrect
                    ? `✓ Chính xác! +1 lượt đoán. Có ${state.guessQueue.length} đội trong hàng đợi.`
                    : state.lastResult?.timedOut
                      ? "✕ Hết giờ! Mảnh ghép đã bị khóa."
                      : "✕ Chưa chính xác! Mảnh ghép đã bị khóa."}
                </div>
              )}
            </>
          )}

          {/* Phase: GUESS_PHASE */}
          {state.phase === "GUESS_PHASE" && (() => {
            const currentGuesser = state.guessQueue?.find((item) => item.status === "waiting");
            const currentGuesserTeam = state.teams.find((t) => t.id === currentGuesser?.teamId);
            const isMyTurnToGuess = queueItem?.status === "waiting" && currentGuesser?.teamId === self?.id;

            return (
              <div className="quiz-guess-state">
                <h2 className="quiz-question-title">
                  {state.finalGuess
                    ? "Cơ hội đoán cuối cùng"
                    : "Ai là nhà kinh tế học bí ẩn?"}
                </h2>

                {isMyTurnToGuess ? (
                  <div className="vintage-guess-form-wrapper">
                    <form onSubmit={submitGuess} className="guess-submit-form">
                      <input
                        type="text"
                        value={guess}
                        onChange={(e) => setGuess(e.target.value)}
                        placeholder="Nhập tên nhà kinh tế học (ví dụ: Adam Smith)…"
                        autoFocus
                        className="guess-input"
                      />
                      <button type="submit" className="quiz-primary-btn">
                        Gửi dự đoán <span>→</span>
                      </button>
                      <button type="button" className="quiz-cancel-btn" onClick={actions.cancelGuess}>
                        Hủy
                      </button>
                    </form>
                    <p className="vintage-form-hint">
                      Chỉ có một cơ hội đoán cho mỗi lượt. Hãy cân nhắc kỹ trước khi gửi!
                    </p>
                  </div>
                ) : queueItem?.status === "incorrect" ? (
                  <div className="vintage-status-card">
                    <div className="vintage-seal incorrect">
                      <span>✕</span>
                    </div>
                    <h3 className="vintage-status-title">Dự đoán chưa chính xác</h3>
                    <div className="vintage-divider">✦ ❖ ✦</div>
                    <p className="vintage-status-text">
                      {hasTokens ? (
                        <>
                          Lượt dự đoán vừa rồi chưa chính xác. Bạn vẫn còn{" "}
                          <strong>{self?.guessTokens} lượt dự đoán</strong>! Hãy nhấn nút{" "}
                          <em>Dự đoán tiếp</em> bên dưới để tiếp tục vào hàng đợi.
                        </>
                      ) : (
                        "Danh tính của nhà kinh tế học này vẫn còn là một ẩn số. Lượt dự đoán này đã khép lại và 1 Lượt đoán đã được sử dụng."
                      )}
                    </p>
                    <span className="vintage-status-tag">
                      {hasTokens ? `CÒN ${self?.guessTokens} LƯỢT ĐOÁN` : "TIẾP TỤC ĐIỀU TRA"}
                    </span>
                  </div>
                ) : queueItem?.status === "waiting" ? (
                  <div className="vintage-status-card">
                    <div className="vintage-seal waiting">
                      <span>⏳</span>
                    </div>
                    <h3 className="vintage-status-title">Đang trong hàng đợi dự đoán</h3>
                    <div className="vintage-divider">✦ ❖ ✦</div>
                    <p className="vintage-status-text">
                      {currentGuesserTeam
                        ? `Đang chờ ${currentGuesserTeam.name} đưa ra câu trả lời. Hãy sẵn sàng khi đến lượt bạn!`
                        : "Vui lòng chờ lượt dự đoán tiếp theo…"}
                    </p>
                    <span className="vintage-status-tag">HÀNG ĐỢI DỰ ĐOÁN</span>
                  </div>
                ) : queueItem?.status === "timed_out" ? (
                  <div className="vintage-status-card">
                    <div className="vintage-seal incorrect">
                      <span>⏱</span>
                    </div>
                    <h3 className="vintage-status-title">Hết thời gian dự đoán</h3>
                    <div className="vintage-divider">✦ ❖ ✦</div>
                    <p className="vintage-status-text">
                      Đội bạn đã không gửi câu trả lời kịp thời gian quy định cho lượt này.
                    </p>
                    <span className="vintage-status-tag">ĐÃ HẾT GIỜ</span>
                  </div>
                ) : queueItem?.status === "winner" ? (
                  <div className="vintage-status-card">
                    <div className="vintage-seal winner">
                      <span>👑</span>
                    </div>
                    <h3 className="vintage-status-title">Giải mã xuất sắc!</h3>
                    <div className="vintage-divider">✦ ❖ ✦</div>
                    <p className="vintage-status-text">
                      Chính xác! Nhà kinh tế học bí ẩn chính là Adam Smith.
                    </p>
                    <span className="vintage-status-tag">CHIẾN THẮNG</span>
                  </div>
                ) : (
                  <div className="vintage-status-card">
                    <div className="vintage-seal waiting">
                      <span>🔍</span>
                    </div>
                    <h3 className="vintage-status-title">Cuộc điều tra đang diễn ra</h3>
                    <div className="vintage-divider">✦ ❖ ✦</div>
                    <p className="vintage-status-text">
                      {currentGuesserTeam
                        ? `Đội ${currentGuesserTeam.name} đang tiến hành nhận diện nhà kinh tế học bí ẩn…`
                        : "Các đội trong hàng đợi đang tiến hành gửi câu trả lời…"}
                    </p>
                    <span className="vintage-status-tag">VÒNG ĐIỀU TRA</span>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Phase: SELECT_NEXT_TEAM */}
          {state.phase === "SELECT_NEXT_TEAM" && (
            <div className="quiz-next-team-state">
              <h2 className="quiz-question-title">Chọn đội chơi tiếp theo</h2>
              {isActive ? (
                <div className="next-team-grid">
                  {state.teams
                    .filter(
                      (team) =>
                        team.isConnected &&
                        (team.id !== state.currentTeamId ||
                          state.teams.filter((item) => item.isConnected).length === 1)
                    )
                    .map((team) => (
                      <button
                        key={team.id}
                        type="button"
                        className="next-team-btn"
                        onClick={() => actions.selectNext(team.id)}
                      >
                        {team.name}
                      </button>
                    ))}
                </div>
              ) : (
                <p className="quiz-waiting-text">
                  {activeTeam?.name || "Đội vừa chơi"} đang chọn đội tiếp theo…
                </p>
              )}
            </div>
          )}

          {/* Phase: PAUSED */}
          {state.phase === "PAUSED" && (
            <div className="quiz-prompt-state">
              <h2 className="quiz-question-title">Trận đấu đang tạm dừng</h2>
              <p className="quiz-waiting-text">Đồng hồ sẽ tiếp tục khi Giáo viên Resume.</p>
            </div>
          )}
        </div>

        {state.phase !== "FINAL_MYSTERY" && state.phase !== "FINAL_CLUE_PHASE" && (
          <div className="quiz-card-footer">
            <p className="quiz-helper-note">
              {state.phase === "ANSWERING"
                ? "Đội hiện tại trả lời câu hỏi. Sau đó hệ thống sẽ cho phép chọn đội tiếp theo."
                : state.phase === "ANSWER_RESULT"
                  ? state.lastResult?.isCorrect
                    ? "Đội hiện tại có thể chọn Dự đoán ngay hoặc Lưu lượt đoán cho vòng sau."
                    : "Trả lời sai: hệ thống sẽ chuyển sang chọn đội tiếp theo."
                  : state.phase === "GUESS_PHASE"
                    ? "Các đội trong hàng đợi có cơ hội đoán tên nhà kinh tế học."
                    : state.phase === "SELECT_NEXT_TEAM"
                      ? "Đội vừa chơi đang chọn đội tiếp theo tham gia trả lời câu hỏi."
                      : "Hệ thống đang chuẩn bị cho vòng tiếp theo."}
            </p>
          </div>
        )}
      </section>

      {/* Action Banner directly below Question Card */}
      {state.phase !== "FINAL_MYSTERY" && state.phase !== "FINAL_CLUE_PHASE" && (
        <div className="puzzle-guess-bar">
        <div className="puzzle-guess-text">
          <strong>Đã nhận ra nhân vật?</strong>
          <p>Dùng một lượt đoán hoặc giữ lại cho vòng sau.</p>
        </div>

        <div className="puzzle-guess-actions">
          {state.phase === "ANSWER_RESULT" && state.lastResult?.isCorrect && isActive && hasTokens ? (
            <>
              <button
                type="button"
                className="puzzle-save-btn"
                onClick={actions.saveGuess}
                title="Giữ lượt dự đoán này để sử dụng trong các vòng sau"
              >
                Lưu lượt đoán
              </button>
              <button
                type="button"
                className="puzzle-guess-btn"
                onClick={actions.requestGuess}
              >
                Dự đoán ngay <span>→</span>
              </button>
            </>
          ) : isWaitingInQueue ? (
            <>
              <button type="button" className="puzzle-save-btn" onClick={actions.cancelGuess}>Hủy đăng ký</button>
              <button type="button" className="puzzle-guess-btn queued" disabled>✓ Đã vào hàng đợi</button>
            </>
          ) : (
            <button
              type="button"
              className="puzzle-guess-btn"
              onClick={actions.requestGuess}
              disabled={!canRequestGuess}
              title={
                !hasTokens
                  ? "Bạn chưa có lượt dự đoán"
                  : !canRequestGuess
                    ? "Chỉ đăng ký dự đoán sau khi trả lời đúng"
                    : "Nhấn để yêu cầu dự đoán"
              }
            >
              {queueItem?.status === "incorrect" && hasTokens ? "Dự đoán tiếp →" : "Dự đoán ngay →"}
            </button>
          )}
        </div>
      </div>
      )}
    </div>
  );
}

function FinalMysteryContent({ state, self, actions }) {
  const fm = state.finalMystery;
  const isRegistration = fm?.subphase === "REGISTRATION";
  const isRegistered = fm?.registeredTeamIds?.includes(self?.id);
  const hasAnswered = fm?.answeredTeamIds?.includes(self?.id);

  return (
    <div className="final-right-content">
      <span className="final-right-phase">
        {isRegistration
          ? `ĐỌC GỢI Ý & ĐĂNG KÝ — ${fm?.registrationSeconds || 20} GIÂY`
          : `TRẢ LỜI CÂU HỎI — ${fm?.answerSeconds || 15} GIÂY`}
      </span>

      <div className="final-right-notice">
        <b>Chưa có đội nào đoán đúng nhân vật.</b>
        <p>
          {fm?.grantedFreeToken
            ? "Tất cả đội đang chơi đã hết lượt, nên mỗi đội được cấp thêm 1 lượt dự đoán miễn phí."
            : "Các đội có lượt dự đoán có thể đăng ký tham gia vòng quyết định."}
        </p>
      </div>

      <div className="final-right-question">
        <span>CÂU HỎI QUYẾT ĐỊNH</span>
        <p>“Tôi là nhà kinh tế học người Scotland, được xem là một trong những người đặt nền móng cho kinh tế học hiện đại. Năm 1776, tôi xuất bản tác phẩm <b>‘Sự giàu có của các quốc gia’</b>. Tôi là ai?”</p>
      </div>

      {isRegistration ? (
        <div className="final-right-registration">
          {isRegistered ? (
            <div className="final-right-registered">
              <span>✓ Đội bạn đã đăng ký trả lời.</span>
              <button type="button" onClick={actions.cancelGuess}>Hủy đăng ký</button>
            </div>
          ) : (self?.guessTokens || 0) > 0 ? (
            <button type="button" className="final-register-button" onClick={actions.registerFinalMystery}>
              Đăng ký trả lời — dùng 1 lượt <span>→</span>
            </button>
          ) : (
            <div className="final-right-unavailable">Đội bạn không còn lượt dự đoán để đăng ký.</div>
          )}
          <p className="final-right-queue">
            Đã đăng ký: {fm?.registeredTeamIds?.map((id) => state.teams.find((team) => team.id === id)?.name).filter(Boolean).join(", ") || "Chưa có đội nào"}
          </p>
        </div>
      ) : (
        <div className="final-right-answering">
          {hasAnswered ? (
            <div className="final-right-unavailable">Đội bạn đã trả lời và không thể chọn lại.</div>
          ) : !isRegistered ? (
            <div className="final-right-unavailable">Đội bạn không đăng ký vòng cuối.</div>
          ) : (
            <div className="final-right-options">
              {["Adam Smith", "Karl Marx", "John Maynard Keynes", "David Ricardo"].map((option, index) => (
                <button key={option} type="button" onClick={() => actions.answer(index)}>
                  <span>{String.fromCharCode(65 + index)}</span>{option}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
