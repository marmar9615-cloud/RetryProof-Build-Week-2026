import { createServer } from "node:http";

import { runCodexCandidate } from "./codex-runner.js";
import { createWorkerServer } from "./server.js";

const port = Number(process.env.PORT ?? "");
const secret = process.env.RETRYPROOF_CODEX_WORKER_SECRET?.trim() ?? "";
if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error("PORT must be a valid TCP port.");
if (!process.env.OPENAI_API_KEY?.trim()) throw new Error("OPENAI_API_KEY is required.");

const server = createServer(createWorkerServer({ secret, runCandidate: runCodexCandidate }));
server.listen(port, "0.0.0.0", () => {
  console.log(JSON.stringify({ service: "retryproof-codex-worker", event: "listening", port }));
});

function shutdown(): void {
  server.close((error) => process.exit(error ? 1 : 0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
