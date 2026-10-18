import { randomBytes, randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { questions } from "../data/questions.js";

export const PHASES = Object.freeze({
  LOBBY: "LOBBY",
  SELECT_QUESTION: "SELECT_QUESTION",
  ANSWERING: "ANSWERING",
  ANSWER_RESULT: "ANSWER_RESULT",
  GUESS_PHASE: "GUESS_PHASE",
  SELECT_NEXT_TEAM: "SELECT_NEXT_TEAM",
  FINISHED: "FINISHED",
  PAUSED: "PAUSED",
});

const cleanName = (value) => value.trim().replace(/\s+/g, " ");
export const normalizeGuess = (value) => cleanName(value).toLocaleLowerCase("vi").replace(/[.]/g, "");

const makeInitialState = () => ({
  id: randomUUID(),
  phase: PHASES.LOBBY,
  phaseBeforePause: null,
  pausedRemainingMs: null,
  teams: [],
  currentTeamId: null,
  currentQuestionId: null,
  usedQuestionIds: [],
  lastResult: null,
  puzzle: Array.from({ length: 12 }, (_, index) => ({ index, status: "hidden", resolvedByTeamId: null })),
  guessQueue: [],
  winner: null,
  roundNumber: 0,
  deadline: null,
  finalGuess: false,
  createdAt: new Date().toISOString(),
});

export class GameService extends EventEmitter {
  constructor({ persistence, config, initialState } = {}) {
    super();
    this.persistence = persistence;
    this.config = config;
    this.state = initialState || persistence?.load() || makeInitialState();
  }

  commit(eventType, teamId = null, payload = {}) {
    this.persistence?.save(this.state);
    this.persistence?.event(eventType, teamId, payload);
    this.emit("changed", this.publicState());
  }

  publicState() {
    const question = questions.find((item) => item.id === this.state.currentQuestionId);
    return {
      ...structuredClone(this.state),
      teams: this.state.teams.map(({ sessionToken: _sessionToken, ...team }) => team),
      currentQuestion: question ? { id: question.id, text: question.text, options: question.options, category: question.category } : null,
      serverNow: Date.now(),
    };
  }

  joinTeam(rawName) {
    if (this.state.phase !== PHASES.LOBBY) throw new Error("Trận đấu đã bắt đầu.");
    const name = cleanName(rawName);
    if (name.length < 2 || name.length > 24) throw new Error("Tên đội phải có từ 2 đến 24 ký tự.");
    if (this.state.teams.length >= 7) throw new Error("Phòng đã đủ 7 đội.");
    if (this.state.teams.some((team) => team.name.toLowerCase() === name.toLowerCase())) throw new Error("Tên đội đã được sử dụng.");

    const team = {
      id: randomUUID(),
      name,
      sessionToken: randomBytes(24).toString("hex"),
      guessTokens: 0,
      score: 0,
      isConnected: true,
      joinedAt: new Date().toISOString(),
    };
    this.state.teams.push(team);
    this.commit("team.join", team.id, { name });
    return { team: { ...team, sessionToken: undefined }, sessionToken: team.sessionToken };
  }

  resumeTeam(token) {
    const team = this.state.teams.find((item) => item.sessionToken === token);
    if (!team) throw new Error("Phiên đội không hợp lệ hoặc đã hết hạn.");
    team.isConnected = true;
    this.commit("team.resume", team.id);
    return team;
  }

  disconnectTeam(teamId) {
    const team = this.getTeam(teamId);
    if (!team) return;
    team.isConnected = false;
    this.commit("team.disconnect", teamId);
  }

  getTeam(teamId) {
    return this.state.teams.find((team) => team.id === teamId);
  }

  requireTeam(teamId) {
    const team = this.getTeam(teamId);
    if (!team) throw new Error("Không tìm thấy đội.");
    return team;
  }

  requireCurrentTeam(teamId) {
    this.requireTeam(teamId);
    if (this.state.currentTeamId !== teamId) throw new Error("Đội của bạn chưa đến lượt.");
  }

  start() {
    if (this.state.phase !== PHASES.LOBBY) throw new Error("Trận đấu không ở trạng thái chờ.");
    if (this.state.teams.length < 1) throw new Error("Cần ít nhất một đội để bắt đầu.");
    this.state.currentTeamId = this.state.teams[0].id;
    this.state.phase = PHASES.SELECT_QUESTION;
    this.state.roundNumber = 1;
    this.commit("game.start");
  }

  selectQuestion(teamId) {
    this.requireCurrentTeam(teamId);
    if (this.state.phase !== PHASES.SELECT_QUESTION) throw new Error("Hiện không thể rút câu hỏi.");
    const available = questions.filter((item) => !this.state.usedQuestionIds.includes(item.id));
    if (!available.length) throw new Error("Ngân hàng câu hỏi đã hết.");
    const question = available[Math.floor(Math.random() * available.length)];
    this.state.currentQuestionId = question.id;
    this.state.usedQuestionIds.push(question.id);
    this.state.phase = PHASES.ANSWERING;
    this.state.lastResult = null;
    this.state.deadline = Date.now() + this.config.answerSeconds * 1000;
    this.commit("question.select", teamId, { questionId: question.id });
  }

  answer(teamId, optionIndex) {
    this.requireCurrentTeam(teamId);
    if (this.state.phase !== PHASES.ANSWERING) throw new Error("Hiện không nhận đáp án.");
    if (Date.now() > this.state.deadline) return this.resolveAnswer(null, true);
    if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex > 3) throw new Error("Đáp án không hợp lệ.");
    return this.resolveAnswer(optionIndex, false);
  }

  resolveAnswer(optionIndex, timedOut) {
    if (this.state.phase !== PHASES.ANSWERING) return;
    const question = questions.find((item) => item.id === this.state.currentQuestionId);
    const team = this.requireTeam(this.state.currentTeamId);
    const isCorrect = !timedOut && optionIndex === question.correctAnswer;
    const piece = this.state.puzzle.find((item) => item.status === "hidden");
    if (piece) {
      piece.status = isCorrect ? "revealed" : "locked";
      piece.resolvedByTeamId = team.id;
    }
    if (isCorrect) {
      team.guessTokens += 1;
      team.score += 100;
    }
    this.state.lastResult = { isCorrect, timedOut, correctAnswer: question.correctAnswer, teamId: team.id, pieceIndex: piece?.index ?? null };
    this.state.phase = PHASES.ANSWER_RESULT;
    this.state.deadline = Date.now() + 2500;
    this.commit("question.result", team.id, { isCorrect, timedOut });
    return this.state.lastResult;
  }

  requestGuess(teamId) {
    const team = this.requireTeam(teamId);
    if (![PHASES.ANSWERING, PHASES.ANSWER_RESULT].includes(this.state.phase)) throw new Error("Chỉ đăng ký đoán trong thời gian trả lời hoặc xem kết quả.");
    if (team.guessTokens < 1) throw new Error("Đội chưa có Guess Token.");
    if (this.state.guessQueue.some((item) => item.teamId === teamId)) throw new Error("Đội đã có trong hàng đợi.");
    this.state.guessQueue.push({ teamId, requestedAt: new Date().toISOString(), status: "waiting" });
    this.commit("guess.request", teamId);
  }

  beginGuessPhase() {
    if (this.state.phase !== PHASES.ANSWER_RESULT) return;
    this.state.phase = PHASES.GUESS_PHASE;
    this.state.finalGuess = this.state.puzzle.every((piece) => piece.status !== "hidden");
    const seconds = this.state.finalGuess ? this.config.finalGuessSeconds : this.config.guessSeconds;
    this.state.deadline = Date.now() + seconds * 1000;
    this.commit("guess.begin", null, { finalGuess: this.state.finalGuess });
  }

  submitGuess(teamId, rawAnswer) {
    const team = this.requireTeam(teamId);
    if (this.state.phase !== PHASES.GUESS_PHASE || Date.now() > this.state.deadline) throw new Error("Guess Phase đã đóng.");
    const queueItem = this.state.guessQueue.find((item) => item.teamId === teamId);
    if (!queueItem) throw new Error("Đội chưa đăng ký Guess Queue.");
    if (queueItem.status !== "waiting") throw new Error("Đội đã gửi dự đoán trong lượt này.");
    if (team.guessTokens < 1) throw new Error("Đội không còn Guess Token.");
    const answer = normalizeGuess(rawAnswer);
    if (answer.length < 2 || answer.length > 60) throw new Error("Tên nhân vật không hợp lệ.");

    team.guessTokens -= 1;
    const accepted = new Set(["adam smith", "smith", "a smith"]);
    const isCorrect = accepted.has(answer);
    queueItem.status = isCorrect ? "winner" : "incorrect";
    queueItem.submittedAt = new Date().toISOString();
    if (isCorrect) {
      this.state.winner = { teamId, teamName: team.name, answeredAt: queueItem.submittedAt, answer: "Adam Smith" };
      this.state.phase = PHASES.FINISHED;
      this.state.deadline = null;
      this.state.puzzle.forEach((piece) => { piece.status = "revealed"; });
    }
    this.commit("guess.submit", teamId, { isCorrect });
    return { isCorrect };
  }

  endGuessPhase() {
    if (this.state.phase !== PHASES.GUESS_PHASE) return;
    if (this.state.finalGuess) {
      this.state.phase = PHASES.FINISHED;
      this.state.deadline = null;
      this.commit("game.finished", null, { noWinner: true });
      return;
    }
    this.state.phase = PHASES.SELECT_NEXT_TEAM;
    this.state.deadline = null;
    this.commit("guess.end");
  }

  selectNextTeam(actorTeamId, nextTeamId, isAdmin = false) {
    if (this.state.phase !== PHASES.SELECT_NEXT_TEAM) throw new Error("Chưa đến bước chọn đội tiếp theo.");
    if (!isAdmin) this.requireCurrentTeam(actorTeamId);
    this.requireTeam(nextTeamId);
    if (nextTeamId === this.state.currentTeamId && this.state.teams.length > 1) throw new Error("Không thể chọn chính đội mình liên tiếp.");
    this.state.currentTeamId = nextTeamId;
    this.state.currentQuestionId = null;
    this.state.guessQueue = [];
    this.state.lastResult = null;
    this.state.finalGuess = false;
    this.state.roundNumber += 1;
    this.state.phase = PHASES.SELECT_QUESTION;
    this.commit("turn.next", nextTeamId);
  }

  pause() {
    if ([PHASES.LOBBY, PHASES.FINISHED, PHASES.PAUSED].includes(this.state.phase)) throw new Error("Không thể tạm dừng lúc này.");
    this.state.phaseBeforePause = this.state.phase;
    this.state.pausedRemainingMs = this.state.deadline ? Math.max(0, this.state.deadline - Date.now()) : null;
    this.state.phase = PHASES.PAUSED;
    this.state.deadline = null;
    this.commit("game.pause");
  }

  resume() {
    if (this.state.phase !== PHASES.PAUSED) throw new Error("Trận đấu không bị tạm dừng.");
    this.state.phase = this.state.phaseBeforePause;
    this.state.deadline = this.state.pausedRemainingMs == null ? null : Date.now() + this.state.pausedRemainingMs;
    this.state.phaseBeforePause = null;
    this.state.pausedRemainingMs = null;
    this.commit("game.resume");
  }

  reset() {
    const connectedTeams = this.state.teams.map((team) => ({ ...team, guessTokens: 0, score: 0 }));
    this.state = { ...makeInitialState(), teams: connectedTeams };
    this.commit("game.reset");
  }

  tick() {
    if (!this.state.deadline || Date.now() < this.state.deadline) return;
    if (this.state.phase === PHASES.ANSWERING) this.resolveAnswer(null, true);
    else if (this.state.phase === PHASES.ANSWER_RESULT) this.beginGuessPhase();
    else if (this.state.phase === PHASES.GUESS_PHASE) this.endGuessPhase();
  }
}
