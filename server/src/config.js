import "dotenv/config";

const numberFromEnv = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

export const config = {
  port: numberFromEnv("PORT", 3000),
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  adminCode: process.env.ADMIN_CODE || "123456",
  answerSeconds: numberFromEnv("ANSWER_SECONDS", 20),
  guessSeconds: numberFromEnv("GUESS_SECONDS", 10),
  finalGuessSeconds: numberFromEnv("FINAL_GUESS_SECONDS", 20),
};
