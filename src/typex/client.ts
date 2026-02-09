import { loadConfig } from "../config/config.js";
import { getChildLogger } from "../logging.js";
import {
  TypeXMessageEnum,
  type TypeXClientOptions,
  type TypeXMessage,
  type TypeXMessageEntry,
} from "./types.js";

const logger = getChildLogger({ module: "typex-client" });
// const TYPEX_DOMAIN = "https://api-coco.typex.im";
const TYPEX_DOMAIN = "https://api-tx.bossjob.net.cn";

export class TypeXClient {
  private options: TypeXClientOptions;
  private accessToken?: string;
  private userId?: string;

  constructor(options: TypeXClientOptions) {
    this.options = options;
    if (options.token) {
      this.accessToken = options.token;
    }
  }

  async getAccessToken() {
    if (this.accessToken) {
      return this.accessToken;
    }
    return "";
  }

  async getCurUserId() {
    if (this.userId) {
      return this.userId;
    }
    return "";
  }

  async fetchQrcodeUrl() {
    try {
      // return {
      //   uuid: "17234567890",
      //   expired_at: 1678901234,
      //   url: "http://api.typex.com/open/claw/qrcode/login?qr_code_id=17234567890",
      // };
      const qrResponse = await fetch(`${TYPEX_DOMAIN}/user/qrcode?login_type=open`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-developer": "ryan" },
        body: JSON.stringify({}),
      });
      if (!qrResponse.ok) {
        throw new Error(`Failed to get QR code: ${qrResponse.statusText}`);
      }
      const qrResult = await qrResponse.json();
      if (qrResult.code !== 0 || !qrResult.data) {
        throw new Error(`Failed to get QR code: ${qrResult.msg}`);
      }

      return qrResult.data;
    } catch (error) {
      logger.error("generate qrcode failed:", error);
      throw error;
    }
  }

  async checkLoginStatus(qrcodeId: string) {
    logger.info("Starting TypeX login flow...");

    try {
      const checkRes = await fetch(`${TYPEX_DOMAIN}/open/qrcode/check_auth`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-developer": "ryan",
        },
        body: JSON.stringify({
          qr_code_id: qrcodeId,
        }),
      });
      console.log("checkRes", checkRes);
      const setCookieHeader = checkRes.headers.get("set-cookie");

      if (setCookieHeader) {
        const match = setCookieHeader.match(/(sessionid=[^;]+)/);

        if (match && match[1]) {
          this.accessToken = match[1];
          logger.info(`Session cookie captured: ${this.accessToken.substring(0, 20)}...`);
        }
      }
      const checkData = await checkRes.json();
      console.log("checkData", checkData);
      if (checkData.code === 0) {
        const { user_id } = checkData.data;
        this.userId = user_id;
        logger.info(`TypeX login successful! UserID: ${user_id}`);
        return true;
      } else if (checkData.code === 10001) {
        return false;
      } else {
        logger.warn(`Unexpected status: ${checkData.code} - ${checkData.message}`);
        return false;
      }
    } catch (error) {
      logger.error("Check login status exception:", error);
      throw error;
    }
  }

  async sendMessage(content: string | object, msgType: TypeXMessageEnum = 0) {
    const token = this.accessToken;
    if (!token) {
      logger.error("Cannot send message: No access token available.");
      throw new Error("TypeXClient: Not authenticated.");
    }

    let finalContent = content;
    if (typeof content === "object") {
      try {
        finalContent = JSON.stringify(content);
      } catch (e) {
        logger.warn("Failed to stringify message content", e);
        finalContent = String(content);
      }
    }

    logger.info(`TypeXClient sending message: content=${finalContent}`);

    try {
      const url = `${TYPEX_DOMAIN}/open/claw/send_message`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: finalContent,
          msg_type: msgType,
        }),
      });

      const resJson = await response.json();

      if (resJson.code !== 200) {
        throw new Error(`Send message failed: [${resJson.code}] ${resJson.message}`);
      }

      logger.debug("Message sent successfully", resJson.data);

      return (
        resJson.data || {
          message_id: `msg_${Date.now()}`,
        }
      );
    } catch (error) {
      logger.error("Error sending message to TypeX API:", error);
      throw error;
    }
  }

  async fetchMessages(pos: number) {
    if (!this.accessToken) {
      logger.warn("TypeXClient: No token, skipping fetch.");
      return [];
    }

    try {
      const url = `${TYPEX_DOMAIN}/open/claw/message`;

      logger.debug(`Fetching messages from pos: ${pos}`);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: this.accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pos: pos }),
      });

      const resJson = await response.json();

      if (resJson.code !== 200) {
        logger.warn(`Fetch failed with code ${resJson.code}: ${resJson.message}`);
        return [];
      }
      if (Array.isArray(resJson.data)) {
        return resJson.data;
      }

      return [];
    } catch (e) {
      logger.error("Fetch messages network error:", e);
      return [];
    }
  }
}

export function getTypeXClient(accountId?: string, manualOptions?: TypeXClientOptions) {
  let cfg;
  try {
    cfg = loadConfig();
  } catch (e) {
    cfg = {};
  }

  const typexCfg = cfg.channels?.typex || {};

  let token = manualOptions?.token;

  if (accountId && typexCfg.accounts?.[accountId]) {
    token = typexCfg.accounts[accountId].token;
  } else if (typexCfg.email) {
    token = typexCfg.token;
  }

  if (!manualOptions?.skipConfigCheck) {
    throw new Error("TypeX email not configured yet.");
  }

  return new TypeXClient({
    token: token,
  });
}
