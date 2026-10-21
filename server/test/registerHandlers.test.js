import { describe, expect, it } from "vitest";
import { registerHandlers } from "../src/socket/registerHandlers.js";
import { GameService, PHASES } from "../src/game/GameService.js";

function createMockSocket() {
  const handlers = {};
  const emitted = [];
  return {
    handlers,
    emitted,
    emit: (event, data) => emitted.push({ event, data }),
    on: (event, fn) => { handlers[event] = fn; },
    join: () => {},
  };
}

describe("registerHandlers - anti-cheat", () => {
  it("accepts a capture report only from a joined team and pauses the match", async () => {
    const config = {
      adminCode: "SECRET",
      answerSeconds: 20,
      guessRegistrationSeconds: 6,
      guessSeconds: 10,
      finalGuessSeconds: 20,
      finalRegistrationSeconds: 20,
      finalAnswerSeconds: 15,
      antiCheatPauseSeconds: 5,
    };
    const game = new GameService({ config });

    const socketTeam1 = createMockSocket();
    registerHandlers({}, socketTeam1, game, config);

    let res1;
    socketTeam1.handlers["team:join"]({ teamNumber: 1 }, (r) => { res1 = r; });
    expect(res1.ok).toBe(true);

    // Admin socket to start game
    const socketAdmin = createMockSocket();
    registerHandlers({}, socketAdmin, game, config);
    let adminAuth;
    socketAdmin.handlers["admin:login"]({ code: "SECRET" }, (r) => { adminAuth = r; });
    expect(adminAuth.authenticated).toBe(true);

    let startRes;
    socketAdmin.handlers["game:start"]({}, (r) => { startRes = r; });
    if (!startRes.ok) console.log("startRes failed:", startRes);
    expect(startRes.ok).toBe(true);

    let reportRes;
    socketTeam1.handlers["anti-cheat:report"]({ method: "print-screen" }, (r) => { reportRes = r; });

    expect(reportRes.ok).toBe(true);
    expect(reportRes.paused).toBe(true);
    expect(game.state.phase).toBe(PHASES.PAUSED);
    expect(game.state.antiCheatAlert).toMatchObject({ teamId: res1.team.id, teamName: "Team 1", method: "print-screen" });
    expect(socketTeam1.handlers["turn:select-next"]).toBeUndefined();
  });
});
