import type { OpenClawConfig } from "../config/config.js";
import type { DmPolicy, GroupPolicy } from "../config/types.base.js";
import type { TypeXGroupConfig } from "../config/types.typex.js";
import { firstDefined } from "../feishu/access.js";

export type ResolvedTypeXConfig = {
  enabled: boolean;
  dmPolicy: DmPolicy;
  groupPolicy: GroupPolicy;
  allowFrom: string[];
  groupAllowFrom: string[];
  historyLimit: number;
  dmHistoryLimit: number;
  textChunkLimit: number;
  chunkMode: "length" | "newline";
  blockStreaming: boolean;
  streaming: boolean;
  mediaMaxMb: number;
  groups: Record<string, TypeXGroupConfig>;
};

/**
 * Resolve effective TypeX configuration for an account.
 * Account-level config overrides top-level typex config, which overrides channel defaults.
 */
export function resolveTypeXConfig(params: {
  cfg: OpenClawConfig;
  accountId?: string;
}): ResolvedTypeXConfig {
  const { cfg, accountId } = params;
  const typexCfg = cfg.channels?.typex;
  const accountCfg = accountId ? typexCfg?.accounts?.[accountId] : undefined;
  const defaults = cfg.channels?.defaults;

  return {
    enabled: firstDefined(accountCfg?.enabled, typexCfg?.enabled, true) ?? true,
    dmPolicy: firstDefined(accountCfg?.dmPolicy, typexCfg?.dmPolicy) ?? "pairing",
    groupPolicy:
      firstDefined(accountCfg?.groupPolicy, typexCfg?.groupPolicy, defaults?.groupPolicy) ?? "open",
    allowFrom: (accountCfg?.allowFrom ?? typexCfg?.allowFrom ?? []).map(String),
    groupAllowFrom: (accountCfg?.groupAllowFrom ?? typexCfg?.groupAllowFrom ?? []).map(String),
    historyLimit: firstDefined(accountCfg?.historyLimit, typexCfg?.historyLimit) ?? 10,
    dmHistoryLimit: firstDefined(accountCfg?.dmHistoryLimit, typexCfg?.dmHistoryLimit) ?? 20,
    textChunkLimit: firstDefined(accountCfg?.textChunkLimit, typexCfg?.textChunkLimit) ?? 2000,
    chunkMode: firstDefined(accountCfg?.chunkMode, typexCfg?.chunkMode) ?? "length",
    blockStreaming: firstDefined(accountCfg?.blockStreaming, typexCfg?.blockStreaming) ?? true,
    streaming: firstDefined(accountCfg?.streaming, typexCfg?.streaming) ?? true,
    mediaMaxMb: firstDefined(accountCfg?.mediaMaxMb, typexCfg?.mediaMaxMb) ?? 30,
    groups: { ...typexCfg?.groups, ...accountCfg?.groups },
  };
}

/**
 * Resolve group-specific configuration for a TypeX chat.
 */
export function resolveTypeXGroupConfig(params: {
  cfg: OpenClawConfig;
  accountId?: string;
  groupId: string;
}): { groupConfig?: TypeXGroupConfig } {
  const resolved = resolveTypeXConfig({ cfg: params.cfg, accountId: params.accountId });
  const groupConfig = resolved.groups[params.groupId];
  return { groupConfig };
}

/**
 * Check if a group requires @mention for the bot to respond.
 */
export function resolveTypeXGroupRequireMention(params: {
  cfg: OpenClawConfig;
  accountId?: string;
  groupId: string;
}): boolean {
  const { groupConfig } = resolveTypeXGroupConfig(params);
  // Default: require mention in groups
  return groupConfig?.requireMention ?? true;
}

/**
 * Check if a group is enabled.
 */
export function resolveTypeXGroupEnabled(params: {
  cfg: OpenClawConfig;
  accountId?: string;
  groupId: string;
}): boolean {
  const { groupConfig } = resolveTypeXGroupConfig(params);
  return groupConfig?.enabled ?? true;
}
