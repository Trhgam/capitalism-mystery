import { createServer } from "node:http";
import { Server } from "socket.io";
import { config } from "./config.js";
import { createApp } from "./app.js";
import { GameService } from "./game/GameService.js";
import { persistence } from "./lib/persistence.js";
import { registerHandlers } from "./socket/registerHandlers.js";

const app = createApp(config);
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: config.clientOrigin, credentials: true } });
const game = new GameService({ persistence, config });

game.on("changed", (state) => io.emit("game:state", state));
io.on("connection", (socket) => registerHandlers(io, socket, game, config));
setInterval(() => game.tick(), 250).unref();

httpServer.listen(config.port, "0.0.0.0", () => {
  console.log(`Capitalism Mystery server: http://localhost:${config.port}`);
});
