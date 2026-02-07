import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import { typexPlugin } from "./src/channel.js";

const plugin = {
  id: "typex",
  name: "TypeX",
  description: "TypeX channel integration for OpenClaw",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    api.registerChannel({ plugin: typexPlugin });
  },
};

export default plugin;
