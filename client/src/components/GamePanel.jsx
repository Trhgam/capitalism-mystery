import { useState, useEffect } from "react";
import { Countdown } from "./Countdown.jsx";

export function GamePanel({ state, self, adminMode, actions, onSelectTeam }) {
  const [guess, setGuess] = useState("");
  const liveSelf =
    state.teams.find((t) => t.id === self?.id || (self?.name && t.name.toLowerCase() === self.name.toLowerCase())) ||
    self;
  const activeTeam = state.teams.find((item) => item.id === state.currentTeamId);
  const isActive = liveSelf?.id === state.currentTeamId;
  const queueItem = state.guessQueue?.find((item) => item.teamId === liveSelf?.id);
  const tokens = liveSelf?.guessTokens ?? self?.guessTokens ?? 0;
  const hasTokens = tokens > 0;
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
      state.phase === "FINAL_MYSTERY" ||
      state.phase === "SELECT_NEXT_TEAM");

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
            <FinalMysteryContent
              state={state}
              self={self}
              adminMode={adminMode}
              actions={actions}
              onSelectTeam={onSelectTeam}
            />
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
            const isMyTurnToGuess = queueItem?.status === "waiting" && currentGuesser?.teamId === liveSelf?.id;
            const guesserTeam = state.teams.find((t) => t.id === state.lastGuessResult?.teamId);
            const guesserTeamName = guesserTeam?.name || state.lastGuessResult?.teamName || "Đội chơi";
            const isGuessAuthor = Boolean(state.lastGuessResult?.teamId && state.lastGuessResult.teamId === liveSelf?.id);

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
                      <button type="submit" className="quiz-primary-btn" disabled={!guess.trim()}>
                        Gửi dự đoán <span>→</span>
                      </button>
                      <button type="button" className="quiz-cancel-btn" onClick={() => actions.cancelGuess()}>
                        Hủy
                      </button>
                    </form>
                    <p className="vintage-form-hint">
                      Chỉ có một cơ hội đoán cho mỗi lượt. Hãy cân nhắc kỹ trước khi gửi!
                    </p>
                  </div>
                ) : queueItem?.status === "incorrect" ? (
                  <div className="vintage-result-wrapper">
                    <div className="vintage-status-card">
                      <div className="vintage-seal incorrect">
                        <span>✕</span>
                      </div>
                      <h3 className="vintage-status-title">Dự đoán chưa chính xác</h3>
                      <div className="vintage-divider">✦ ❖ ✦</div>
                      <div className="vintage-status-text">
                        {state.lastGuessResult?.answer && (
                          <p style={{ margin: "0 0 6px", fontSize: "14px", color: "#8b3939" }}>
                            {isGuessAuthor ? (
                              <>
                                <strong>{guesserTeamName} (Bạn)</strong> đã dự đoán: <strong>"{state.lastGuessResult.answer}"</strong>
                              </>
                            ) : (
                              <>
                                Đội <strong>{guesserTeamName}</strong> đã dự đoán: <strong>"{state.lastGuessResult.answer}"</strong>
                              </>
                            )}
                          </p>
                        )}
                        <p style={{ margin: "0 0 6px" }}>
                          Rất tiếc! Đây chưa phải là nhân vật bí ẩn (-1 lượt đoán).
                        </p>
                        {hasTokens ? (
                          <p style={{ margin: "0", color: "#5a5343" }}>
                            {isGuessAuthor ? (
                              <>
                                <strong>{guesserTeamName} (Bạn)</strong> vẫn còn <strong>{tokens} lượt dự đoán</strong>. Hãy bấm nút bên dưới để tiếp tục!
                              </>
                            ) : (
                              <>
                                Đội <strong>{guesserTeamName}</strong> vẫn còn lượt dự đoán.
                              </>
                            )}
                          </p>
                        ) : (
                          <p style={{ margin: "0", color: "#777486" }}>
                            Đội <strong>{guesserTeamName}{isGuessAuthor ? " (Bạn)" : ""}</strong> đã hết lượt dự đoán. Đang chuẩn bị chuyển sang chọn đội tiếp theo…
                          </p>
                        )}
                      </div>
                      <span className="vintage-status-tag">
                        {hasTokens ? `CÒN ${tokens} LƯỢT ĐOÁN` : "CHUYỂN SANG ĐỘI TIẾP THEO"}
                      </span>
                    </div>

                    {hasTokens && (
                      <div className="vintage-retry-action-box">
                        <div className="vintage-retry-info">
                          <span className="retry-lightning">⚡</span>
                          <span><strong>{guesserTeamName}{isGuessAuthor ? " (Bạn)" : ""}</strong> còn <strong>{tokens} lượt đoán</strong></span>
                        </div>
                        <button
                          type="button"
                          className="vintage-retry-btn"
                          onClick={() => actions.requestGuess(liveSelf?.id)}
                        >
                          Dự đoán tiếp ngay <span>→</span>
                        </button>
                      </div>
                    )}
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
                      <span>{state.lastGuessResult && !state.lastGuessResult.isCorrect ? "✕" : "🔍"}</span>
                    </div>
                    <h3 className="vintage-status-title">
                      {state.lastGuessResult && !state.lastGuessResult.isCorrect
                        ? "Dự đoán chưa chính xác"
                        : "Cuộc điều tra đang diễn ra"}
                    </h3>
                    <div className="vintage-divider">✦ ❖ ✦</div>
                    <div className="vintage-status-text">
                      {state.lastGuessResult && !state.lastGuessResult.isCorrect ? (
                        <>
                          <p style={{ margin: "0 0 6px", color: "#8b3939" }}>
                            Đội <strong>{state.lastGuessResult.teamName}</strong> vừa dự đoán:{" "}
                            <em>"{state.lastGuessResult.answer}"</em> nhưng chưa chính xác!
                          </p>
                          <p style={{ margin: "0", color: "#777486" }}>
                            Đang chuẩn bị chuyển lượt…
                          </p>
                        </>
                      ) : (
                        <p style={{ margin: "0" }}>
                          {currentGuesserTeam
                            ? `Đội ${currentGuesserTeam.name} đang tiến hành nhận diện nhà kinh tế học bí ẩn…`
                            : "Các đội trong hàng đợi đang tiến hành gửi câu trả lời…"}
                        </p>
                      )}
                    </div>
                    <span className="vintage-status-tag">
                      {state.lastGuessResult && !state.lastGuessResult.isCorrect ? "DỰ ĐOÁN SAI" : "VÒNG ĐIỀU TRA"}
                    </span>
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
                    : hasTokens
                      ? "Trả lời chưa chính xác: Bạn vẫn có thể dùng lượt đoán đã tích lũy bên dưới!"
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
      {state.phase !== "FINAL_MYSTERY" && state.phase !== "FINAL_CLUE_PHASE" && !(queueItem?.status === "incorrect" && hasTokens) && (
        <div className="puzzle-guess-bar">
        <div className="puzzle-guess-text">
          <strong>
            {state.phase === "ANSWER_RESULT" && !state.lastResult?.isCorrect && hasTokens
              ? "Bạn vẫn có thể dự đoán!"
              : queueItem?.status === "incorrect" && hasTokens
                ? "Vẫn còn lượt dự đoán!"
                : "Đã nhận ra nhân vật?"}
          </strong>
          <p>
            {state.phase === "ANSWER_RESULT" && !state.lastResult?.isCorrect && hasTokens
              ? "Dùng lượt đoán đã tích lũy hoặc chờ hết giờ để chuyển sang đội tiếp theo."
              : queueItem?.status === "incorrect" && hasTokens
                ? "Đội bạn có thể dùng thêm 1 lượt để tiếp tục giải mã nhân vật."
                : "Dùng một lượt đoán hoặc giữ lại cho vòng sau."}
          </p>
        </div>

        <div className="puzzle-guess-actions">
          {state.phase === "ANSWER_RESULT" && isActive && hasTokens ? (
            <>
              <button
                type="button"
                className="puzzle-save-btn"
                onClick={() => {
                  if (!state.lastResult?.isCorrect) return;
                  actions.saveGuess(liveSelf?.id);
                }}
                disabled={!state.lastResult?.isCorrect}
                title={
                  !state.lastResult?.isCorrect
                    ? "Trả lời chưa chính xác nên không có lượt đoán mới để lưu"
                    : "Giữ lượt dự đoán này để sử dụng trong các vòng sau"
                }
              >
                Lưu lượt đoán
              </button>
              <button
                type="button"
                className="puzzle-guess-btn"
                onClick={() => actions.requestGuess(liveSelf?.id)}
              >
                Dự đoán ngay <span>→</span>
              </button>
            </>
          ) : isWaitingInQueue ? (
            <>
              <button type="button" className="puzzle-save-btn" onClick={() => actions.cancelGuess(liveSelf?.id)}>Hủy đăng ký</button>
              <button type="button" className="puzzle-guess-btn queued" disabled>✓ Đã vào hàng đợi</button>
            </>
          ) : (
            <button
              type="button"
              className={`puzzle-guess-btn ${queueItem?.status === "incorrect" && hasTokens ? "retry" : ""}`}
              onClick={() => actions.requestGuess(liveSelf?.id)}
              disabled={!canRequestGuess}
              title={
                !hasTokens
                  ? "Bạn chưa có lượt dự đoán"
                  : !canRequestGuess
                    ? "Hiện không mở đăng ký dự đoán"
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

function FinalMysteryContent({ state, self, adminMode, actions, onSelectTeam }) {
  const fm = state.finalMystery;
  const isRegistration = fm?.subphase === "REGISTRATION";
  const activeTeam = state.teams.find((item) => item.id === state.currentTeamId) || state.teams.find((item) => item.isConnected) || state.teams[0];
  const currentFinalTeam = state.teams.find((item) => item.id === fm?.currentTeamId);
  const effectiveTeam = isRegistration
    ? (self || (adminMode ? activeTeam : null))
    : (adminMode ? currentFinalTeam : self);
  const isRegistered = fm?.registeredTeamIds?.includes(effectiveTeam?.id);
  const hasAnswered = fm?.answeredTeamIds?.includes(effectiveTeam?.id);
  const tokens = state.teams.find((t) => t.id === effectiveTeam?.id)?.guessTokens ?? effectiveTeam?.guessTokens ?? 0;
  const connectedTeams = state.teams.filter((t) => t.isConnected);
  const showingFeedback = Boolean(fm?.feedbackUntil && fm?.lastAttempt && !fm.lastAttempt.isCorrect);

  return (
    <div className="final-right-content">
      {/* Floating Notice at the Very Top */}
      <div className="final-right-notice final-notice-pulse">
        <div className="final-notice-pointer">
          <span className="notice-sparkle">✦</span>
          <span className="notice-pointer-text">CẤP +1 LƯỢT ĐOÁN</span>
          <span className="notice-pointer-arrow">← ⚡</span>
        </div>
        <b>Chưa có đội nào đoán đúng nhân vật.</b>
        <p>
          {fm?.grantedFreeToken
            ? "Tất cả đội đang chơi đã hết lượt, nên mỗi đội được cấp thêm 1 lượt dự đoán miễn phí."
            : "Các đội có lượt dự đoán có thể đăng ký tham gia vòng quyết định."}
        </p>
      </div>

      <span className="final-right-phase">
        {isRegistration
          ? `ĐỌC GỢI Ý & ĐĂNG KÝ — ${fm?.registrationSeconds || 30} GIÂY`
          : `TRẢ LỜI CÂU HỎI — ${fm?.answerSeconds || 20} GIÂY`}
      </span>

      {isRegistration ? (
        <div className="final-right-registration">
          {adminMode ? (
            /* ADMIN VIEW: ACTION BOX FOR SELECTED TEAM + ORDERED REGISTRATION QUEUE */
            <>
              <div className="final-admin-action-card">
                <div className="final-admin-action-header">
                  <div className="final-admin-action-team-info">
                    <span className="final-admin-team-label">CHỌN THAY CHO:</span>
                    <strong className="final-admin-team-title">
                      {effectiveTeam?.name || "Chọn đội ở cột bên trái"}
                    </strong>
                  </div>
                  {effectiveTeam && (
                    <span className="final-admin-token-badge">
                      <i>⚡</i> {tokens} lượt
                    </span>
                  )}
                </div>

                {connectedTeams.length > 1 && (
                  <div className="final-admin-team-chips">
                    {connectedTeams.map((t) => {
                      const isSelected = t.id === effectiveTeam?.id;
                      const isTeamRegistered = fm?.registeredTeamIds?.includes(t.id);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          className={`final-admin-chip ${isSelected ? "selected" : ""} ${isTeamRegistered ? "registered" : ""}`}
                          onClick={() => onSelectTeam && onSelectTeam(t.id)}
                          title={`Nhấn để chọn ${t.name}`}
                        >
                          {t.name}
                          {isTeamRegistered && <span className="chip-badge">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="final-admin-action-body">
                  {effectiveTeam && isRegistered ? (
                    <div className="final-right-registered admin-action-row">
                      <span>✓ {effectiveTeam.name} đã nằm trong hàng đợi.</span>
                      <button
                        type="button"
                        onClick={() => actions.cancelGuess(effectiveTeam.id)}
                      >
                        Hủy đăng ký thay
                      </button>
                    </div>
                  ) : effectiveTeam && tokens > 0 ? (
                    <button
                      type="button"
                      className="final-register-button admin-action-btn"
                      onClick={() => actions.registerFinalMystery(effectiveTeam.id)}
                    >
                      Đăng ký thay cho {effectiveTeam.name} — dùng 1 lượt <span>→</span>
                    </button>
                  ) : effectiveTeam ? (
                    <div className="final-right-unavailable">
                      {effectiveTeam.name} không còn lượt dự đoán để đăng ký.
                    </div>
                  ) : (
                    <div className="final-right-unavailable">
                      Vui lòng chọn một đội ở danh sách bên trái.
                    </div>
                  )}
                </div>
              </div>

              <div className="final-admin-registration-box">
                <div className="final-queue-header">
                  <strong>HÀNG ĐỢI ĐĂNG KÝ THEO THỨ TỰ</strong>
                  <span>{fm?.registeredTeamIds?.length || 0} ĐỘI</span>
                </div>
                {fm?.registeredTeamIds?.length > 0 ? (
                  <ol className="final-registration-list">
                    {fm.registeredTeamIds.map((id, index) => {
                      const t = state.teams.find((team) => team.id === id);
                      return (
                        <li key={id} className="final-registration-item">
                          <span className="order-badge">#{index + 1}</span>
                          <span className="team-name">{t?.name || id}</span>
                          <span className="status-badge">ĐÃ XẾP HÀNG</span>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <div className="final-queue-empty">
                    ⏳ Đang chờ các đội bấm đăng ký trên thiết bị của họ…
                  </div>
                )}
              </div>
            </>
          ) : isRegistered ? (
            <div className="final-right-registered">
              <span>✓ Đội bạn đã đăng ký trả lời.</span>
              <button type="button" onClick={() => actions.cancelGuess(effectiveTeam?.id)}>Hủy đăng ký</button>
            </div>
          ) : tokens > 0 ? (
            <button
              type="button"
              className="final-register-button"
              onClick={() => actions.registerFinalMystery(effectiveTeam?.id)}
            >
              Đăng ký trả lời — dùng 1 lượt <span>→</span>
            </button>
          ) : (
            <div className="final-right-unavailable">
              Đội bạn không còn lượt dự đoán để đăng ký.
            </div>
          )}
          {!adminMode && (
            <p className="final-right-queue">
              Đã đăng ký: {fm?.registeredTeamIds?.map((id) => state.teams.find((team) => team.id === id)?.name).filter(Boolean).join(", ") || "Chưa có đội nào"}
            </p>
          )}
        </div>
      ) : (
        <div className="final-right-answering">
          <div className="final-turn-banner">
            <span>ĐANG ĐẾN LƯỢT</span>
            <b>{currentFinalTeam?.name || "Đang chuyển lượt…"}</b>
            {currentFinalTeam && <em>⚡ {currentFinalTeam.guessTokens} lượt còn lại</em>}
          </div>

          {showingFeedback ? (
            <div className="final-feedback-stage" role="alert" aria-live="assertive" key={fm.lastAttempt.attemptedAt}>
              <span className="final-feedback-cross">✕</span>
              <span className="final-feedback-label">KẾT QUẢ LƯỢT DỰ ĐOÁN</span>
              <h3>Chưa chính xác</h3>
              <p>
                <b>{fm.lastAttempt.teamName || state.teams.find((team) => team.id === fm.lastAttempt.teamId)?.name}</b>
                {" "}đã bị trừ <b>1 lượt dự đoán</b>.
              </p>
              <strong>⚡ Còn {fm.lastAttempt.remainingTokens} lượt dự đoán</strong>
              <small>
                {fm.lastAttempt.continues
                  ? "Đội sẽ được tiếp tục trả lời sau thông báo này."
                  : "Đội đã hết lượt — chuẩn bị chuyển sang đội kế tiếp."}
              </small>
            </div>
          ) : !isRegistered ? (
            <div className="final-right-unavailable">Đội bạn không đăng ký vòng cuối.</div>
          ) : effectiveTeam?.id !== fm?.currentTeamId ? (
            <div className="final-right-unavailable">Chưa đến lượt đội bạn. Vui lòng chờ theo thứ tự đăng ký.</div>
          ) : null}

          <ol className="final-registration-list final-answer-order">
            {fm?.registeredTeamIds?.map((id, index) => {
              const team = state.teams.find((item) => item.id === id);
              const exhausted = fm.answeredTeamIds?.includes(id);
              const current = fm.currentTeamId === id;
              return (
                <li key={id} className={`final-registration-item ${current ? "current" : ""}`}>
                  <span className="order-badge">#{index + 1}</span>
                  <span className="team-name">{team?.name}</span>
                  <span className={`status-badge ${exhausted ? "answered" : current ? "waiting" : ""}`}>
                    {exhausted ? "HẾT LƯỢT" : current ? "ĐANG TRẢ LỜI" : `CÒN ${team?.guessTokens || 0} LƯỢT`}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
