import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";

const serverUrl = (() => {
  if (typeof window !== "undefined" && window.location) {
    if (window.location.port === "5173") {
      return `${window.location.protocol}//${window.location.hostname}:3000`;
    }
    return window.location.origin;
  }
  return import.meta.env.VITE_SERVER_URL || "http://localhost:3000";
})();
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
  const antiCheatCooldownRef = useRef(0);

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

  useEffect(() => {
    if (adminMode || !team?.id || !state || ["LOBBY", "FINISHED", "PAUSED"].includes(state.phase)) return undefined;

    let drag = null;
    let focusTimer = null;
    let isNavigating = false;
    const detectorReadyAt = Date.now() + 1500;
    const report = (method) => {
      const now = Date.now();
      if (isNavigating || now < detectorReadyAt) return;
      if (now - antiCheatCooldownRef.current < 10000) return;
      antiCheatCooldownRef.current = now;
      emitAck("anti-cheat:report", { method }).catch(() => {});
    };
    const onKey = (event) => {
      if (event.code === "PrintScreen" || event.key === "PrintScreen") {
        report("print-screen");
      } else if (event.metaKey && event.shiftKey && event.key?.toLowerCase() === "s") {
        report("windows-shift-s");
      }
    };
    const onWindowBlur = () => {
      // Windows handles Win+Shift+S before Chrome can receive the complete
      // shortcut. The snipping overlay still takes focus away from the game,
      // so focus loss is the reliable browser-level fallback.
      window.clearTimeout(focusTimer);
      focusTimer = window.setTimeout(() => {
        if (!isNavigating && document.visibilityState === "visible" && !document.hasFocus()) report("focus-loss");
      }, 120);
    };
    const onVisibilityChange = () => {
      // Reload/navigation also hides the document. Waiting briefly lets
      // beforeunload/pagehide mark that lifecycle transition first.
      if (document.visibilityState !== "hidden") return;
      window.clearTimeout(focusTimer);
      focusTimer = window.setTimeout(() => {
        if (!isNavigating && document.visibilityState === "hidden") report("focus-loss");
      }, 180);
    };
    const onNavigationStart = () => {
      isNavigating = true;
      window.clearTimeout(focusTimer);
    };
    const onPointerDown = (event) => {
      if (event.button !== 0 || event.target?.closest?.("button, input, textarea, select, a, [role='button'], [contenteditable='true']")) return;
      drag = {
        startedAt: Date.now(),
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        moves: 0,
        monotonicMoves: 0,
      };
    };
    const onPointerMove = (event) => {
      if (!drag || (event.buttons & 1) !== 1) return;
      drag.moves += 1;
      if (event.clientX >= drag.lastX - 8 && event.clientY >= drag.lastY - 8) drag.monotonicMoves += 1;
      drag.lastX = event.clientX;
      drag.lastY = event.clientY;
    };
    const onPointerUp = (event) => {
      if (!drag) return;
      const elapsed = Date.now() - drag.startedAt;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      const monotonicRatio = drag.moves ? drag.monotonicMoves / drag.moves : 0;
      const looksLikeCaptureBox = elapsed >= 180 && elapsed <= 2500 && dx >= 220 && dy >= 120 && drag.moves >= 6 && monotonicRatio >= 0.75;
      drag = null;
      if (looksLikeCaptureBox) report("drag-selection");
    };
    const cancelDrag = () => { drag = null; };

    window.addEventListener("keydown", onKey, true);
    window.addEventListener("keyup", onKey, true);
    window.addEventListener("blur", onWindowBlur, true);
    window.addEventListener("beforeunload", onNavigationStart, true);
    window.addEventListener("pagehide", onNavigationStart, true);
    document.addEventListener("visibilitychange", onVisibilityChange, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointermove", onPointerMove, true);
    document.addEventListener("pointerup", onPointerUp, true);
    document.addEventListener("pointercancel", cancelDrag, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keyup", onKey, true);
      window.removeEventListener("blur", onWindowBlur, true);
      window.removeEventListener("beforeunload", onNavigationStart, true);
      window.removeEventListener("pagehide", onNavigationStart, true);
      document.removeEventListener("visibilitychange", onVisibilityChange, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointermove", onPointerMove, true);
      document.removeEventListener("pointerup", onPointerUp, true);
      document.removeEventListener("pointercancel", cancelDrag, true);
      window.clearTimeout(focusTimer);
    };
  }, [adminMode, state?.phase, team?.id]);

  const actions = useMemo(() => {
    const cleanId = (id) => (typeof id === "string" ? id : undefined);
    return {
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
      selectQuestion: (teamId) => run("question:select", { teamId: cleanId(teamId) }),
      answer: (optionIndex, teamId) => run("question:answer", { optionIndex, teamId: cleanId(teamId) }),
      requestGuess: (teamId) => run("guess:request", { teamId: cleanId(teamId) }),
      cancelGuess: (teamId) => run("guess:cancel", { teamId: cleanId(teamId) }),
      saveGuess: (teamId) => run("guess:save", { teamId: cleanId(teamId) }),
      submitGuess: (answer, teamId) => run("guess:submit", { answer, teamId: cleanId(teamId) }),
      pause: () => run("game:pause"),
      resume: () => run("game:resume"),
      reset: () => run("game:reset"),
      startFinalMystery: () => run("game:start-final-mystery"),
      registerFinalMystery: (teamId) => run("final:register", { teamId: cleanId(teamId) }),
      revealMystery: () => run("game:reveal-mystery"),
    };
  }, [run]);

  return { state, team, connected, error, setError, adminAuthenticated, actions };
}
