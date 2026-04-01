import { Button, Descriptions, Space, Tag, Typography } from "antd";
import type { StatusPayload } from "@/shared/api";

type Props = {
  data: StatusPayload;
  qrLoading: boolean;
  onStartQr: () => void;
};

export function WeixinChannelDescriptions({ data, qrLoading, onStartQr }: Props) {
  const wx = data.channels?.weixin;

  if (wx) {
    return (
      <Descriptions column={1} size="small" bordered>
        <Descriptions.Item label="微信 (Weixin)">
          <Space wrap align="center">
            <Tag color={wx.enabled ? "processing" : "default"}>
              {wx.enabled ? "已启用" : "未启用"}
            </Tag>
            <Tag color={wx.hasToken ? "success" : "warning"}>
              {wx.hasToken ? "已配置 token" : "未配置 token"}
            </Tag>
            <Button type="link" size="small" loading={qrLoading} onClick={onStartQr}>
              {wx.hasToken ? "重新扫码关联" : "扫码关联微信"}
            </Button>
          </Space>
        </Descriptions.Item>
        <Descriptions.Item label="iLink base">
          {wx.baseUrl ?? <Typography.Text type="secondary">默认</Typography.Text>}
        </Descriptions.Item>
        <Descriptions.Item label="白名单 from">
          {wx.allowFromCount === 0 ? (
            <Typography.Text type="secondary">未限制（空列表表示全部）</Typography.Text>
          ) : (
            `${wx.allowFromCount} 个 ID`
          )}
        </Descriptions.Item>
        <Descriptions.Item label="状态目录">
          {wx.stateDir ?? (
            <Typography.Text type="secondary">默认 .nanobot-runtime/weixin</Typography.Text>
          )}
        </Descriptions.Item>
        {wx.pollTimeout != null ? (
          <Descriptions.Item label="轮询超时 (秒)">{wx.pollTimeout}</Descriptions.Item>
        ) : null}
      </Descriptions>
    );
  }

  return (
    <Descriptions column={1} size="small" bordered>
      <Descriptions.Item label="微信 (Weixin)">
        <Space wrap align="center">
          <Typography.Text type="secondary">
            配置摘要中无微信段（若已合并默认配置仍可能可用）
          </Typography.Text>
          <Button type="link" size="small" loading={qrLoading} onClick={onStartQr}>
            扫码关联微信
          </Button>
        </Space>
      </Descriptions.Item>
    </Descriptions>
  );
}
