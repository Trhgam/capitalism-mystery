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

describe("registerHandlers - turn:select-next", () => {
  it("allows the current active team to pass the turn to another team", async () => {
    const config = {
      adminCode: "SECRET",
      answerSeconds: 20,
      guessRegistrationSeconds: 6,
      guessSeconds: 10,
      finalGuessSeconds: 20,
      finalRegistrationSeconds: 20,
      finalAnswerSeconds: 15,
    };
    const game = new GameService({ config });

    const socketTeam1 = createMockSocket();
    registerHandlers({}, socketTeam1, game, config);

    const socketTeam2 = createMockSocket();
    registerHandlers({}, socketTeam2, game, config);

    // Join teams
    let res1;
    socketTeam1.handlers["team:join"]({ teamNumber: 1 }, (r) => { res1 = r; });
    expect(res1.ok).toBe(true);

    let res2;
    socketTeam2.handlers["team:join"]({ teamNumber: 2 }, (r) => { res2 = r; });
    expect(res2.ok).toBe(true);

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

    // Force phase to SELECT_NEXT_TEAM for testing
    game.state.phase = PHASES.SELECT_NEXT_TEAM;
    const currentTeamId = game.state.currentTeamId;
    const targetTeam = game.state.teams.find((t) => t.id !== currentTeamId);

    const activeSocket = currentTeamId === res1.team.id ? socketTeam1 : socketTeam2;

    // Active team selects next team using { teamId: targetTeam.id }
    let selectRes;
    activeSocket.handlers["turn:select-next"]({ teamId: targetTeam.id }, (r) => { selectRes = r; });

    expect(selectRes.ok).toBe(true);
    expect(game.state.currentTeamId).toBe(targetTeam.id);
  });
});
