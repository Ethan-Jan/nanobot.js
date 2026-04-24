import { useEffect, useState } from "react";
import { App, Alert, Button, Card, Form, Input, Select, Space, Typography } from "antd";
import { getUserContext, putUserContext } from "@/shared/api/userContextApi";
import type { UserContextDTO } from "@/shared/types/userContext";
import { PageSpinner } from "@/shared/ui/PageSpinner";

const detailOptions = [
  { value: "brief", label: "尽量简短" },
  { value: "normal", label: "平衡" },
  { value: "detailed", label: "可详细展开" },
];

type FormShape = {
  profile: {
    summary?: string;
    role?: string;
    domain?: string;
    techStackText?: string;
    timezoneOrSchedule?: string;
    notes?: string;
  };
  intent: { summary?: string; shortTerm?: string };
  preferences: {
    responseLanguage?: string;
    detailLevel?: "brief" | "normal" | "detailed";
    codeAndDocsStyle?: string;
    extra?: string;
  };
};

function dtoToForm(d: UserContextDTO): FormShape {
  return {
    profile: {
      summary: d.profile?.summary,
      role: d.profile?.role,
      domain: d.profile?.domain,
      techStackText: d.profile?.techStack?.length ? d.profile.techStack.join("、") : undefined,
      timezoneOrSchedule: d.profile?.timezoneOrSchedule,
      notes: d.profile?.notes,
    },
    intent: {
      summary: d.intent?.summary,
      shortTerm: d.intent?.shortTerm,
    },
    preferences: {
      responseLanguage: d.preferences?.responseLanguage,
      detailLevel: d.preferences?.detailLevel,
      codeAndDocsStyle: d.preferences?.codeAndDocsStyle,
      extra: d.preferences?.extra,
    },
  };
}

function formToDto(v: FormShape): UserContextDTO {
  const techRaw = (v.profile?.techStackText ?? "")
    .split(/[,，;；、]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const now = new Date().toISOString();
  return {
    version: 1,
    updatedAt: now,
    profile: {
      summary: v.profile?.summary?.trim() || undefined,
      role: v.profile?.role?.trim() || undefined,
      domain: v.profile?.domain?.trim() || undefined,
      techStack: techRaw.length ? techRaw : undefined,
      timezoneOrSchedule: v.profile?.timezoneOrSchedule?.trim() || undefined,
      notes: v.profile?.notes?.trim() || undefined,
    },
    intent: {
      summary: v.intent?.summary?.trim() || undefined,
      shortTerm: v.intent?.shortTerm?.trim() || undefined,
      updatedAt: now,
    },
    preferences: {
      responseLanguage: v.preferences?.responseLanguage?.trim() || undefined,
      detailLevel: v.preferences?.detailLevel,
      codeAndDocsStyle: v.preferences?.codeAndDocsStyle?.trim() || undefined,
      extra: v.preferences?.extra?.trim() || undefined,
    },
  };
}

export function UserContextPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm<FormShape>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<UserContextDTO | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const d = await getUserContext();
      setData(d);
      form.setFieldsValue(dtoToForm(d));
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const onFinish = async (values: FormShape) => {
    setSaving(true);
    try {
      const saved = await putUserContext(formToDto(values));
      setData(saved);
      form.setFieldsValue(dtoToForm(saved));
      message.success("已保存；对下一次对话/CLI 请求生效。");
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading || !data) {
    return <PageSpinner />;
  }

  return (
    <div>
      <Typography.Title level={3} style={{ marginTop: 0 }}>
        用户画像与偏好
      </Typography.Title>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        title="如何生效"
        description={
          <>
            内容保存在工作区 <Typography.Text code>tools.workspaceRoot</Typography.Text> 下{" "}
            <Typography.Text code>.nanobot/user-context.json</Typography.Text>，并注入 Agent 的 system
            提示，用于<strong>个人化</strong>回答；「用户意图」会提示模型当前协作重点。请勿写入密码或敏感令牌。
          </>
        }
      />
      <Card>
        <Form<FormShape> form={form} layout="vertical" onFinish={onFinish} initialValues={dtoToForm(data)}>
          <Typography.Title level={5}>用户画像</Typography.Title>
          <Form.Item name={["profile", "summary"]} label="概况（自然语言，你是谁、做什么）">
            <Input.TextArea rows={3} placeholder="例：全栈，主要负责公司内部 Node/React 中台" />
          </Form.Item>
          <Space wrap size="large" style={{ width: "100%" }}>
            <Form.Item name={["profile", "role"]} label="角色" style={{ minWidth: 200 }}>
              <Input placeholder="如：开发、产品" />
            </Form.Item>
            <Form.Item name={["profile", "domain"]} label="领域/场景" style={{ minWidth: 240 }}>
              <Input placeholder="如：SaaS、教育、研究" />
            </Form.Item>
          </Space>
          <Form.Item
            name={["profile", "techStackText"]}
            label="常用技术（逗号/顿号分隔）"
            extra="会解析为列表注入模型；例：TypeScript, React, pnpm"
          >
            <Input placeholder="TypeScript、React、NestJS" />
          </Form.Item>
          <Form.Item name={["profile", "timezoneOrSchedule"]} label="时区或作息（选填）">
            <Input placeholder="如：东八区，工作日 9–18 点" />
          </Form.Item>
          <Form.Item name={["profile", "notes"]} label="其它背景（选填）">
            <Input.TextArea rows={2} placeholder="对协作有影响的补充" />
          </Form.Item>

          <Typography.Title level={5} style={{ marginTop: 24 }}>
            用户意图
          </Typography.Title>
          <Form.Item
            name={["intent", "summary"]}
            label="当前主要想推进的事"
            extra="会随你保存而更新时间戳，便于模型对齐「现在最重要」"
          >
            <Input.TextArea rows={2} placeholder="例：本迭代完成管理端流式对话与用户画像" />
          </Form.Item>
          <Form.Item name={["intent", "shortTerm"]} label="更短期的具体目标（选填）">
            <Input.TextArea rows={2} />
          </Form.Item>

          <Typography.Title level={5} style={{ marginTop: 24 }}>
            偏好
          </Typography.Title>
          <Space wrap size="large" style={{ width: "100%" }}>
            <Form.Item name={["preferences", "responseLanguage"]} label="回复语言" style={{ minWidth: 200 }}>
              <Input placeholder="zh / en / 中英" />
            </Form.Item>
            <Form.Item name={["preferences", "detailLevel"]} label="详略">
              <Select allowClear options={detailOptions} placeholder="选填" style={{ minWidth: 180 }} />
            </Form.Item>
          </Space>
          <Form.Item name={["preferences", "codeAndDocsStyle"]} label="代码/文档风格（选填）">
            <Input placeholder="例：少注释、优先函数式、遵循仓库 ESLint" />
          </Form.Item>
          <Form.Item name={["preferences", "extra"]} label="其它偏好（选填）">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={saving}>
            保存
          </Button>
        </Form>
      </Card>
    </div>
  );
}
