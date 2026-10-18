import { describe, expect, it } from "vitest";
import { GameService, PHASES, normalizeGuess } from "../src/game/GameService.js";
import { questions } from "../src/data/questions.js";

const config = { answerSeconds: 20, guessSeconds: 10, finalGuessSeconds: 20 };
const makeGame = () => new GameService({ config });

describe("GameService", () => {
  it("joins unique teams and never exposes session tokens publicly", () => {
    const game = makeGame();
    const joined = game.joinTeam("Invisible Hands");
    expect(joined.sessionToken).toHaveLength(48);
    expect(game.publicState().teams[0].sessionToken).toBeUndefined();
    expect(() => game.joinTeam("invisible hands")).toThrow("Tên đội đã được sử dụng");
  });

  it("allows only the active team to select and answer", () => {
    const game = makeGame();
    const first = game.joinTeam("Team One").team;
    const second = game.joinTeam("Team Two").team;
    game.start();
    expect(() => game.selectQuestion(second.id)).toThrow("chưa đến lượt");
    game.selectQuestion(first.id);
    expect(game.state.phase).toBe(PHASES.ANSWERING);
    expect(() => game.answer(second.id, 0)).toThrow("chưa đến lượt");
  });

  it("awards exactly one token for a correct answer", () => {
    const game = makeGame();
    const first = game.joinTeam("Team One").team;
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
    const first = game.joinTeam("Team One").team;
    game.start();
    game.selectQuestion(first.id);
    const source = questions.find((item) => item.id === game.state.currentQuestionId);
    game.answer(first.id, source.correctAnswer);
    game.requestGuess(first.id);
    game.beginGuessPhase();
    const result = game.submitGuess(first.id, "Adam Smith");
    expect(result.isCorrect).toBe(true);
    expect(game.getTeam(first.id).guessTokens).toBe(0);
    expect(game.state.phase).toBe(PHASES.FINISHED);
  });

  it("preserves the remaining deadline while paused", () => {
    const game = makeGame();
    const first = game.joinTeam("Team One").team;
    game.start();
    game.selectQuestion(first.id);
    game.pause();
    expect(game.state.phase).toBe(PHASES.PAUSED);
    expect(game.state.pausedRemainingMs).toBeGreaterThan(0);
    game.resume();
    expect(game.state.phase).toBe(PHASES.ANSWERING);
    expect(game.state.deadline).toBeGreaterThan(Date.now());
  });
});
