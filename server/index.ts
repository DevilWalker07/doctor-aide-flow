import { env } from "./config.js";
import { APP_VERSION, createApp } from "./app.js";
import { getJobStore } from "./services/jobStore.js";

const app = createApp({ jobStore: getJobStore() });

const server = app.listen(env.PORT, () => {
  console.log(`DOUTOR AJUDA Motor Luan v${APP_VERSION} em http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

server.requestTimeout = 300_000;
server.headersTimeout = 305_000;
server.keepAliveTimeout = 65_000;

function shutdown(signal: string) {
  console.log(`[server] ${signal} recebido, encerrando...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
