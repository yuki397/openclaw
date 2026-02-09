import { loadConfig } from "../config/config.js";
import { getChildLogger } from "../logging.js";
import { TypeXMessageEnum, type TypeXClientOptions, type TypeXMessage } from "./types.js";

const logger = getChildLogger({ module: "typex-client" });
// const TYPEX_DOMAIN = "api-coco.typex.im";
const TYPEX_DOMAIN = "api-tx.bossjob.net.cn";

export class TypeXClient {
  private options: TypeXClientOptions;

  constructor(options: TypeXClientOptions) {
    this.options = options;
  }

  async getAccessToken() {
    if (this.accessToken) {
      return this.accessToken;
    }
    return "";
  }

  private accessToken?: string;

  async fetchQrcodeUrl() {
    try {
      return {
        uuid: "17234567890",
        expired_at: 1678901234,
        url: "http://api.typex.com/open/claw/qrcode/login?qr_code_id=17234567890",
      };
      const qrResponse = await fetch(`${TYPEX_DOMAIN}/open/claw/qrcode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const qrResult = await qrResponse.json();

      if (qrResult.code !== 200 || !qrResult.data) {
        throw new Error(`Failed to get QR code: ${qrResult.message}`);
      }

      // return qrResult.data;
    } catch (error) {
      logger.error("generate qrcode failed:", error);
      throw error;
    }
  }

  async checkLoginStatus(qrcodeId: string) {
    logger.info("Starting TypeX login flow...");

    try {
      const checkRes = await fetch(`${TYPEX_DOMAIN}/open/claw/auth_check`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          qr_code_id: qrcodeId,
        }),
      });

      const checkData = await checkRes.json();
      if (checkData.code === 200) {
        const { token, user_id } = checkData.data;
        this.accessToken = token;
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

    logger.info(`TypeXClient sending message: type=${msgType}, content=${finalContent}`);

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
