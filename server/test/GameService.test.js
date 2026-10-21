import { describe, expect, it } from "vitest";
import { GameService, PHASES, normalizeGuess } from "../src/game/GameService.js";
import { questions } from "../src/data/questions.js";

const config = { answerSeconds: 20, guessRegistrationSeconds: 6, guessSeconds: 10, finalGuessSeconds: 20, finalRegistrationSeconds: 20, finalAnswerSeconds: 15, finalFeedbackSeconds: 3, antiCheatPauseSeconds: 5 };
const makeGame = () => new GameService({ config });

describe("GameService", () => {
  it("joins unique teams and never exposes session tokens publicly", () => {
    const game = makeGame();
    const joined = game.joinTeam("Team 1");
    expect(joined.sessionToken).toHaveLength(48);
    expect(game.publicState().teams[0].sessionToken).toBeUndefined();
    expect(() => game.joinTeam("team 1")).toThrow("Tên đội đã được sử dụng");
  });

  it("allows a disconnected team name to rejoin and rotates its session token", () => {
    const game = makeGame();
    const firstJoin = game.joinTeam("Team 1");
    game.disconnectTeam(firstJoin.team.id);

    const secondJoin = game.joinTeam("team 1");

    expect(secondJoin.team.id).toBe(firstJoin.team.id);
    expect(secondJoin.team.isConnected).toBe(true);
    expect(secondJoin.sessionToken).not.toBe(firstJoin.sessionToken);
    expect(game.state.teams).toHaveLength(1);
  });

  it("automatically randomizes only among connected teams", () => {
    const game = makeGame();
    const offline = game.joinTeam("Team 1").team;
    const first = game.joinTeam("Team 2").team;
    const second = game.joinTeam("Team 3").team;
    game.disconnectTeam(offline.id);

    game.start();
    expect(game.state.currentTeamId).toBe(first.id);

    const source = questions.find((item) => item.id === game.state.currentQuestionId);
    game.answer(first.id, (source.correctAnswer + 1) % 4);
    game.advanceAfterAnswerResult();
    expect(game.state.phase).toBe(PHASES.ANSWERING);
    expect(game.state.currentTeamId).toBe(second.id);
    expect(game.state.currentTeamId).not.toBe(offline.id);
  });

  it("allows only the active team to select and answer", () => {
    const game = makeGame();
    const first = game.joinTeam("Team 1").team;
    const second = game.joinTeam("Team 2").team;
    game.start();
    expect(() => game.selectQuestion(second.id)).toThrow("chưa đến lượt");
    game.selectQuestion(first.id);
    expect(game.state.phase).toBe(PHASES.ANSWERING);
    expect(() => game.answer(second.id, 0)).toThrow("chưa đến lượt");
  });

  it("awards exactly one token for a correct answer", () => {
    const game = makeGame();
    const first = game.joinTeam("Team 1").team;
    game.start();
    game.selectQuestion(first.id);
    const question = game.publicState().currentQuestion;
    const source = game.state.currentQuestionId;
    const correct = questions.find((item) => item.id === source).correctAnswer;
    game.answer(first.id, correct);
    expect(game.getTeam(first.id).guessTokens).toBe(1);
    expect(game.getTeam(first.id).score).toBeUndefined();
    expect(() => game.answer(first.id, correct)).toThrow("Hiện không nhận đáp án");
    expect(question).toBeTruthy();
  });

  it("keeps portrait-defining pieces 02, 03, 06 and 07 until the final four questions", () => {
    const game = makeGame();
    const team = game.joinTeam("Team 1").team;
    const expectedOrder = [0, 3, 4, 7, 8, 9, 10, 11, 1, 2, 5, 6];
    game.start();

    for (let turn = 0; turn < expectedOrder.length; turn += 1) {
      expect(game.state.currentPieceIndex).toBe(expectedOrder[turn]);
      const question = questions.find((item) => item.id === game.state.currentQuestionId);
      game.answer(team.id, (question.correctAnswer + 1) % 4);
      expect(game.state.lastResult.pieceIndex).toBe(expectedOrder[turn]);
      if (turn < expectedOrder.length - 1) game.advanceAfterAnswerResult();
    }
  });

  it("requires queue membership and consumes a token on submit", () => {
    const game = makeGame();
    const first = game.joinTeam("Team 1").team;
    game.start();
    game.selectQuestion(first.id);
    const source = questions.find((item) => item.id === game.state.currentQuestionId);
    game.answer(first.id, source.correctAnswer);
    game.requestGuess(first.id);
    game.advanceAfterAnswerResult();
    const result = game.submitGuess(first.id, "Adam Smith");
    expect(result.isCorrect).toBe(true);
    expect(game.getTeam(first.id).guessTokens).toBe(0);
    expect(game.state.phase).toBe(PHASES.FINISHED);
  });

  it("does not allow teams to enter Guess Queue before the question is answered correctly", () => {
    const game = makeGame();
    const first = game.joinTeam("Team 1").team;
    const second = game.joinTeam("Team 2").team;
    game.getTeam(second.id).guessTokens = 1;
    game.start();
    expect(() => game.requestGuess(second.id)).toThrow("sau khi câu hỏi kết thúc");
    const source = questions.find((item) => item.id === game.state.currentQuestionId);
    game.answer(first.id, (source.correctAnswer + 1) % 4);

    expect(game.state.phase).toBe(PHASES.ANSWER_RESULT);
    expect(game.state.lastResult.isCorrect).toBe(false);

    // Team 2 has 1 token and must be allowed to request guess even though Team 1 answered incorrectly!
    expect(() => game.requestGuess(second.id)).not.toThrow();
    expect(game.state.guessQueue).toHaveLength(1);
    expect(game.state.guessQueue[0].teamId).toBe(second.id);

    game.advanceAfterAnswerResult();

    expect(game.state.phase).toBe(PHASES.GUESS_PHASE);
    expect(game.state.guessQueue[0].teamId).toBe(second.id);
  });

  it("opens Guess Phase after a correct answer only when the queue has a team", () => {
    const game = makeGame();
    const first = game.joinTeam("Team 1").team;
    game.start();
    game.selectQuestion(first.id);
    const source = questions.find((item) => item.id === game.state.currentQuestionId);
    game.answer(first.id, source.correctAnswer);

    expect(game.state.deadline - Date.now()).toBeGreaterThan(5000);
    game.requestGuess(first.id);
    game.advanceAfterAnswerResult();

    expect(game.state.phase).toBe(PHASES.GUESS_PHASE);
    expect(game.state.guessQueue).toHaveLength(1);
    expect(game.state.guessQueue[0].teamId).toBe(first.id);
  });

  it("skips an empty Guess Queue after a correct answer", () => {
    const game = makeGame();
    const first = game.joinTeam("Team 1").team;
    game.start();
    game.selectQuestion(first.id);
    const source = questions.find((item) => item.id === game.state.currentQuestionId);
    game.answer(first.id, source.correctAnswer);
    game.advanceAfterAnswerResult();
    expect(game.state.phase).toBe(PHASES.ANSWERING);
    expect(game.state.currentTeamId).toBe(first.id);
  });

  it("preserves the remaining deadline while paused", () => {
    const game = makeGame();
    const first = game.joinTeam("Team 1").team;
    game.start();
    game.selectQuestion(first.id);
    game.pause();
    expect(game.state.phase).toBe(PHASES.PAUSED);
    expect(game.state.pausedRemainingMs).toBeGreaterThan(0);
    game.resume();
    expect(game.state.phase).toBe(PHASES.ANSWERING);
    expect(game.state.deadline).toBeGreaterThan(Date.now());
  });

  it("temporarily pauses everyone after a suspicious capture report and resumes automatically", () => {
    const game = makeGame();
    const first = game.joinTeam("Team 1").team;
    game.start();
    const phaseBefore = game.state.phase;

    const result = game.reportSuspiciousCapture(first.id, "windows-shift-s");
    expect(result).toMatchObject({ paused: true, pauseSeconds: 5 });
    expect(game.state.phase).toBe(PHASES.PAUSED);
    expect(game.state.antiCheatAlert).toMatchObject({ teamName: "Team 1", method: "windows-shift-s" });

    game.state.antiCheatAlert.resumeAt = Date.now() - 1;
    game.tick();
    expect(game.state.phase).toBe(phaseBefore);
    expect(game.state.antiCheatAlert).toBeNull();
    expect(game.state.deadline).toBeGreaterThan(Date.now());
  });

  it("randomizes the next connected team when a saved guess leaves the queue empty", () => {
    const game = makeGame();
    const first = game.joinTeam("Team 1").team;
    const second = game.joinTeam("Team 2").team;
    game.start();
    const source = questions.find((item) => item.id === game.state.currentQuestionId);
    game.answer(first.id, source.correctAnswer);

    // Active team decides to save token without anyone else in queue
    game.saveGuess(first.id);
    expect(game.state.phase).toBe(PHASES.ANSWERING);
    expect(game.getTeam(first.id).guessTokens).toBe(1);
    expect(game.state.currentTeamId).toBe(second.id);
  });

  it("does not allow a client to manually select the next team", () => {
    const game = makeGame();
    const first = game.joinTeam("Team 1").team;
    const second = game.joinTeam("Team 2").team;
    game.start();
    const source = questions.find((item) => item.id === game.state.currentQuestionId);
    game.answer(first.id, source.correctAnswer);
    game.saveGuess(first.id);

    expect(() => game.selectNextTeam(second.id, first.id)).toThrow("tự chọn ngẫu nhiên");
  });

  it("disallows saveGuess when question was answered incorrectly", () => {
    const game = makeGame();
    const first = game.joinTeam("Team 1").team;
    game.getTeam(first.id).guessTokens = 2;
    game.start();
    const source = questions.find((item) => item.id === game.state.currentQuestionId);
    game.answer(first.id, (source.correctAnswer + 1) % 4);

    expect(game.state.phase).toBe(PHASES.ANSWER_RESULT);
    expect(game.state.lastResult.isCorrect).toBe(false);
    expect(() => game.saveGuess(first.id)).not.toThrow();
    expect(game.state.phase).toBe(PHASES.ANSWER_RESULT);
  });

  it("advances queue immediately after an incorrect character guess", () => {
    const game = makeGame();
    const first = game.joinTeam("Team 1").team;
    const second = game.joinTeam("Team 2").team;
    game.getTeam(first.id).guessTokens = 1;
    game.getTeam(second.id).guessTokens = 1;
    game.start();
    const source = questions.find((item) => item.id === game.state.currentQuestionId);
    game.answer(first.id, source.correctAnswer);
    game.requestGuess(first.id);
    game.requestGuess(second.id);
    expect(game.state.phase).toBe(PHASES.GUESS_PHASE);

    // First team guesses wrong
    const result1 = game.submitGuess(first.id, "Karl Marx");
    expect(result1.isCorrect).toBe(false);
    expect(game.state.phase).toBe(PHASES.GUESS_PHASE);

    // Second team guesses wrong -> shows incorrect feedback!
    const result2 = game.submitGuess(second.id, "John Locke");
    expect(result2.isCorrect).toBe(false);
    expect(game.state.phase).toBe(PHASES.GUESS_PHASE);
    // After feedback window expires -> a connected team is randomized immediately.
    game.endGuessPhase();
    expect(game.state.phase).toBe(PHASES.ANSWERING);
  });

  it("allows guessing after a wrong answer when the active team has reserve tokens", () => {
    const game = makeGame();
    const first = game.joinTeam("Team 1").team;
    game.getTeam(first.id).guessTokens = 2; // Has reserve tokens
    game.start();
    const source = questions.find((item) => item.id === game.state.currentQuestionId);
    game.answer(first.id, (source.correctAnswer + 1) % 4); // Answer wrong!

    expect(game.state.phase).toBe(PHASES.ANSWER_RESULT);
    expect(game.state.deadline - Date.now()).toBeGreaterThan(2000);
    expect(() => game.requestGuess(first.id)).not.toThrow();
    expect(game.state.phase).toBe(PHASES.GUESS_PHASE);
    expect(game.getTeam(first.id).guessTokens).toBe(2);
  });

  it("allows a team with multiple tokens to continue guessing if queue empty, or re-queue if others waiting", () => {
    const game = makeGame();
    const first = game.joinTeam("Team 1").team;
    game.getTeam(first.id).guessTokens = 2; // 2 tokens
    game.start();
    const source = questions.find((item) => item.id === game.state.currentQuestionId);
    game.answer(first.id, source.correctAnswer); // +1 token -> 3 tokens

    // First request
    game.requestGuess(first.id);
    expect(game.state.phase).toBe(PHASES.GUESS_PHASE);

    // First guess wrong
    const r1 = game.submitGuess(first.id, "Karl Marx");
    expect(r1.isCorrect).toBe(false);
    expect(game.getTeam(first.id).guessTokens).toBe(2);

    // Shows incorrect status for feedback window
    expect(game.state.guessQueue.some((item) => item.teamId === first.id && item.status === "incorrect")).toBe(true);

    // Team can request guess again immediately with remaining tokens
    game.requestGuess(first.id);
    expect(game.state.guessQueue.some((item) => item.teamId === first.id && item.status === "waiting")).toBe(true);

    // Submit second guess correctly!
    const r2 = game.submitGuess(first.id, "Adam Smith");
    expect(r2.isCorrect).toBe(true);
    expect(game.state.phase).toBe(PHASES.FINISHED);
    expect(game.state.winner.teamId).toBe(first.id);
  });

  it("allows a queued team to cancel without consuming its token", () => {
    const game = makeGame();
    const first = game.joinTeam("Team 1").team;
    game.start();
    const source = questions.find((item) => item.id === game.state.currentQuestionId);
    game.answer(first.id, source.correctAnswer);
    game.requestGuess(first.id);

    expect(game.state.phase).toBe(PHASES.GUESS_PHASE);
    expect(game.state.guessQueue).toHaveLength(1);
    game.cancelGuess(first.id);

    expect(game.state.phase).toBe(PHASES.ANSWERING);
    expect(game.state.guessQueue).toHaveLength(0);
    expect(game.getTeam(first.id).guessTokens).toBe(1);
  });

  it("shows wrong-answer feedback before randomizing the next team", () => {
    const game = makeGame();
    const first = game.joinTeam("Team 1").team;
    const second = game.joinTeam("Team 2").team;
    game.start();
    const source = questions.find((item) => item.id === game.state.currentQuestionId);
    // Answer wrong with 0 tokens and no one else has tokens
    game.answer(first.id, (source.correctAnswer + 1) % 4);

    expect(game.state.phase).toBe(PHASES.ANSWER_RESULT);
    expect(game.state.lastResult.isCorrect).toBe(false);
    game.advanceAfterAnswerResult();
    expect(game.state.phase).toBe(PHASES.ANSWERING);
    expect(game.state.currentTeamId).toBe(second.id);
  });

  it("triggers FINAL_MYSTERY when 12 pieces completed and grants free token if all teams have 0 tokens", () => {
    const game = makeGame();
    const first = game.joinTeam("Team 1").team;
    const second = game.joinTeam("Team 2").team;
    const offline = game.joinTeam("Team 3").team;
    game.getTeam(offline.id).guessTokens = 5;
    game.disconnectTeam(offline.id);
    // Mark 11 pieces as locked
    for (let i = 0; i < 11; i++) {
      game.state.puzzle[i].status = "locked";
    }
    game.start();
    const source = questions.find((item) => item.id === game.state.currentQuestionId);
    // First answers 12th piece wrong with 0 tokens
    game.answer(first.id, (source.correctAnswer + 1) % 4);
    game.advanceAfterAnswerResult();

    // All 12 pieces are locked and everyone had 0 tokens
    // Game must enter FINAL_MYSTERY and grant 1 free Final Chance Token to each team!
    expect(game.state.phase).toBe(PHASES.FINAL_MYSTERY);
    expect(game.state.finalMystery.subphase).toBe("REGISTRATION");
    expect(game.getTeam(first.id).guessTokens).toBe(1);
    expect(game.getTeam(second.id).guessTokens).toBe(1);
    expect(game.getTeam(first.id).grantedFinalChance).toBe(true);
    expect(game.getTeam(second.id).grantedFinalChance).toBe(true);
    expect(game.getTeam(offline.id).guessTokens).toBe(5);
    expect(game.getTeam(offline.id).grantedFinalChance).toBe(false);
    expect(game.state.finalMystery.grantedFreeToken).toBe(true);
    expect(game.state.deadline - Date.now()).toBeGreaterThan(19000);

    // Second team registers in 10s window
    game.registerFinalMystery(second.id);
    expect(game.state.finalMystery.registeredTeamIds).toContain(second.id);

    // 10s expires -> transitions to ANSWERING (15s)
    game.advanceFinalMysteryToAnswering();
    expect(game.state.finalMystery.subphase).toBe("ANSWERING");

    // Second team answers Adam Smith correctly (option 0)
    const result = game.answerFinalMystery(second.id, 0);
    expect(result.isCorrect).toBe(true);
    expect(game.state.phase).toBe(PHASES.FINISHED);
    expect(game.state.winner.teamId).toBe(second.id);
    expect(game.state.puzzle.every((p) => p.status === "revealed")).toBe(true);
  });

  it("runs Final Mystery in queue order and lets each team use every remaining token", () => {
    const game = makeGame();
    const first = game.joinTeam("Team 1").team;
    const second = game.joinTeam("Team 2").team;
    game.getTeam(first.id).guessTokens = 1;
    game.getTeam(second.id).guessTokens = 2;

    game.startFinalMystery();
    expect(game.state.finalMystery.grantedFreeToken).toBe(false);
    expect(game.getTeam(first.id).guessTokens).toBe(1);
    expect(game.getTeam(second.id).guessTokens).toBe(2);

    game.registerFinalMystery(first.id);
    game.registerFinalMystery(second.id);
    game.advanceFinalMysteryToAnswering();
    expect(game.state.finalMystery.currentTeamId).toBe(first.id);
    expect(() => game.answerFinalMystery(second.id, 1)).toThrow("Chưa đến lượt");

    game.answerFinalMystery(first.id, 1);
    expect(game.getTeam(first.id).guessTokens).toBe(0);
    expect(game.state.phase).toBe(PHASES.FINAL_MYSTERY);
    expect(game.state.finalMystery.currentTeamId).toBe(first.id);
    expect(game.state.finalMystery.feedbackUntil).toBeGreaterThan(Date.now());
    expect(() => game.answerFinalMystery(first.id, 2)).toThrow("Đang hiển thị kết quả");
    game.completeFinalMysteryFeedback();
    expect(game.state.finalMystery.currentTeamId).toBe(second.id);

    game.answerFinalMystery(second.id, 1);
    expect(game.getTeam(second.id).guessTokens).toBe(1);
    expect(game.state.finalMystery.currentTeamId).toBe(second.id);
    expect(game.state.finalMystery.lastAttempt).toMatchObject({
      teamId: second.id,
      teamName: "Team 2",
      isCorrect: false,
      remainingTokens: 1,
      continues: true,
    });
    game.completeFinalMysteryFeedback();
    expect(game.state.finalMystery.currentTeamId).toBe(second.id);
    expect(game.state.finalMystery.feedbackUntil).toBeNull();

    game.answerFinalMystery(second.id, 2);
    expect(game.getTeam(second.id).guessTokens).toBe(0);
    expect(game.state.phase).toBe(PHASES.FINAL_MYSTERY);
    game.completeFinalMysteryFeedback();
    expect(game.state.phase).toBe(PHASES.FINISHED);
    expect(game.state.winner).toBeNull();
  });

  it("finishes with no winner after 5s countdown when 12 pieces are opened and nobody registers in FINAL_MYSTERY", () => {
    const game = makeGame();
    const first = game.joinTeam("Team 1").team;
    const second = game.joinTeam("Team 2").team;
    for (let i = 0; i < 11; i++) {
      game.state.puzzle[i].status = "locked";
    }
    game.start();
    const source = questions.find((item) => item.id === game.state.currentQuestionId);
    game.answer(first.id, (source.correctAnswer + 1) % 4);
    game.advanceAfterAnswerResult();

    expect(game.state.phase).toBe(PHASES.FINAL_MYSTERY);
    // Nobody registers, 10s expires -> directly finishes with no winner (portrait kept veiled until admin reveals)
    game.advanceFinalMysteryToAnswering();
    expect(game.state.phase).toBe(PHASES.FINISHED);
    expect(game.state.winner).toBeNull();
    expect(game.state.mysteryRevealed).toBe(false);

    // Only when admin clicks reveal does it reveal portrait and answer
    game.revealMystery();
    expect(game.state.mysteryRevealed).toBe(true);
    expect(game.state.revealedAnswer).toBe("Adam Smith");
    expect(game.state.puzzle.every((p) => p.status === "revealed")).toBe(true);
  });

  it("allows admin to reveal mystery and answer at any time", () => {
    const game = makeGame();
    game.joinTeam("Team 1");
    game.start();
    expect(game.state.mysteryRevealed).toBe(false);

    game.revealMystery();
    expect(game.state.phase).toBe(PHASES.FINISHED);
    expect(game.state.mysteryRevealed).toBe(true);
    expect(game.state.revealedAnswer).toBe("Adam Smith");
    expect(game.state.puzzle.every((p) => p.status === "revealed")).toBe(true);
  });

  it("allows a team with saved tokens to request guess after answering incorrectly", () => {
    const game = makeGame();
    const first = game.joinTeam("Team 1").team;
    const second = game.joinTeam("Team 2").team;
    game.getTeam(second.id).guessTokens = 1; // Team 2 has a saved token
    game.start();

    // Round 1: first answers correctly and saves token
    let q = questions.find((item) => item.id === game.state.currentQuestionId);
    game.answer(first.id, q.correctAnswer);
    expect(game.getTeam(first.id).guessTokens).toBe(1);
    game.saveGuess(first.id);
    expect(game.state.phase).toBe(PHASES.ANSWERING);
    expect(game.state.currentTeamId).toBe(second.id);

    // Round 2: Team 2 answers incorrectly
    q = questions.find((item) => item.id === game.state.currentQuestionId);
    game.answer(second.id, (q.correctAnswer + 1) % 4);
    expect(game.state.phase).toBe(PHASES.ANSWER_RESULT);
    expect(game.state.lastResult.isCorrect).toBe(false);
    expect(game.getTeam(second.id).guessTokens).toBe(1);

    // Team 2 (active team) still has 1 token and requests guess -> must NOT throw, must enter GUESS_PHASE immediately!
    expect(() => game.requestGuess(second.id)).not.toThrow();
    expect(game.state.phase).toBe(PHASES.GUESS_PHASE);
    expect(game.state.guessQueue[0].teamId).toBe(second.id);

    // Team 2 submits guess
    const result = game.submitGuess(second.id, "Adam Smith");
    expect(result.isCorrect).toBe(true);
    expect(game.state.phase).toBe(PHASES.FINISHED);
    expect(game.state.winner.teamName).toBe("Team 2");
  });

  it("evaluates single-character guesses normally and only rejects empty inputs", () => {
    const game = makeGame();
    const first = game.joinTeam("Team 1").team;
    game.getTeam(first.id).guessTokens = 2;
    game.start();
    const source = questions.find((item) => item.id === game.state.currentQuestionId);
    game.answer(first.id, source.correctAnswer);
    game.requestGuess(first.id);
    game.advanceAfterAnswerResult();

    // Empty guess or whitespace should be rejected
    expect(() => game.submitGuess(first.id, "")).toThrow("Vui lòng nhập tên nhân vật dự đoán.");
    expect(() => game.submitGuess(first.id, "   ")).toThrow("Vui lòng nhập tên nhân vật dự đoán.");

    // Single character guess e.g. "g" must NOT throw an error; it should be evaluated as an incorrect guess!
    const result = game.submitGuess(first.id, "g");
    expect(result.isCorrect).toBe(false);
    expect(game.getTeam(first.id).guessTokens).toBe(2); // Started with 2 + 1 (correct answer) = 3; after guess = 2
    expect(game.state.lastGuessResult.answer).toBe("g");
  });
});


