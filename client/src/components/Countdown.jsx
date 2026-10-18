import { useEffect, useState } from "react";

export function Countdown({ deadline, serverNow }) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const offset = (serverNow || Date.now()) - Date.now();
    const update = () =>
      setSeconds(Math.max(0, Math.ceil((deadline - (Date.now() + offset)) / 1000)));
    update();
    const timer = setInterval(update, 250);
    return () => clearInterval(timer);
  }, [deadline, serverNow]);

  if (!deadline) return null;
  return (
    <div className={`countdown-circle ${seconds <= 5 ? "urgent" : ""}`} title={`${seconds} giây`}>
      {seconds}
    </div>
  );
}
