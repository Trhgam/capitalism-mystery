export function TeamSidebar({ teams, currentTeamId, selfId }) {
  return (
    <aside className="team-sidebar-panel">
      <div className="team-sidebar-header">
        <span className="team-sidebar-title">CÁC ĐỘI</span>
        <span className="team-sidebar-count">{teams.length}</span>
      </div>

      <div className="team-sidebar-list">
        {teams.map((team) => {
          const isActive = team.id === currentTeamId;
          const isSelf = team.id === selfId;
          const initial = team.name.trim().charAt(0).toUpperCase();
          const displayScore = team.score >= 100 ? Math.floor(team.score / 100) : (team.score || team.guessTokens || 0);

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
              </div>

              <div className="team-item-score">
                <span className="score-number">{displayScore}</span>
                <span className="score-label">ĐIỂM</span>
              </div>
            </div>
          );
        })}

        {Array.from({ length: Math.max(0, 7 - teams.length) }, (_, index) => (
          <div className="team-item empty-slot" key={`empty-${index}`}>
            <div className="team-item-avatar empty">?</div>
            <div className="team-item-info">
              <span className="team-item-name empty">Đang chờ đội…</span>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
