let audioContext;
let lastAntiCheatAlertId;

function getAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  audioContext ||= new AudioContextClass();
  return audioContext;
}

function scheduleNote(context, destination, { frequency, start, duration, type = "sine", slideTo }) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const beginsAt = context.currentTime + start;
  const endsAt = beginsAt + duration;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, beginsAt);
  if (slideTo) oscillator.frequency.exponentialRampToValueAtTime(slideTo, endsAt);

  gain.gain.setValueAtTime(0.0001, beginsAt);
  gain.gain.exponentialRampToValueAtTime(0.13, beginsAt + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, endsAt);

  oscillator.connect(gain);
  gain.connect(destination);
  oscillator.start(beginsAt);
  oscillator.stop(endsAt + 0.02);
}

function scheduleWobble(context, destination, { frequency, start, duration, slideTo }) {
  const oscillator = context.createOscillator();
  const vibrato = context.createOscillator();
  const vibratoDepth = context.createGain();
  const gain = context.createGain();
  const beginsAt = context.currentTime + start;
  const endsAt = beginsAt + duration;

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, beginsAt);
  oscillator.frequency.exponentialRampToValueAtTime(slideTo, endsAt);
  vibrato.frequency.setValueAtTime(7.5, beginsAt);
  vibratoDepth.gain.setValueAtTime(0, beginsAt);
  vibratoDepth.gain.linearRampToValueAtTime(24, beginsAt + 0.22);

  gain.gain.setValueAtTime(0.0001, beginsAt);
  gain.gain.exponentialRampToValueAtTime(0.1, beginsAt + 0.05);
  gain.gain.setValueAtTime(0.1, endsAt - 0.16);
  gain.gain.exponentialRampToValueAtTime(0.0001, endsAt);

  vibrato.connect(vibratoDepth);
  vibratoDepth.connect(oscillator.frequency);
  oscillator.connect(gain);
  gain.connect(destination);
  oscillator.start(beginsAt);
  vibrato.start(beginsAt);
  oscillator.stop(endsAt + 0.02);
  vibrato.stop(endsAt + 0.02);
}

/** A short mischievous sting used when an anti-cheat warning appears. */
export async function playAntiCheatSound(alertId) {
  if (!alertId || alertId === lastAntiCheatAlertId) return;
  lastAntiCheatAlertId = alertId;

  const context = getAudioContext();
  if (!context) return;

  try {
    if (context.state === "suspended") await context.resume();

    const master = context.createGain();
    const echo = context.createDelay(0.3);
    const echoGain = context.createGain();
    master.gain.setValueAtTime(0.58, context.currentTime);
    echo.delayTime.setValueAtTime(0.14, context.currentTime);
    echoGain.gain.setValueAtTime(0.16, context.currentTime);
    master.connect(context.destination);
    master.connect(echo);
    echo.connect(echoGain);
    echoGain.connect(context.destination);

    // Sneaky tip-toe notes, a suspicious wobble, then a cartoon "caught you" drop.
    scheduleNote(context, master, { frequency: 659, start: 0, duration: 0.22, type: "triangle", slideTo: 700 });
    scheduleNote(context, master, { frequency: 784, start: 0.27, duration: 0.22, type: "triangle", slideTo: 740 });
    scheduleNote(context, master, { frequency: 622, start: 0.54, duration: 0.27, type: "triangle", slideTo: 660 });
    scheduleWobble(context, master, { frequency: 470, start: 0.79, duration: 1.02, slideTo: 330 });
    scheduleNote(context, master, { frequency: 235, start: 0.84, duration: 0.94, type: "sine", slideTo: 175 });
    scheduleNote(context, master, { frequency: 540, start: 1.72, duration: 0.25, type: "triangle", slideTo: 490 });
    scheduleNote(context, master, { frequency: 390, start: 1.91, duration: 0.48, type: "sawtooth", slideTo: 105 });
    scheduleNote(context, master, { frequency: 120, start: 2.3, duration: 0.24, type: "sine", slideTo: 72 });

    window.setTimeout(() => {
      master.disconnect();
      echo.disconnect();
      echoGain.disconnect();
    }, 3100);
  } catch {
    // Some browsers may still deny autoplay before the first user gesture.
  }
}
