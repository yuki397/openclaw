import type { TypeXClient } from "./client.js";
import type { TypeXEventPayload } from "./types.js";
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
  payload: TypeXEventPayload,
  appId: string,
  options: ProcessTypeXMessageOptions = {},
) {
  const cfg = options.cfg ?? loadConfig();
  const accountId = options.accountId ?? appId;

  const { data } = payload;
  if (!data || !data.chat_id) {
    logger.warn("Received invalid event payload");
    return;
  }

  const chatId = data.chat_id;
  const senderId = data.sender_id;
  const text = data.content; // Taking simple content for now

  // Build Context for Agent
  const ctx = {
    Body: text,
    RawBody: text,
    From: senderId,
    To: chatId,
    SenderId: senderId,
    ChatType: "dm", // Simplified
    Provider: "typex",
    Surface: "typex",
    Timestamp: data.create_time || Date.now(),
    MessageSid: data.message_id,
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
        if (responsePayload.text) {
          await sendMessageTypeX(client, chatId, { text: responsePayload.text });
        }

        // Handle media if present in response
        if (responsePayload.mediaUrl) {
          await sendMessageTypeX(client, chatId, {}, { mediaUrl: responsePayload.mediaUrl });
        }
      },
      onError: (err) => {
        logger.error(`Reply dispatch error: ${formatErrorMessage(err)}`);
      },
    },
    replyOptions: {
      disableBlockStreaming: true, // Not implementing streaming for TypeX MVP
      onModelSelected,
    },
  });
}
