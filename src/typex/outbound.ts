import type { ChannelOutboundAdapter } from "../channels/plugins/types.js";
import { getTypeXClient } from "./client.js";
import { sendMessageTypeX } from "./send.js";

export const typexOutbound: ChannelOutboundAdapter = {
  deliveryMode: "direct",
  // chunker: ... (optional, default might be used or I can skip for MVP)
  chunkerMode: "markdown",
  textChunkLimit: 2000,

  sendText: async ({ to, text, accountId }) => {
    const client = getTypeXClient(accountId ?? undefined);
    const result = await sendMessageTypeX(client, to, { text });
    return {
      channel: "typex",
      messageId: result?.message_id || "unknown",
      chatId: to,
    };
  },

  sendMedia: async ({ to, text, mediaUrl, accountId }) => {
    const client = getTypeXClient(accountId ?? undefined);
    const result = await sendMessageTypeX(client, to, { text: text || "" }, { mediaUrl });
    return {
      channel: "typex",
      messageId: result?.message_id || "unknown",
      chatId: to,
    };
  },
};
