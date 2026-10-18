import { useState } from "react";
import { Countdown } from "./Countdown.jsx";

export function GamePanel({ state, self, adminMode, actions }) {
  const [guess, setGuess] = useState("");
  const activeTeam = state.teams.find((item) => item.id === state.currentTeamId);
  const isActive = self?.id === state.currentTeamId;
  const queueItem = state.guessQueue.find((item) => item.teamId === self?.id);

  const submitGuess = async (event) => {
    event.preventDefault();
    if (!guess.trim()) return;
    await actions.submitGuess(guess);
    setGuess("");
  };

  const isAnsweringOrResult = ["ANSWERING", "ANSWER_RESULT"].includes(state.phase);

  return (
    <section className="quiz-card-panel">
      {/* Top Header of the Question Card */}
      <div className="quiz-card-header">
        <div className="quiz-meta-left">
          <span className="quiz-category-tag">
            {state.currentQuestion?.category || (state.phase === "SELECT_QUESTION" ? "CHUẨN BỊ" : "CÂU HỎI")}
          </span>
          <span className="quiz-team-turn">
            CÂU HỎI CHO {activeTeam?.name || "ĐỘI CHƠI"}
          </span>
        </div>

        <div className="quiz-meta-right">
          <Countdown deadline={state.deadline} serverNow={state.serverNow} />
        </div>
      </div>

      {/* Main Content Body based on Phase */}
      <div className="quiz-card-body">
        {/* Phase: SELECT_QUESTION */}
        {state.phase === "SELECT_QUESTION" && (
          <div className="quiz-prompt-state">
            <h2 className="quiz-question-title">
              {isActive ? "Đến lượt đội bạn rút câu hỏi" : `Đang chờ ${activeTeam?.name || "đội chơi"} rút câu hỏi…`}
            </h2>
            <div className="quiz-action-container">
              {isActive ? (
                <button
                  type="button"
                  className="quiz-primary-btn"
                  onClick={actions.selectQuestion}
                >
                  Rút câu hỏi ngẫu nhiên <span>→</span>
                </button>
              ) : (
                <div className="quiz-waiting-text">
                  Hệ thống sẽ chuyển sang phần câu hỏi ngay khi đội trưởng kích hoạt.
                </div>
              )}
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
                className={`quiz-result-alert ${
                  state.lastResult?.isCorrect ? "success" : "failure"
                }`}
              >
                {state.lastResult?.isCorrect
                  ? "✓ Chính xác! +1 lượt đoán và mảnh ghép đã mở."
                  : state.lastResult?.timedOut
                  ? "✕ Hết giờ! Mảnh ghép đã bị khóa."
                  : "✕ Chưa chính xác! Mảnh ghép đã bị khóa."}
              </div>
            )}
          </>
        )}

        {/* Phase: GUESS_PHASE */}
        {state.phase === "GUESS_PHASE" && (
          <div className="quiz-guess-state">
            <h2 className="quiz-question-title">
              {state.finalGuess
                ? "Cơ hội đoán cuối cùng"
                : "Ai là nhà kinh tế học bí ẩn?"}
            </h2>
            {queueItem?.status === "waiting" ? (
              <form onSubmit={submitGuess} className="guess-submit-form">
                <input
                  type="text"
                  value={guess}
                  onChange={(e) => setGuess(e.target.value)}
                  placeholder="Nhập tên nhà kinh tế học…"
                  autoFocus
                  className="guess-input"
                />
                <button type="submit" className="quiz-primary-btn">
                  Gửi dự đoán <span>→</span>
                </button>
              </form>
            ) : (
              <p className="guess-status-desc">
                {queueItem
                  ? `Trạng thái: ${queueItem.status}`
                  : "Chỉ các đội đã đăng ký hàng đợi mới được gửi dự đoán."}
              </p>
            )}
          </div>
        )}

        {/* Phase: SELECT_NEXT_TEAM */}
        {state.phase === "SELECT_NEXT_TEAM" && (
          <div className="quiz-next-team-state">
            <h2 className="quiz-question-title">Chọn đội chơi tiếp theo</h2>
            {isActive || adminMode ? (
              <div className="next-team-grid">
                {state.teams
                  .filter(
                    (team) =>
                      team.id !== state.currentTeamId || state.teams.length === 1
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
              <p className="quiz-waiting-text">Đội vừa chơi đang chọn đội tiếp theo…</p>
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

      {/* Helper Footer Note */}
      <div className="quiz-card-footer">
        <p className="quiz-helper-note">
          {state.phase === "ANSWERING"
            ? "Đội hiện tại trả lời câu hỏi. Sau đó hệ thống sẽ cho phép chọn đội tiếp theo."
            : state.phase === "SELECT_QUESTION"
            ? "Đội đang chơi sẽ rút câu hỏi ngẫu nhiên từ ngân hàng câu hỏi."
            : state.phase === "ANSWER_RESULT"
            ? "Đang ghi nhận kết quả và mở/khóa mảnh ghép tương ứng."
            : state.phase === "GUESS_PHASE"
            ? "Các đội trong hàng đợi có cơ hội đoán tên nhà kinh tế học."
            : "Hệ thống đang chuẩn bị cho vòng tiếp theo."}
        </p>
      </div>
    </section>
  );
}
