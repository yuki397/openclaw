import * as fs from "fs/promises";
import * as path from "path";
import { loadConfig } from "../config/config.js";
import { RuntimeEnv } from "../runtime.js";
import { getTypeXClient } from "./client.js";
import { processTypeXMessage } from "./message.js";

export type MonitorTypeXOpts = {
  account: unknown; // ResolvedTypeXAccount + extras from gateway
  runtime: RuntimeEnv;
  abortSignal: AbortSignal;
  log?: unknown;
};

export async function monitorTypeXProvider(opts: MonitorTypeXOpts) {
  console.log("monitorTypeXProvider");
  try {
    const { account, runtime, abortSignal, log } = opts;
    const accountObj = account as {
      config: { email?: string; token?: string; appId?: string };
      accountId: string;
      name?: string;
    };
    const { email, token, appId } = accountObj.config;
    // log is unknown, cast for usage
    const logger = log as
      | { warn: (msg: string) => void; info: (msg: string) => void; error: (msg: string) => void }
      | undefined;

    if (!token) {
      logger?.warn(`[${accountObj.accountId}] No token found. Stopping monitor.`);
      return;
    }

    // Initialize Client
    const client = getTypeXClient(undefined, { token, skipConfigCheck: true });

    logger?.info(
      `[${accountObj.accountId}] Starting TypeX monitor for ${email || accountObj.accountId}...`,
    );

    // --- State Recovery (POS) ---
    let currentPos = 0;
    // runtime.dirs.data might need assertion
    const dataDir = (runtime as unknown as { dirs?: { data?: string } }).dirs?.data || "./";
    const safeId = (email || accountObj.accountId || "default").replace(/[^a-z0-9]/gi, "_");
    const stateFile = path.join(dataDir, `.typex_pos_${safeId}.json`);

    try {
      const data = await fs.readFile(stateFile, "utf-8");
      const json = JSON.parse(data);
      if (typeof json.pos === "number") {
        currentPos = json.pos;
      }
    } catch {
      /* Ignore */
    }

    const cfg = loadConfig();

    // --- Polling Loop ---
    while (!abortSignal.aborted) {
      try {
        const messages = await client.fetchMessages(currentPos);

        if (messages && messages.length > 0) {
          for (const msg of messages) {
            // Dispatch to OpenClaw via processTypeXMessage
            await processTypeXMessage(client, { data: msg }, appId || accountObj.accountId, {
              accountId: accountObj.accountId,
              cfg,
              botName: accountObj.name,
            });

            if (typeof msg.id === "number" && msg.id > currentPos) {
              currentPos = msg.id;
            }
          }
          // Save state
          await fs.writeFile(stateFile, JSON.stringify({ pos: currentPos }));
        }
      } catch (err) {
        logger?.error(
          `Error in TypeX polling loop: ${err instanceof Error ? err.stack : String(err)}`,
        );
      }

      if (abortSignal.aborted) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 3000));
      logger?.info(`Stopping TypeX monitor...`);
    }
  } catch (e) {
    throw e;
  }
}
