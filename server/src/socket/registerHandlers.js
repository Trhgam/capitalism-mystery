import { z } from "zod";

const joinSchema = z.object({ name: z.string() });
const tokenSchema = z.object({ token: z.string().min(10) });
const answerSchema = z.object({ optionIndex: z.number().int().min(0).max(3) });
const guessSchema = z.object({ answer: z.string() });
const nextSchema = z.object({ teamId: z.string().uuid() });
const ackError = (ack, error) => ack?.({ ok: false, error: error instanceof z.ZodError ? "Dữ liệu gửi lên không hợp lệ." : error.message });

export function registerHandlers(io, socket, game, config) {
  let teamId = null;
  let isAdmin = false;
  const reply = (ack, action) => {
    try { ack?.({ ok: true, ...action() }); } catch (error) { ackError(ack, error); }
  };
  const requireAdmin = () => { if (!isAdmin) throw new Error("Cần quyền Admin."); };
  const requireTeam = () => { if (!teamId) throw new Error("Cần tham gia đội trước."); };

  socket.emit("game:state", game.publicState());
  socket.on("game:get-state", (_, ack) => reply(ack, () => ({ state: game.publicState() })));

  socket.on("team:join", (payload, ack) => reply(ack, () => {
    const data = joinSchema.parse(payload);
    const result = game.joinTeam(data.name);
    teamId = result.team.id;
    socket.join(`team:${teamId}`);
    return result;
  }));

  socket.on("team:resume", (payload, ack) => reply(ack, () => {
    const data = tokenSchema.parse(payload);
    const team = game.resumeTeam(data.token);
    teamId = team.id;
    socket.join(`team:${teamId}`);
    return { team: { ...team, sessionToken: undefined } };
  }));

  socket.on("admin:login", (payload, ack) => reply(ack, () => {
    if (payload?.code !== config.adminCode) throw new Error("Mã Admin không đúng.");
    isAdmin = true;
    socket.join("admins");
    return { authenticated: true };
  }));

  socket.on("game:start", (_, ack) => reply(ack, () => { requireAdmin(); game.start(); return {}; }));
  socket.on("question:select", (_, ack) => reply(ack, () => { requireTeam(); game.selectQuestion(teamId); return {}; }));
  socket.on("question:answer", (payload, ack) => reply(ack, () => {
    requireTeam();
    const data = answerSchema.parse(payload);
    if (game.state.phase === "FINAL_MYSTERY") {
      return { result: game.answerFinalMystery(teamId, data.optionIndex) };
    }
    return { result: game.answer(teamId, data.optionIndex) };
  }));
  socket.on("final:answer", (payload, ack) => reply(ack, () => {
    requireTeam();
    const data = answerSchema.parse(payload);
    return { result: game.answerFinalMystery(teamId, data.optionIndex) };
  }));
  socket.on("final:register", (_, ack) => reply(ack, () => {
    requireTeam();
    game.registerFinalMystery(teamId);
    return {};
  }));
  socket.on("guess:request", (_, ack) => reply(ack, () => { requireTeam(); game.requestGuess(teamId); return {}; }));
  socket.on("guess:save", (_, ack) => reply(ack, () => { requireTeam(); game.saveGuess(teamId); return {}; }));
  socket.on("guess:skip", (_, ack) => reply(ack, () => { requireTeam(); game.saveGuess(teamId); return {}; }));
  socket.on("guess:submit", (payload, ack) => reply(ack, () => { requireTeam(); const data = guessSchema.parse(payload); return game.submitGuess(teamId, data.answer); }));
  socket.on("turn:select-next", (payload, ack) => reply(ack, () => { requireTeam(); const data = nextSchema.parse(payload); game.selectNextTeam(teamId, data.teamId); return {}; }));
  socket.on("game:pause", (_, ack) => reply(ack, () => { requireAdmin(); game.pause(); return {}; }));
  socket.on("game:resume", (_, ack) => reply(ack, () => { requireAdmin(); game.resume(); return {}; }));
  socket.on("game:reset", (_, ack) => reply(ack, () => { requireAdmin(); game.reset(); return {}; }));
  socket.on("game:start-final-mystery", (_, ack) => reply(ack, () => { requireAdmin(); game.startFinalMystery(); return {}; }));
  socket.on("disconnect", () => { if (teamId) game.disconnectTeam(teamId); });
}
