import { useEffect, useState } from "react";
import { playAntiCheatSound } from "../lib/soundEffects.js";

export function AntiCheatModal({ alert }) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);
    if (alert?.detectedAt) playAntiCheatSound(alert.detectedAt);
  }, [alert?.detectedAt]);

  if (!alert || dismissed) return null;

  return (
    <div className="anti-cheat-backdrop" role="presentation">
      <section
        className="anti-cheat-certificate"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="anti-cheat-title"
        aria-describedby="anti-cheat-description"
      >
        <span className="anti-cheat-corner top-left" aria-hidden="true" />
        <span className="anti-cheat-corner top-right" aria-hidden="true" />
        <span className="anti-cheat-corner bottom-left" aria-hidden="true" />
        <span className="anti-cheat-corner bottom-right" aria-hidden="true" />

        <div className="anti-cheat-emblem" aria-hidden="true">
          <span className="anti-cheat-laurel">❧</span>
          <span className="anti-cheat-scales">⚖</span>
          <span className="anti-cheat-laurel mirrored">❧</span>
        </div>

        <div className="anti-cheat-divider" aria-hidden="true"><i />◆<i /></div>

        <h2 id="anti-cheat-title">
          {alert.teamName}, bạn tính chụp màn hình<br />đúng không?
        </h2>

        <div className="anti-cheat-divider compact" aria-hidden="true"><i />◇<i /></div>

        <p id="anti-cheat-description">
          Trận đấu tạm dừng ngay lập tức để đảm bảo công bằng.<br />
          Hãy giữ tinh thần trung thực và trải nghiệm cuộc chơi<br className="anti-cheat-desktop-break" /> một cách công bằng nhé!
        </p>

        <button type="button" className="anti-cheat-return" onClick={() => setDismissed(true)}>
          QUAY LẠI TRẬN ĐẤU
        </button>
      </section>
    </div>
  );
}
