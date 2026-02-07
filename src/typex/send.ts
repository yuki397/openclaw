import type { TypeXClient } from "./client.js";
import { formatErrorMessage } from "../infra/errors.js";
import { getChildLogger } from "../logging.js";
import { loadWebMedia } from "../web/media.js";

const logger = getChildLogger({ module: "typex-send" });

export type TypeXSendOpts = {
  msgType?: "text" | "image" | "file";
  mediaUrl?: string;
  maxBytes?: number;
};

export async function sendMessageTypeX(
  client: TypeXClient,
  chatId: string,
  content: string | { text?: string },
  opts: TypeXSendOpts = {},
) {
  let msgType = opts.msgType || "text";
  let finalContent: string | object = content;

  // Handle media
  if (opts.mediaUrl) {
    try {
      logger.info(`Loading media from: ${opts.mediaUrl}`);
      const media = await loadWebMedia(opts.mediaUrl, opts.maxBytes);
      const fileName = media.fileName ?? "file";

      // Upload file first
      const { file_key } = await client.uploadFile(media.buffer, fileName, "stream");

      // Update content to reference the file
      if (media.contentType?.includes("image")) {
        msgType = "image";
        finalContent = { image_key: file_key };
      } else {
        msgType = "file";
        finalContent = { file_key: file_key };
      }

      // Note: If there is also text, we might need to send a separate text message
      // mimicking Feishu's behavior where media and text are often separate.
      const text = typeof content === "string" ? content : content.text;
      if (text) {
        // Send text separately if needed, for now just log
        logger.debug("Sending accompanying text is not fully implemented in this stub");
      }
    } catch (err) {
      logger.error(`Media upload failed: ${formatErrorMessage(err)}`);
      throw err;
    }
  }

  // Send the main message
  try {
    const res = await client.sendMessage(chatId, finalContent, msgType);
    return res;
  } catch (err) {
    logger.error(`TypeX send exception: ${formatErrorMessage(err)}`);
    throw err;
  }
}
