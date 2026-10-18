export function AdminControls({ state, actions }) {
  return (
    <section className="admin-controls panel">
      <div><div className="eyebrow">Admin control</div><strong>{state.guessQueue.length} đội trong Guess Queue</strong></div>
      <div className="admin-actions">
        {state.phase === "LOBBY" && <button className="primary" onClick={actions.start}>Bắt đầu trận</button>}
        {!["LOBBY", "FINISHED", "PAUSED"].includes(state.phase) && <button onClick={actions.pause}>Tạm dừng</button>}
        {state.phase === "PAUSED" && <button className="primary" onClick={actions.resume}>Tiếp tục</button>}
        <button className="danger" onClick={() => window.confirm("Đặt lại toàn bộ tiến trình trận đấu?") && actions.reset()}>Reset</button>
      </div>
    </section>
  );
}
