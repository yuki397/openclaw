import { loadConfig } from "../config/config.js";
import { getChildLogger } from "../logging.js";
import { TypeXMessageEnum, type TypeXClientOptions, type TypeXMessage } from "./types.js";

const logger = getChildLogger({ module: "typex-client" });
const TYPEX_DOMAIN = "api-coco.typex.im";

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
    const token = await this.getAccessToken();
    logger.info(`TypeXClient sending message: type=${msgType}, content=${JSON.stringify(content)}`);
    // In a real implementation, this would make an HTTP request to the TypeX API
    return {
      message_id: `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    };
  }

  async uploadFile(buffer: Buffer, fileName: string, fileType: string) {
    logger.info(`TypeXClient uploading file: ${fileName} (${fileType})`);
    return {
      file_key: `file_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    };
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

  let email = manualOptions?.email;
  let token = manualOptions?.token;

  if (!email) {
    if (accountId && typexCfg.accounts?.[accountId]) {
      email = typexCfg.accounts[accountId].email;
      token = typexCfg.accounts[accountId].token;
    } else if (typexCfg.email) {
      email = typexCfg.email;
      token = typexCfg.token;
    }
  }

  if (!email && !manualOptions?.skipConfigCheck) {
    throw new Error("TypeX email not configured yet.");
  }

  return new TypeXClient({
    email: email || "",
    token: token,
  });
}
