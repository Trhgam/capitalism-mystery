import { z } from "zod";

const allowedTeamNumbers = new Set([1, 2, 3, 5, 6, 7, 8]);
const joinSchema = z.object({
  teamNumber: z.number().int().refine((value) => allowedTeamNumbers.has(value)),
});
const tokenSchema = z.object({ token: z.string().min(10) });
const answerSchema = z.object({ optionIndex: z.number().int().min(0).max(3) });
const guessSchema = z.object({ answer: z.string() });
const antiCheatSchema = z.object({
  method: z.enum(["print-screen", "windows-shift-s", "drag-selection", "focus-loss", "unknown"]).default("unknown"),
});
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
    const result = game.joinTeam(`Team ${data.teamNumber}`);
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

  const resolveActorTeamId = (payload, options = {}) => {
    if (teamId && !isAdmin) return teamId;
    if (isAdmin) {
      if (typeof payload?.actorTeamId === "string") return payload.actorTeamId;
      if (!options.excludeTeamIdKey && typeof payload?.teamId === "string") return payload.teamId;
      return (
        game.state.currentTeamId ||
        game.state.teams.find((t) => t.isConnected)?.id ||
        game.state.teams[0]?.id ||
        null
      );
    }
    if (teamId) return teamId;
    if (typeof payload?.actorTeamId === "string") return payload.actorTeamId;
    if (!options.excludeTeamIdKey && typeof payload?.teamId === "string") return payload.teamId;
    throw new Error("Cần tham gia đội trước.");
  };

  socket.on("game:start", (_, ack) => reply(ack, () => { requireAdmin(); game.start(); return {}; }));
  socket.on("question:select", (payload, ack) => reply(ack, () => { const actorId = resolveActorTeamId(payload); game.selectQuestion(actorId); return {}; }));
  socket.on("question:answer", (payload, ack) => reply(ack, () => {
    const actorId = resolveActorTeamId(payload);
    const data = answerSchema.parse(payload);
    if (game.state.phase === "FINAL_MYSTERY") {
      return { result: game.answerFinalMystery(actorId, data.optionIndex) };
    }
    return { result: game.answer(actorId, data.optionIndex) };
  }));
  socket.on("final:answer", (payload, ack) => reply(ack, () => {
    const actorId = resolveActorTeamId(payload);
    const data = answerSchema.parse(payload);
    return { result: game.answerFinalMystery(actorId, data.optionIndex) };
  }));
  socket.on("final:register", (payload, ack) => reply(ack, () => {
    const actorId = resolveActorTeamId(payload);
    game.registerFinalMystery(actorId);
    return {};
  }));
  socket.on("guess:request", (payload, ack) => reply(ack, () => { const actorId = resolveActorTeamId(payload); game.requestGuess(actorId); return {}; }));
  socket.on("guess:cancel", (payload, ack) => reply(ack, () => { const actorId = resolveActorTeamId(payload); game.cancelGuess(actorId); return {}; }));
  socket.on("guess:save", (payload, ack) => reply(ack, () => { const actorId = resolveActorTeamId(payload); game.saveGuess(actorId); return {}; }));
  socket.on("guess:skip", (payload, ack) => reply(ack, () => { const actorId = resolveActorTeamId(payload); game.saveGuess(actorId); return {}; }));
  socket.on("guess:submit", (payload, ack) => reply(ack, () => { const actorId = resolveActorTeamId(payload); const data = guessSchema.parse(payload); return game.submitGuess(actorId, data.answer); }));
  socket.on("anti-cheat:report", (payload, ack) => reply(ack, () => {
    requireTeam();
    const data = antiCheatSchema.parse(payload || {});
    return game.reportSuspiciousCapture(teamId, data.method);
  }));
  socket.on("game:pause", (_, ack) => reply(ack, () => { requireAdmin(); game.pause(); return {}; }));
  socket.on("game:resume", (_, ack) => reply(ack, () => { requireAdmin(); game.resume(); return {}; }));
  socket.on("game:reset", (_, ack) => reply(ack, () => { requireAdmin(); game.reset(); return {}; }));
  socket.on("game:start-final-mystery", (_, ack) => reply(ack, () => { requireAdmin(); game.startFinalMystery(); return {}; }));
  socket.on("game:reveal-mystery", (_, ack) => reply(ack, () => { requireAdmin(); game.revealMystery(); return {}; }));
  socket.on("disconnect", () => { if (teamId) game.disconnectTeam(teamId); });
}
