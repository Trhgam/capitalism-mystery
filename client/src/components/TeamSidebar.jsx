export function TeamSidebar({ teams, currentTeamId, selfId, guessQueue = [] }) {
  const connectedTeams = teams.filter((team) => team.isConnected);

  return (
    <aside className="team-sidebar-panel">
      <div className="team-sidebar-header">
        <span className="team-sidebar-title">CÁC ĐỘI</span>
        <span className="team-sidebar-count">{connectedTeams.length}</span>
      </div>

      <div className="team-sidebar-list">
        {connectedTeams.map((team) => {
          const isActive = team.id === currentTeamId;
          const isSelf = team.id === selfId;
          const queueEntry = guessQueue.find((item) => item.teamId === team.id);
          const initial = team.name.trim().charAt(0).toUpperCase();

          return (
            <div
              key={team.id}
              className={`team-item ${isActive ? "active" : ""}`}
            >
              <div className="team-item-avatar">
                {initial}
              </div>

              <div className="team-item-info">
                <span className="team-item-name" title={team.name}>
                  {team.name}
                </span>
                {isActive && (
                  <span className="team-item-badge">
                    ĐANG CHƠI
                  </span>
                )}
                {!isActive && isSelf && (
                  <span className="team-item-subtext">BẠN</span>
                )}
                {queueEntry && (
                  <span className={`team-queue-badge ${queueEntry.status}`}>
                    {queueEntry.status === "waiting" ? "ĐÃ XẾP HÀNG" : queueEntry.status.toUpperCase()}
                  </span>
                )}
              </div>

              <div className="team-item-tokens" title={`${team.guessTokens || 0} lượt dự đoán`}>
                <span className="token-value"><i aria-hidden="true">⚡</i>{team.guessTokens || 0}</span>
                <span className="token-label">LƯỢT ĐOÁN</span>
              </div>
            </div>
          );
        })}

      </div>
    </aside>
  );
}
