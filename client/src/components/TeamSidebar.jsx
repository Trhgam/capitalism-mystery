export function TeamSidebar({
  teams,
  currentTeamId,
  selfId,
  guessQueue = [],
  adminMode = false,
  selectedTeamId = null,
  onSelectTeam = null,
  isFinalMystery = false
}) {
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
          const isSelected = adminMode && selectedTeamId === team.id;
          const isSelf = team.id === selfId;
          const queueEntry = guessQueue.find((item) => item.teamId === team.id);
          const initial = team.name.trim().charAt(0).toUpperCase();

          return (
            <div
              key={team.id}
              className={`team-item ${isActive ? "active" : ""} ${adminMode ? "selectable-admin" : ""} ${isSelected ? "admin-selected" : ""}`}
              onClick={() => {
                if (adminMode && onSelectTeam) {
                  onSelectTeam(team.id);
                }
              }}
              title={adminMode ? `Nhấn để chọn thay cho ${team.name}` : undefined}
            >
              <div className="team-item-avatar">
                {initial}
              </div>

              <div className="team-item-info">
                <span className="team-item-name" title={team.name}>
                  {team.name}
                </span>
                {isSelected && adminMode && (
                  <span className="team-item-badge admin-select-badge">
                    ĐANG CHỌN THAY
                  </span>
                )}
                {!isSelected && isActive && (
                  <span className="team-item-badge">
                    ĐANG CHƠI
                  </span>
                )}
                {!isActive && !isSelected && isSelf && (
                  <span className="team-item-subtext">BẠN</span>
                )}
                {queueEntry && (
                  <span className={`team-queue-badge ${queueEntry.status}`}>
                    {queueEntry.status === "waiting" ? "ĐÃ XẾP HÀNG" : queueEntry.status.toUpperCase()}
                  </span>
                )}
              </div>

              <div
                className={`team-item-tokens ${isFinalMystery ? "final-mystery-glow" : ""}`}
                title={`${team.guessTokens || 0} lượt dự đoán`}
              >
                {isFinalMystery && <span className="token-float-popup">+1 ⚡</span>}
                <span className="token-value">
                  <i aria-hidden="true" className={isFinalMystery ? "lightning-sparkle" : ""}>⚡</i>
                  {team.guessTokens || 0}
                </span>
                <span className="token-label">LƯỢT ĐOÁN</span>
              </div>
            </div>
          );
        })}

      </div>
    </aside>
  );
}

