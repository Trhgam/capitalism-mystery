import { randomBytes, randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { questions } from "../data/questions.js";

export const PHASES = Object.freeze({
  LOBBY: "LOBBY",
  SELECT_QUESTION: "SELECT_QUESTION",
  ANSWERING: "ANSWERING",
  ANSWER_RESULT: "ANSWER_RESULT",
  GUESS_PHASE: "GUESS_PHASE",
  FINAL_MYSTERY: "FINAL_MYSTERY",
  SELECT_NEXT_TEAM: "SELECT_NEXT_TEAM",
  FINISHED: "FINISHED",
  PAUSED: "PAUSED",
});

export const FINAL_MYSTERY_QUESTION = Object.freeze({
  id: "final-mystery-adam-smith",
  category: "FINAL MYSTERY",
  text: 'Tôi là nhà kinh tế học người Scotland, được xem là một trong những người đặt nền móng cho kinh tế học hiện đại. Năm 1776, tôi xuất bản tác phẩm "Sự giàu có của các quốc gia". Tôi là ai?',
  options: ["Adam Smith", "Karl Marx", "John Maynard Keynes", "David Ricardo"],
  correctAnswer: 0,
});

const cleanName = (value) => value.trim().replace(/\s+/g, " ");
export const normalizeGuess = (value) => cleanName(value).toLocaleLowerCase("vi").replace(/[.]/g, "");
export const FIXED_TEAM_NAMES = Object.freeze(["Team 1", "Team 2", "Team 3", "Team 5", "Team 6", "Team 7", "Team 8"]);

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
  finalMystery: null, // { subphase: "REGISTRATION" | "ANSWERING", registeredTeamIds: [], answeredTeamIds: [] }
  lastGuessResult: null, // { teamId, teamName, answer, isCorrect, submittedAt }
  mysteryRevealed: false,
  revealedAnswer: null,
  createdAt: new Date().toISOString(),
});

export class GameService extends EventEmitter {
  constructor({ persistence, config, initialState } = {}) {
    super();
    this.persistence = persistence;
    this.config = config;
    const persistedState = initialState ? null : persistence?.load();
    this.state = initialState || persistedState || makeInitialState();

    // A server restart closes every Socket.IO connection. Do not trust the
    // connection flags stored in SQLite from the previous process.
    if (persistedState) {
      if (this.state.phase === PHASES.LOBBY) {
        this.state.teams = this.state.teams.filter((team) =>
          FIXED_TEAM_NAMES.some((name) => name.toLocaleLowerCase("vi") === team.name.toLocaleLowerCase("vi")),
        );
      }
      this.state.teams.forEach((team) => { team.isConnected = false; });
      this.persistence?.save(this.state);
    }
    if (this.state.phase === PHASES.SELECT_QUESTION && this.state.currentTeamId) {
      try {
        this.drawQuestionForCurrentTeam();
        this.commit("question.auto-select");
      } catch {
        // question bank empty or not ready
      }
    }
  }

  commit(eventType, teamId = null, payload = {}) {
    this.persistence?.save(this.state);
    this.persistence?.event(eventType, teamId, payload);
    this.emit("changed", this.publicState());
  }

  publicState() {
    let question = questions.find((item) => item.id === this.state.currentQuestionId);
    if (!question && this.state.phase === PHASES.FINAL_MYSTERY) {
      question = FINAL_MYSTERY_QUESTION;
    }
    return {
      ...structuredClone(this.state),
      teams: this.state.teams.map(({ sessionToken: _sessionToken, ...team }) => team),
      currentQuestion: question ? { id: question.id, text: question.text, options: question.options, category: question.category } : null,
      serverNow: Date.now(),
    };
  }

