import type { NanobotConfigDTO } from "@/shared/types";

/** Ant Design Form 使用的嵌套结构（与提交 patch 的扁平 config 不同） */
export type ConfigFormValues = {
  tools: NanobotConfigDTO["tools"];
  memory: NonNullable<NanobotConfigDTO["agents"]["memory"]>;
  persona: { displayName?: string; askNicknameOnStart?: boolean };
  weixin: NonNullable<NanobotConfigDTO["channels"]>["weixin"];
};

export function configToFormValues(c: NanobotConfigDTO): ConfigFormValues {
  return {
    tools: {
      allowShell: c.tools.allowShell,
      allowWrite: c.tools.allowWrite ?? true,
      workspaceRoot: c.tools.workspaceRoot,
    },
    memory: {
      enabled: c.agents.memory?.enabled ?? true,
      maxPersistedMessages: c.agents.memory?.maxPersistedMessages ?? 40,
    },
    persona: {
      displayName: c.agents.displayName ?? "",
      askNicknameOnStart: c.agents.askNicknameOnStart ?? false,
    },
    weixin: { ...(c.channels?.weixin ?? {}), token: "" },
  };
}

export function formValuesToPatch(values: ConfigFormValues): Record<string, unknown> {
  const weixinPatch: Record<string, unknown> = { ...values.weixin };
  const t = typeof values.weixin?.token === "string" ? values.weixin.token.trim() : "";
  if (t) weixinPatch.token = t;
  else delete weixinPatch.token;

  const dn = typeof values.persona?.displayName === "string" ? values.persona.displayName.trim() : "";
  return {
    tools: values.tools,
    agents: {
      memory: {
        enabled: values.memory.enabled,
        maxPersistedMessages: values.memory.maxPersistedMessages,
      },
      displayName: dn,
      askNicknameOnStart: Boolean(values.persona?.askNicknameOnStart),
    },
    channels: {
      weixin: weixinPatch,
    },
  };
}
