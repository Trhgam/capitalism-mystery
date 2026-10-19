import { useCallback, useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";

const serverUrl = import.meta.env.VITE_SERVER_URL || (import.meta.env.DEV ? "http://localhost:3000" : window.location.origin);
const socket = io(serverUrl, { autoConnect: true });

const emitAck = (event, payload = {}) => new Promise((resolve, reject) => {
  socket.timeout(5000).emit(event, payload, (error, response) => {
    if (error) reject(new Error("Server không phản hồi."));
    else if (!response?.ok) reject(new Error(response?.error || "Thao tác thất bại."));
    else resolve(response);
  });
});

export function useGame({ adminMode }) {
  const [state, setState] = useState(null);
  const [team, setTeam] = useState(null);
  const [connected, setConnected] = useState(socket.connected);
  const [error, setError] = useState("");
  const [adminAuthenticated, setAdminAuthenticated] = useState(false);

  const run = useCallback(async (event, payload) => {
    setError("");
    try { return await emitAck(event, payload); }
    catch (err) { setError(err.message); throw err; }
  }, []);

  useEffect(() => {
    const resumeIdentity = async () => {
      try {
        const response = await emitAck("game:get-state");
        if (response.state) setState(response.state);
      } catch {
        // The connection indicator already communicates temporary server outages.
      }
      const token = localStorage.getItem("capitalism-mystery-team-token");
      if (token && !adminMode) {
        try {
          const response = await emitAck("team:resume", { token });
          setTeam(response.team);
        } catch {
          localStorage.removeItem("capitalism-mystery-team-token");
          setTeam(null);
        }
      }
      const adminCode = sessionStorage.getItem("capitalism-mystery-admin-code");
      if (adminMode && adminCode) {
        try {
          await emitAck("admin:login", { code: adminCode });
          setAdminAuthenticated(true);
        } catch {
          sessionStorage.removeItem("capitalism-mystery-admin-code");
          setAdminAuthenticated(false);
        }
      }
    };
    const onConnect = () => { setConnected(true); resumeIdentity(); };
    const onDisconnect = () => setConnected(false);
    const onState = (nextState) => {
      setState(nextState);
      // Sync team's live data (guessTokens, etc.) from every broadcast
      setTeam((prev) => {
        if (!prev) return prev;
        const live = nextState.teams?.find((t) => t.id === prev.id || (prev.name && t.name.toLowerCase() === prev.name.toLowerCase()));
        if (!live) return prev;
        return { ...prev, id: live.id, name: live.name, guessTokens: live.guessTokens, isConnected: live.isConnected };
      });
    };
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("game:state", onState);
    if (socket.connected) resumeIdentity();
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("game:state", onState);
    };
  }, [adminMode]);

  const actions = useMemo(() => ({
    async join(teamNumber) {
      const response = await run("team:join", { teamNumber });
      localStorage.setItem("capitalism-mystery-team-token", response.sessionToken);
      setTeam(response.team);
    },
    async adminLogin(code) {
      await run("admin:login", { code });
      sessionStorage.setItem("capitalism-mystery-admin-code", code);
      setAdminAuthenticated(true);
    },
    start: () => run("game:start"),
    selectQuestion: (teamId) => run("question:select", { teamId }),
    answer: (optionIndex, teamId) => run("question:answer", { optionIndex, teamId }),
    requestGuess: (teamId) => run("guess:request", { teamId }),
    cancelGuess: (teamId) => run("guess:cancel", { teamId }),
    saveGuess: (teamId) => run("guess:save", { teamId }),
    submitGuess: (answer, teamId) => run("guess:submit", { answer, teamId }),
    selectNext: (teamId) => run("turn:select-next", { teamId }),
    pause: () => run("game:pause"),
    resume: () => run("game:resume"),
    reset: () => run("game:reset"),
    startFinalMystery: () => run("game:start-final-mystery"),
    registerFinalMystery: (teamId) => run("final:register", { teamId }),
    revealMystery: () => run("game:reveal-mystery"),
  }), [run]);

  return { state, team, connected, error, setError, adminAuthenticated, actions };
}