  joinTeam(rawName) {
    if (this.state.phase !== PHASES.LOBBY) throw new Error("Trận đấu đã bắt đầu.");
    const requestedName = cleanName(rawName);
    const name = FIXED_TEAM_NAMES.find(
      (item) => item.toLocaleLowerCase("vi") === requestedName.toLocaleLowerCase("vi"),
    );
    if (!name) throw new Error("Đội không hợp lệ. Vui lòng chọn một đội trong danh sách.");
    const existingTeam = this.state.teams.find(
      (team) => team.name.toLocaleLowerCase("vi") === name.toLocaleLowerCase("vi"),
    );

    // Let a new browser reclaim an old, disconnected team name. Rotate the
    // token so the previous browser session can no longer take it back.
    if (existingTeam) {
      if (existingTeam.isConnected) throw new Error("Tên đội đã được sử dụng.");
      existingTeam.isConnected = true;
      existingTeam.sessionToken = randomBytes(24).toString("hex");
      this.commit("team.rejoin", existingTeam.id, { name: existingTeam.name });
      return {
        team: { ...existingTeam, sessionToken: undefined },
        sessionToken: existingTeam.sessionToken,
      };
    }

    if (this.state.teams.length >= 7) throw new Error("Phòng đã đủ 7 đội.");

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

  drawQuestionForCurrentTeam() {
    const available = questions.filter((item) => !this.state.usedQuestionIds.includes(item.id));
    if (!available.length) throw new Error("Ngân hàng câu hỏi đã hết.");
    const question = available[Math.floor(Math.random() * available.length)];
    this.state.currentQuestionId = question.id;
    this.state.usedQuestionIds.push(question.id);
    this.state.phase = PHASES.ANSWERING;
    this.state.lastResult = null;
    this.state.deadline = Date.now() + this.config.answerSeconds * 1000;
  }

  start() {
    if (this.state.phase !== PHASES.LOBBY) throw new Error("Trận đấu không ở trạng thái chờ.");
    const connectedTeams = this.state.teams.filter((team) => team.isConnected);
    if (connectedTeams.length < 1) throw new Error("Cần ít nhất một đội đang kết nối để bắt đầu.");
    this.state.currentTeamId = connectedTeams[0].id;
    this.state.roundNumber = 1;
    this.drawQuestionForCurrentTeam();
    this.commit("game.start");
  }

  selectQuestion(teamId) {
    this.requireCurrentTeam(teamId);
    if (this.state.phase === PHASES.ANSWERING) return;
    if (this.state.phase !== PHASES.SELECT_QUESTION) throw new Error("Hiện không thể rút câu hỏi.");
    this.drawQuestionForCurrentTeam();
    this.commit("question.select", teamId, { questionId: this.state.currentQuestionId });
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
    this.state.lastResult = { isCorrect, timedOut, chosenAnswer: optionIndex, correctAnswer: question.correctAnswer, teamId: team.id, pieceIndex: piece?.index ?? null };
    this.state.phase = PHASES.ANSWER_RESULT;

    // A wrong answer is shown briefly, then moves directly to team selection.
    // Only a correct answer opens the longer Guess Queue decision window.
    const resultSeconds = isCorrect ? this.config.guessRegistrationSeconds : 2;
    this.state.deadline = Date.now() + resultSeconds * 1000;
    this.commit("question.result", team.id, { isCorrect, timedOut });
    return this.state.lastResult;
  }

  requestGuess(teamId) {
    const team = this.requireTeam(teamId);
    if (![PHASES.ANSWERING, PHASES.ANSWER_RESULT, PHASES.GUESS_PHASE, PHASES.FINAL_MYSTERY].includes(this.state.phase)) {
      throw new Error("Chỉ đăng ký đoán trong thời gian trả lời, xem kết quả hoặc vòng dự đoán.");
    }
    if (this.state.phase === PHASES.FINAL_MYSTERY) {
      return this.registerFinalMystery(teamId);
    }
    if (this.state.phase === PHASES.ANSWER_RESULT && !this.state.lastResult?.isCorrect) {
      throw new Error("Trả lời sai không mở vòng dự đoán.");
    }
    if (team.guessTokens < 1) throw new Error("Đội chưa có Guess Token.");
    if (this.state.guessQueue.some((item) => item.teamId === teamId && item.status === "waiting")) {
      throw new Error("Đội đã có trong hàng đợi.");
    }

    // Clean up any old non-waiting entry for this team so they can re-queue with their remaining tokens
    this.state.guessQueue = this.state.guessQueue.filter((item) => item.teamId !== teamId || item.status === "waiting");

    this.requestSeq = (this.requestSeq || 0) + 1;
    const isCurrent = teamId === this.state.currentTeamId;
    const queueEntry = {
      teamId,
      order: this.requestSeq,
      requestedAt: new Date().toISOString(),
      status: "waiting",
    };
    if (isCurrent && this.state.phase !== PHASES.GUESS_PHASE) {
      this.state.guessQueue.unshift(queueEntry);
    } else {
      this.state.guessQueue.push(queueEntry);
    }
    this.commit("guess.request", teamId);
    if (isCurrent && this.state.phase === PHASES.ANSWER_RESULT) {
      this.beginGuessPhase();
    } else if (this.state.phase === PHASES.GUESS_PHASE) {
      const waitingItems = this.state.guessQueue.filter((item) => item.status === "waiting");
      if (waitingItems.length === 1) {
        const seconds = this.state.finalGuess ? this.config.finalGuessSeconds : this.config.guessSeconds;
        this.state.deadline = Date.now() + seconds * 1000;
        this.commit("guess.next", teamId);
      }
    }
  }

  saveGuess(teamId) {
    const team = this.requireTeam(teamId);
    if (this.state.phase !== PHASES.ANSWER_RESULT) {
      throw new Error("Chỉ có thể lưu lượt đoán trong lúc quyết định kết quả.");
    }
    this.state.guessQueue = this.state.guessQueue.filter((item) => item.teamId !== teamId);
    this.commit("guess.save", teamId);
    if (teamId === this.state.currentTeamId) {
      this.advanceAfterAnswerResult();
    }
  }

  beginGuessPhase() {
    if (![PHASES.ANSWER_RESULT, PHASES.GUESS_PHASE].includes(this.state.phase)) return;
    if (this.state.phase === PHASES.ANSWER_RESULT && !this.state.lastResult?.isCorrect) {
      return this.checkFinalMysteryOrAdvance("incorrect-answer");
    }
    const waitingItems = this.state.guessQueue.filter((item) => item.status === "waiting");
    if (waitingItems.length === 0) return this.checkFinalMysteryOrAdvance("empty-guess-queue");
    this.state.phase = PHASES.GUESS_PHASE;
    this.state.finalGuess = this.state.puzzle.every((piece) => piece.status !== "hidden");
    const seconds = this.state.finalGuess ? this.config.finalGuessSeconds : this.config.guessSeconds;
    this.state.deadline = Date.now() + seconds * 1000;
    this.commit("guess.begin", null, { finalGuess: this.state.finalGuess, currentGuesser: waitingItems[0].teamId });
  }

  advanceAfterAnswerResult() {
    if (this.state.phase !== PHASES.ANSWER_RESULT) return;
    if (!this.state.lastResult?.isCorrect) {
      return this.checkFinalMysteryOrAdvance("incorrect-answer");
    }
    const waitingItems = this.state.guessQueue.filter((item) => item.status === "waiting");
    if (waitingItems.length > 0) {
      return this.beginGuessPhase();
    }
    return this.checkFinalMysteryOrAdvance(this.state.lastResult?.isCorrect ? "saved-token" : "incorrect-answer");
  }

  checkFinalMysteryOrAdvance(fallbackReason) {
    const allPiecesOpened = this.state.puzzle.every((piece) => piece.status !== "hidden");
    if (allPiecesOpened && !this.state.winner) {
      return this.startFinalMystery();
    }
    this.openNextTeamSelection(fallbackReason);
  }

  startFinalMystery() {
    this.state.phase = PHASES.FINAL_MYSTERY;
    this.state.currentQuestionId = FINAL_MYSTERY_QUESTION.id;
    this.state.guessQueue = [];

    // Only teams that are actually playing participate in the Final round.
    // Tokens left on disconnected teams must not prevent the free final chance.
    const activeTeams = this.state.teams.filter((team) => team.isConnected);
    const anyHasTokens = activeTeams.some((team) => team.guessTokens > 0);
    if (!anyHasTokens) {
      // If every active team is at zero, give every active team one chance.
      activeTeams.forEach((team) => {
        team.guessTokens = 1;
        team.grantedFinalChance = true;
      });
    } else {
      activeTeams.forEach((team) => { team.grantedFinalChance = false; });
    }
    this.state.teams
      .filter((team) => !team.isConnected)
      .forEach((team) => { team.grantedFinalChance = false; });

    const registrationSeconds = this.config.finalRegistrationSeconds || 20;
    const answerSeconds = this.config.finalAnswerSeconds || 15;
    this.state.finalMystery = {
      subphase: "REGISTRATION",
      registeredTeamIds: [],
      answeredTeamIds: [],
      grantedFreeToken: !anyHasTokens,
      registrationSeconds,
      answerSeconds,
    };
    this.state.deadline = Date.now() + registrationSeconds * 1000;
    this.commit("final-mystery.start", null, { grantedFreeToken: !anyHasTokens, activeTeamCount: activeTeams.length });
  }

  registerFinalMystery(teamId) {
    const team = this.requireTeam(teamId);
    if (this.state.phase !== PHASES.FINAL_MYSTERY || this.state.finalMystery?.subphase !== "REGISTRATION") {
      throw new Error("Hiện không trong thời gian đăng ký Final Mystery.");
    }
    if (team.guessTokens < 1) {
      throw new Error("Đội không có Guess Token để đăng ký.");
    }
    if (!team.isConnected) throw new Error("Đội đang mất kết nối.");
    if (this.state.finalMystery.registeredTeamIds.includes(teamId)) {
      throw new Error("Đội đã đăng ký.");
    }
    this.state.finalMystery.registeredTeamIds.push(teamId);
    this.state.guessQueue.push({
      teamId,
      order: this.state.finalMystery.registeredTeamIds.length,
      requestedAt: new Date().toISOString(),
      status: "waiting",
    });
    this.commit("final-mystery.register", teamId);
  }

  advanceFinalMysteryToAnswering() {
    if (this.state.phase !== PHASES.FINAL_MYSTERY) return;
    if (this.state.finalMystery.registeredTeamIds.length === 0) {
      return this.finishWithNoWinner();
    }
    // Answering begins only after the longer registration/announcement window.
    this.state.finalMystery.subphase = "ANSWERING";
    this.state.deadline = Date.now() + (this.state.finalMystery.answerSeconds || 15) * 1000;
    this.commit("final-mystery.answering");
  }

  finishWithNoWinner() {
    this.state.phase = PHASES.FINISHED;
    this.state.deadline = null;
    this.state.winner = null;
    this.state.mysteryRevealed = false;
    this.state.revealedAnswer = null;
    this.commit("game.finished", null, { noWinner: true, mysteryRevealed: false });
  }

  revealMystery() {
    this.state.phase = PHASES.FINISHED;
    this.state.deadline = null;
    this.state.mysteryRevealed = true;
    this.state.revealedAnswer = "Adam Smith";
    this.state.puzzle.forEach((p) => { p.status = "revealed"; });
    this.commit("game.mystery-revealed", null, { mysteryRevealed: true, revealedAnswer: "Adam Smith" });
  }

  answerFinalMystery(teamId, optionIndex) {
    const team = this.requireTeam(teamId);
    if (this.state.phase !== PHASES.FINAL_MYSTERY || this.state.finalMystery?.subphase !== "ANSWERING" || (this.state.deadline && Date.now() > this.state.deadline)) {
      throw new Error("Vòng trả lời Final Mystery đã kết thúc.");
    }
    if (!this.state.finalMystery.registeredTeamIds.includes(teamId)) {
      throw new Error("Chỉ đội đã đăng ký mới được trả lời.");
    }
    if (this.state.finalMystery.answeredTeamIds.includes(teamId)) {
      throw new Error("Mỗi đội chỉ được đoán tối đa 1 lần trong Final Mystery.");
    }
    if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex > 3) {
      throw new Error("Đáp án không hợp lệ.");
    }

    this.state.finalMystery.answeredTeamIds.push(teamId);
    const isCorrect = optionIndex === FINAL_MYSTERY_QUESTION.correctAnswer;

    if (isCorrect) {
      // Đoán đúng đầu tiên -> Chiến thắng!
      team.score += 300;
      this.state.winner = {
        teamId,
        teamName: team.name,
        answeredAt: new Date().toISOString(),
        answer: "Adam Smith",
      };
      this.state.phase = PHASES.FINISHED;
      this.state.deadline = null;
      this.state.puzzle.forEach((p) => { p.status = "revealed"; });
      this.commit("game.finished", teamId, { winner: this.state.winner });
      return { isCorrect: true, winner: this.state.winner };
    }

    // Đoán sai -> Mất 1 token, không được đoán lại trong vòng cuối
    team.guessTokens = Math.max(0, team.guessTokens - 1);
    const queueItem = this.state.guessQueue.find((item) => item.teamId === teamId);
    if (queueItem) queueItem.status = "incorrect";

    this.commit("final-mystery.incorrect", teamId, { optionIndex });

    // Kiểm tra nếu tất cả các đội đã đăng ký đều đã đoán sai:
    const allAnswered = this.state.finalMystery.registeredTeamIds.every((id) =>
      this.state.finalMystery.answeredTeamIds.includes(id)
    );
    if (allAnswered) {
      this.finishWithNoWinner();
    }
    return { isCorrect: false };
  }

