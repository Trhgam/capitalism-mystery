import { describe, expect, it } from "vitest";
import { GameService, PHASES, normalizeGuess } from "../src/game/GameService.js";
import { questions } from "../src/data/questions.js";

const config = { answerSeconds: 20, guessRegistrationSeconds: 6, guessSeconds: 10, finalGuessSeconds: 20 };
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

  it("starts with and allows selecting only connected teams", () => {
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
    expect(game.state.phase).toBe(PHASES.SELECT_NEXT_TEAM);
    expect(() => game.selectNextTeam(first.id, offline.id)).toThrow("mất kết nối");

    game.selectNextTeam(first.id, second.id);
    expect(game.state.currentTeamId).toBe(second.id);
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
    expect(() => game.answer(first.id, correct)).toThrow("Hiện không nhận đáp án");
    expect(question).toBeTruthy();
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

  it("shows an incorrect result briefly, then skips Guess Phase even when a team queued", () => {
    const game = makeGame();
    const first = game.joinTeam("Team 1").team;
    const second = game.joinTeam("Team 2").team;
    game.getTeam(second.id).guessTokens = 1;
    game.start();
    game.requestGuess(second.id);
    const source = questions.find((item) => item.id === game.state.currentQuestionId);
    game.answer(first.id, (source.correctAnswer + 1) % 4);

    expect(game.state.phase).toBe(PHASES.ANSWER_RESULT);
    game.advanceAfterAnswerResult();

    expect(game.state.phase).toBe(PHASES.SELECT_NEXT_TEAM);
    expect(game.state.guessQueue).toHaveLength(0);
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
    expect(game.state.phase).toBe(PHASES.SELECT_NEXT_TEAM);
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

  it("handles saveGuess: goes to SELECT_NEXT_TEAM when queue empty, or GUESS_PHASE when others queued", () => {
    const game = makeGame();
    const first = game.joinTeam("Team 1").team;
    const second = game.joinTeam("Team 2").team;
    game.start();
    const source = questions.find((item) => item.id === game.state.currentQuestionId);
    game.answer(first.id, source.correctAnswer);

    // Active team decides to save token without anyone else in queue
    game.saveGuess(first.id);
    expect(game.state.phase).toBe(PHASES.SELECT_NEXT_TEAM);
    expect(game.getTeam(first.id).guessTokens).toBe(1);

    // Team one selects team two
    game.selectNextTeam(first.id, second.id);
    expect(game.state.phase).toBe(PHASES.ANSWERING);
    expect(game.state.currentTeamId).toBe(second.id);
  });

  it("disallows non-current team or admin from selecting next team", () => {
    const game = makeGame();
    const first = game.joinTeam("Team 1").team;
    const second = game.joinTeam("Team 2").team;
    game.start();
    const source = questions.find((item) => item.id === game.state.currentQuestionId);
    game.answer(first.id, source.correctAnswer);
    game.saveGuess(first.id);

    expect(() => game.selectNextTeam(second.id, first.id)).toThrow("chưa đến lượt");
  });

  it("advances queue immediately after an incorrect character guess", () => {
    const game = makeGame();
    const first = game.joinTeam("Team 1").team;
    const second = game.joinTeam("Team 2").team;
    game.getTeam(first.id).guessTokens = 1;
    game.getTeam(second.id).guessTokens = 1;
    game.start();
    game.requestGuess(first.id);
    game.requestGuess(second.id);
    const source = questions.find((item) => item.id === game.state.currentQuestionId);
    game.answer(first.id, source.correctAnswer);

    game.beginGuessPhase();
    expect(game.state.phase).toBe(PHASES.GUESS_PHASE);

    // First team guesses wrong
    const result1 = game.submitGuess(first.id, "Karl Marx");
    expect(result1.isCorrect).toBe(false);
    expect(game.state.phase).toBe(PHASES.GUESS_PHASE);

    // Second team guesses wrong -> queue now exhausted!
    const result2 = game.submitGuess(second.id, "John Locke");
    expect(result2.isCorrect).toBe(false);
    // Queue is empty -> transitions immediately to SELECT_NEXT_TEAM!
    expect(game.state.phase).toBe(PHASES.SELECT_NEXT_TEAM);
  });

  it("does not open guessing after a wrong answer even when the active team has reserve tokens", () => {
    const game = makeGame();
    const first = game.joinTeam("Team 1").team;
    game.getTeam(first.id).guessTokens = 2; // Has reserve tokens
    game.start();
    const source = questions.find((item) => item.id === game.state.currentQuestionId);
    game.answer(first.id, (source.correctAnswer + 1) % 4); // Answer wrong!

    expect(game.state.phase).toBe(PHASES.ANSWER_RESULT);
    expect(game.state.deadline - Date.now()).toBeGreaterThan(1000);
    expect(game.state.deadline - Date.now()).toBeLessThanOrEqual(2000);
    expect(() => game.requestGuess(first.id)).toThrow("không mở vòng dự đoán");
    game.advanceAfterAnswerResult();
    expect(game.state.phase).toBe(PHASES.SELECT_NEXT_TEAM);
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

    // Because team still has tokens and nobody else is waiting, their turn stays active ("waiting")
    expect(game.state.guessQueue.some((item) => item.teamId === first.id && item.status === "waiting")).toBe(true);

    // Submit second guess correctly!
    const r2 = game.submitGuess(first.id, "Adam Smith");
    expect(r2.isCorrect).toBe(true);
    expect(game.state.phase).toBe(PHASES.FINISHED);
    expect(game.state.winner.teamId).toBe(first.id);
  });

  it("shows wrong-answer feedback before opening SELECT_NEXT_TEAM", () => {
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
    expect(game.state.phase).toBe(PHASES.SELECT_NEXT_TEAM);
  });

  it("triggers FINAL_MYSTERY when 12 pieces completed and grants free token if all teams have 0 tokens", () => {
    const game = makeGame();
    const first = game.joinTeam("Team 1").team;
    const second = game.joinTeam("Team 2").team;
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
});

