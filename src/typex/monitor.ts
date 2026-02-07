import type { RuntimeEnv } from "../runtime.js";
import { loadConfig, type OpenClawConfig } from "../config/config.js";
import { getChildLogger } from "../logging.js";
import { getTypeXClient } from "./client.js";
import { processTypeXMessage } from "./message.js";

const logger = getChildLogger({ module: "typex-monitor" });

export type MonitorTypeXOpts = {
  accountId?: string;
  config?: OpenClawConfig;
  runtime?: RuntimeEnv;
  abortSignal?: AbortSignal;
};

export async function monitorTypeXProvider(opts: MonitorTypeXOpts = {}) {
  const cfg = opts.config ?? loadConfig();
  const accountId = opts.accountId; // In real app, resolve default if missing

  if (!accountId) {
    // In a real implementation we might iterate all accounts
    logger.warn("No accountId provided for TypeX monitor");
    return;
  }

  // Get client (throws if config missing)
  const client = getTypeXClient(accountId);
  // Need to get appId from somewhere, re-using a mocked way or from config
  const appId = "mock-app-id";

  logger.info(`Starting TypeX monitor for account ${accountId}...`);

  // Simulate long-running connection (e.g. WebSocket)
  // In a real implementation, this would connect to the TypeX socket

  const tick = setInterval(() => {
    // Keep process alive or simulate checking
  }, 10000);

  if (opts.abortSignal) {
    opts.abortSignal.addEventListener(
      "abort",
      () => {
        logger.info("Stopping TypeX monitor...");
        clearInterval(tick);
      },
      { once: true },
    );
  }

  // Block indefinitely if no abort signal (mimicking the Feishu WS behavior)
  if (!opts.abortSignal) {
    await new Promise(() => {});
  } else {
    // Wait for abort
    await new Promise<void>((resolve) => {
      opts.abortSignal?.addEventListener("abort", () => resolve(), { once: true });
    });
  }
}