  openNextTeamSelection(reason) {
    this.state.phase = PHASES.SELECT_NEXT_TEAM;
    this.state.deadline = null;
    this.state.guessQueue = [];
    this.commit("turn.selection-open", null, { reason });
  }

  submitGuess(teamId, rawAnswer) {
    const team = this.requireTeam(teamId);
    if (this.state.phase !== PHASES.GUESS_PHASE || Date.now() > this.state.deadline) throw new Error("Guess Phase đã đóng.");
    const queueItem = this.state.guessQueue.find((item) => item.teamId === teamId);
    if (!queueItem) throw new Error("Đội chưa đăng ký Guess Queue.");
    if (queueItem.status !== "waiting") throw new Error("Đội đã gửi dự đoán trong lượt này.");

    // Strict race condition check: only the team currently at the head of waiting queue may submit!
    const currentWaiting = this.state.guessQueue.find((item) => item.status === "waiting");
    if (!currentWaiting || currentWaiting.teamId !== teamId) {
      throw new Error("Chưa đến lượt dự đoán của đội bạn trong hàng đợi.");
    }
    if (team.guessTokens < 1) throw new Error("Đội không còn Guess Token.");
    const answer = normalizeGuess(rawAnswer);
    if (answer.length < 2 || answer.length > 60) throw new Error("Tên nhân vật không hợp lệ.");

    team.guessTokens -= 1;
    const accepted = new Set(["adam smith", "smith", "a smith"]);
    const isCorrect = accepted.has(answer);
    queueItem.status = isCorrect ? "winner" : "incorrect";
    queueItem.submittedAt = new Date().toISOString();
    this.state.lastGuessResult = {
      teamId,
      teamName: team.name,
      answer: rawAnswer,
      isCorrect,
      remainingTokens: team.guessTokens,
      submittedAt: queueItem.submittedAt,
    };
    if (isCorrect) {
      this.state.winner = { teamId, teamName: team.name, answeredAt: queueItem.submittedAt, answer: "Adam Smith" };
      this.state.phase = PHASES.FINISHED;
      this.state.deadline = null;
      this.state.puzzle.forEach((piece) => { piece.status = "revealed"; });
      this.commit("guess.submit", teamId, { isCorrect, lastGuessResult: this.state.lastGuessResult });
      return { isCorrect };
    }
    this.commit("guess.submit", teamId, { isCorrect, lastGuessResult: this.state.lastGuessResult });

    // After incorrect guess, check if other teams are waiting in the queue
    const nextWaiting = this.state.guessQueue.find((item) => item.status === "waiting");
    if (nextWaiting) {
      const seconds = this.state.finalGuess ? this.config.finalGuessSeconds : this.config.guessSeconds;
      this.state.deadline = Date.now() + seconds * 1000;
      this.commit("guess.next", nextWaiting.teamId);
    } else if (team.guessTokens > 0) {
      // Team still has reserve tokens and nobody else is waiting: allow them to continue guessing!
      queueItem.status = "waiting";
      const seconds = this.state.finalGuess ? this.config.finalGuessSeconds : this.config.guessSeconds;
      this.state.deadline = Date.now() + seconds * 1000;
      this.commit("guess.next", teamId);
    } else {
      const allPiecesOpened = this.state.puzzle.every((piece) => piece.status !== "hidden");
      if (this.state.finalGuess || allPiecesOpened) {
        return this.checkFinalMysteryOrAdvance("all-guesses-incorrect");
      } else {
        this.openNextTeamSelection("all-guesses-incorrect");
      }
    }
    return { isCorrect };
  }

