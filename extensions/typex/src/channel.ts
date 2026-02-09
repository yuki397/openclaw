import type { ChannelPlugin } from "openclaw/plugin-sdk";
import {
  buildChannelConfigSchema,
  DEFAULT_ACCOUNT_ID,
  // Note: some helpers might need to be imported from src paths if not exported by SDK
  // For this example assuming we have access or implementing simplified versions
} from "openclaw/plugin-sdk";
// Direct imports from core to link logic
import { monitorTypeXProvider } from "../../../src/typex/monitor.js";
import { typexOutbound } from "../../../src/typex/outbound.js";
import { TypeXConfigSchema } from "./config-schema.js";
import { typexOnboardingAdapter } from "./onboarding.js";

const meta = {
  id: "typex",
  label: "TypeX",
  selectionLabel: "TypeX Channel",
  detailLabel: "TypeX Bot",
  docsPath: "/channels/typex",
  docsLabel: "typex",
  blurb: "Integration with TypeX platform.",
  order: 100,
};

export const typexPlugin: ChannelPlugin<any> = {
  // using any for resolved config type for MVP
  id: "typex",
  meta,
  onboarding: typexOnboardingAdapter,
  capabilities: {
    chatTypes: ["direct"],
    media: true,
    reactions: false,
    threads: false,
    polls: false,
    nativeCommands: false,
    blockStreaming: false,
  },
  reload: { configPrefixes: ["channels.typex"] },
  outbound: typexOutbound as any,

  // Simplified Messaging Setup
  messaging: {
    normalizeTarget: (t) => t, // No-op normalization
    targetResolver: {
      looksLikeId: () => true,
      hint: "chat_id",
    },
  },

  configSchema: buildChannelConfigSchema(TypeXConfigSchema),

  config: {
    // Implementing minimal config helpers
    listAccountIds: (cfg) => {
      const accs = cfg.channels?.typex?.accounts || {};
      return Object.keys(accs);
    },
    resolveAccount: (cfg, accountId) => {
      const id = accountId || DEFAULT_ACCOUNT_ID;
      const globalCheck = cfg.channels?.typex;
      const account =
        cfg.channels?.typex?.accounts?.[id] ||
        (id === DEFAULT_ACCOUNT_ID ? globalCheck : undefined);
      return {
        accountId: id,
        name: account?.name || "TypeX",
        enabled: account?.enabled !== false,
        configured: Boolean(account?.email),
        tokenSource: "config",
        config: account || {},
      };
    },
    defaultAccountId: (cfg) => {
      // Simple default logic
      const accs = cfg.channels?.typex?.accounts || {};
      const first = Object.keys(accs)[0];
      return first || DEFAULT_ACCOUNT_ID;
    },
    setAccountEnabled: ({ cfg }) => cfg, // No-op for MVP (should return cfg)
    deleteAccount: ({ cfg }) => cfg, // No-op for MVP (should return cfg)
    isConfigured: (acc) => acc.configured,
    describeAccount: (acc) => ({
      accountId: acc.accountId!,
      name: acc.name,
      enabled: acc.enabled,
      configured: acc.configured,
      tokenSource: acc.tokenSource,
    }),
    resolveAllowFrom: () => [],
    formatAllowFrom: () => [],
  },

  // Gateway: Provide the start logic
  gateway: {
    startAccount: async (ctx) => {
      const { account, log, setStatus, abortSignal, cfg, runtime } = ctx;
      const { appId, appSecret } = account.config;

      if (!appId || !appSecret) {
        throw new Error("TypeX app ID/secret not configured");
      }

      log?.info(`[${account.accountId}] starting TypeX provider`);
      setStatus({
        accountId: account.accountId,
        running: true,
        lastStartAt: Date.now(),
      });

      try {
        await monitorTypeXProvider({
          accountId: account.accountId,
          config: cfg,
          runtime,
          abortSignal,
        });
      } catch (err) {
        setStatus({
          accountId: account.accountId,
          running: false,
          lastError: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    },
  },

  security: {
    // Simplified security policy
    resolveDmPolicy: () => ({
      policy: "open",
      allowFrom: [],
      policyPath: "",
      allowFromPath: "",
      approveHint: "",
      normalizeEntry: (s) => s,
    }),
  },

  groups: {
    resolveRequireMention: () => false,
  },

  directory: {
    self: async () => null,
    listPeers: async () => [],
    listGroups: async () => [],
  },

  status: {
    defaultRuntime: {
      accountId: DEFAULT_ACCOUNT_ID,
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null,
    },
    collectStatusIssues: () => [],
    buildChannelSummary: async ({ snapshot }) => ({
      configured: snapshot.configured,
      tokenSource: snapshot.tokenSource,
      running: snapshot.running,
      lastStartAt: snapshot.lastStartAt,
      lastStopAt: snapshot.lastStopAt,
      lastError: snapshot.lastError,
      probe: snapshot.probe,
      lastProbeAt: snapshot.lastProbeAt,
    }),
    probeAccount: async () => ({ ok: true, timestamp: Date.now() }), // Mock probe
    buildAccountSnapshot: ({ account, runtime }) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: account.configured,
      tokenSource: account.tokenSource,
      running: runtime?.running ?? false,
      lastStartAt: runtime?.lastStartAt ?? null,
      lastStopAt: runtime?.lastStopAt ?? null,
      lastError: runtime?.lastError ?? null,
      lastInboundAt: null,
      lastOutboundAt: null,
    }),
    logSelfId: () => {},
  },
};
