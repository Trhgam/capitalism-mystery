import { useGame } from "./hooks/useGame.js";
import { JoinPage } from "./pages/JoinPage.jsx";
import { AdminLogin } from "./pages/AdminLogin.jsx";
import { GamePage } from "./pages/GamePage.jsx";
import { LobbyPage } from "./pages/LobbyPage.jsx";

export function App() {
  const adminMode = window.location.pathname.startsWith("/admin");
  const game = useGame({ adminMode });
  if (!game.state) return <div className="loading-screen"><span>CM</span><p>Đang kết nối với game server…</p></div>;
  if (adminMode && !game.adminAuthenticated) return <AdminLogin onLogin={game.actions.adminLogin} error={game.error}/>;
  if (!adminMode && !game.team) return <JoinPage state={game.state} onJoin={game.actions.join} error={game.error} connected={game.connected}/>;
  if (game.state.phase === "LOBBY") return <LobbyPage state={game.state} team={game.team} adminMode={adminMode} connected={game.connected} error={game.error} actions={game.actions}/>;
  return <GamePage state={game.state} team={game.team} adminMode={adminMode} connected={game.connected} error={game.error} actions={game.actions}/>;
}