  endGuessPhase() {
    if (this.state.phase !== PHASES.GUESS_PHASE) return;
    const currentWaiting = this.state.guessQueue.find((item) => item.status === "waiting");
    if (currentWaiting) {
      currentWaiting.status = "timed_out";
    }
    const nextWaiting = this.state.guessQueue.find((item) => item.status === "waiting");
    if (nextWaiting) {
      const seconds = this.state.finalGuess ? this.config.finalGuessSeconds : this.config.guessSeconds;
      this.state.deadline = Date.now() + seconds * 1000;
      this.commit("guess.next", nextWaiting.teamId);
      return;
    }
    const allPiecesOpened = this.state.puzzle.every((piece) => piece.status !== "hidden");
    if (this.state.finalGuess || allPiecesOpened) {
      return this.checkFinalMysteryOrAdvance("guess-ended");
    }
    this.openNextTeamSelection("guess-ended");
  }

  selectNextTeam(actorTeamId, nextTeamId) {
    if (this.state.phase !== PHASES.SELECT_NEXT_TEAM) throw new Error("Chưa đến bước chọn đội tiếp theo.");
    this.requireCurrentTeam(actorTeamId);
    const nextTeam = this.requireTeam(nextTeamId);
    if (!nextTeam.isConnected) throw new Error("Không thể chọn đội đang mất kết nối.");
    const connectedTeams = this.state.teams.filter((team) => team.isConnected);
    if (nextTeamId === this.state.currentTeamId && connectedTeams.length > 1) throw new Error("Không thể chọn chính đội mình liên tiếp.");
    this.state.currentTeamId = nextTeamId;
    this.state.guessQueue = [];
    this.state.lastResult = null;
    this.state.finalGuess = false;
    this.state.roundNumber += 1;
    this.drawQuestionForCurrentTeam();
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
    const connectedTeams = this.state.teams
      .filter((team) => FIXED_TEAM_NAMES.includes(team.name))
      .map((team) => ({ ...team, guessTokens: 0, score: 0 }));
    this.state = { ...makeInitialState(), teams: connectedTeams };
    this.commit("game.reset");
  }

  tick() {
    if (!this.state.deadline || Date.now() < this.state.deadline) return;
    if (this.state.phase === PHASES.ANSWERING) this.resolveAnswer(null, true);
    else if (this.state.phase === PHASES.ANSWER_RESULT) this.advanceAfterAnswerResult();
    else if (this.state.phase === PHASES.GUESS_PHASE) this.endGuessPhase();
    else if (this.state.phase === PHASES.FINAL_MYSTERY) {
      if (this.state.finalMystery?.subphase === "REGISTRATION") {
        this.advanceFinalMysteryToAnswering();
      } else if (this.state.finalMystery?.subphase === "ANSWERING") {
        this.finishWithNoWinner();
      }
    }
  }
}
