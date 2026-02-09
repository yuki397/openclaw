import * as fs from "fs/promises";
import * as path from "path";
import { loadConfig, type OpenClawConfig } from "../config/config.js";
import { getChildLogger } from "../logging.js";
import { RuntimeEnv } from "../runtime.js";
import { resolveTypeXAccount } from "./accounts.js";
import { getTypeXClient } from "./client.js";
import { processTypeXMessage } from "./message.js";

const logger = getChildLogger({ module: "typex-monitor" });

export type MonitorTypeXOpts = {
  account: any; // ResolvedTypeXAccount + extras from gateway
  runtime: RuntimeEnv;
  abortSignal: AbortSignal;
  log?: any;
};

export async function monitorTypeXProvider(opts: MonitorTypeXOpts) {
  const { account, runtime, abortSignal, log } = opts;
  // account.config has the raw config
  const { email, token, appId } = account.config;

  if (!token) {
    log?.warn(`[${account.accountId}] No token found. Stopping monitor.`);
    return;
  }

  // Initialize Client
  const client = getTypeXClient(undefined, { token, skipConfigCheck: true });

  log?.info(`[${account.accountId}] Starting TypeX monitor for ${email || account.accountId}...`);

  // --- State Recovery (POS) ---
  let currentPos = 0;
  // runtime.dirs.data might need assertion
  const dataDir = (runtime as any).dirs?.data || "./";
  const safeId = (email || account.accountId || "default").replace(/[^a-z0-9]/gi, "_");
  const stateFile = path.join(dataDir, `.typex_pos_${safeId}.json`);

  try {
    const data = await fs.readFile(stateFile, "utf-8");
    const json = JSON.parse(data);
    if (typeof json.pos === "number") currentPos = json.pos;
  } catch (e) {
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
          await processTypeXMessage(client, { data: msg }, appId || account.accountId, {
            accountId: account.accountId,
            cfg,
            botName: account.name,
          });

          if (typeof msg.id === "number" && msg.id > currentPos) {
            currentPos = msg.id;
          }
        }
        // Save state
        await fs.writeFile(stateFile, JSON.stringify({ pos: currentPos }));
      }
    } catch (err) {
      log?.error(`Error in TypeX polling loop: ${err}`);
    }

    if (abortSignal.aborted) break;
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  log?.info(`Stopping TypeX monitor...`);
}
