import type { TypeXClient } from "./client.js";
import { formatErrorMessage } from "../infra/errors.js";
import { getChildLogger } from "../logging.js";
import { loadWebMedia } from "../web/media.js";
import { TypeXMessageEnum } from "./types.ts";

const logger = getChildLogger({ module: "typex-send" });

export type TypeXSendOpts = {
  msgType?: TypeXMessageEnum;
  mediaUrl?: string;
  maxBytes?: number;
};

export async function sendMessageTypeX(
  client: TypeXClient,
  content: string | { text?: string },
  opts: TypeXSendOpts = {},
) {
  let msgType = opts.msgType || TypeXMessageEnum.text;
  let finalContent: string | object = content;

  // Send the main message
  try {
    const res = await client.sendMessage(finalContent, msgType);
    return res;
  } catch (err) {
    logger.error(`TypeX send exception: ${formatErrorMessage(err)}`);
    throw err;
  }
}
