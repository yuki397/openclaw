import type { TypeXClient } from "./client.js";
import type { TypeXMessageEntry } from "./types.js";
import { resolveSessionAgentId } from "../agents/agent-scope.js";
import { dispatchReplyWithBufferedBlockDispatcher } from "../auto-reply/reply/provider-dispatcher.js";
import { createReplyPrefixOptions } from "../channels/reply-prefix.js";
import { loadConfig, type OpenClawConfig } from "../config/config.js";
import { formatErrorMessage } from "../infra/errors.js";
import { getChildLogger } from "../logging.js";
import { sendMessageTypeX } from "./send.js";

const logger = getChildLogger({ module: "typex-message" });

export type ProcessTypeXMessageOptions = {
  cfg?: OpenClawConfig;
  accountId?: string;
  botName?: string;
};

export async function processTypeXMessage(
  client: TypeXClient,
  payload: TypeXMessageEntry,
  appId: string,
  options: ProcessTypeXMessageOptions = {},
) {
  const cfg = options.cfg ?? loadConfig();
  const accountId = options.accountId ?? appId;

  if (!payload || !payload.chat_id) {
    logger.warn("Received invalid event payload");
    return;
  }

  const chatId = payload.chat_id;
  const senderId = payload.sender_id;
  // Use content as text for now. If content is JSON string, parse it.
  let text = payload.content.text;
  // Attempt simple parsing if it looks like JSON? For now assume plain text or handle in future.

  // Basic logging
  logger.info(`Processing TypeX message from ${senderId} in ${chatId}`);

  // Build Context for Agent
  const ctx = {
    Body: text,
    RawBody: text,
    From: senderId,
    To: chatId,
    SenderId: senderId,
    SenderName: payload.sender_name || "User",
    ChatType: "dm", // Simplified, TypeX mostly DM for now?
    Provider: "typex",
    Surface: "typex",
    Timestamp: payload.create_time || Date.now(),
    MessageSid: payload.message_id,
    AccountId: accountId,
    OriginatingChannel: "typex",
    OriginatingTo: chatId,
  };

  const agentId = resolveSessionAgentId({ config: cfg });
  const { onModelSelected, ...prefixOptions } = createReplyPrefixOptions({
    cfg,
    agentId,
    channel: "typex",
    accountId,
  });

  // Dispatch to Agent
  await dispatchReplyWithBufferedBlockDispatcher({
    ctx,
    cfg,
    dispatcherOptions: {
      ...prefixOptions,
      deliver: async (responsePayload, info) => {
        // Handle outgoing replies from Agent
        console.log("info", info, responsePayload);

        // Handle text response
        if (responsePayload.text) {
          await sendMessageTypeX(client, responsePayload.text);
        }

        // Handle media if present in response
        const mediaUrls = responsePayload.mediaUrls?.length
          ? responsePayload.mediaUrls
          : responsePayload.mediaUrl
            ? [responsePayload.mediaUrl]
            : [];

        for (const mediaUrl of mediaUrls) {
          await sendMessageTypeX(client, {}, { mediaUrl });
        }
      },
      onError: (err) => {
        logger.error(`Reply dispatch error: ${formatErrorMessage(err)}`);
      },
    },
    replyOptions: {
      disableBlockStreaming: true,
      onModelSelected,
    },
  });
}
