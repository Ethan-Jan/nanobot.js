import { Alert, Typography } from "antd";

export function WeixinLongPollHint() {
  return (
    <Alert
      type="info"
      showIcon
      style={{ marginBottom: 16 }}
      title="微信要能自动回复，终端里必须有长轮询进程"
      description={
        <>
          「已启用 / 已配置 token」只说明配置和本机登录文件就绪，不等于正在收消息。请在本机运行{" "}
          <Typography.Text code>pnpm dev:all</Typography.Text> 或{" "}
          <Typography.Text code>pnpm nanobot channels weixin start</Typography.Text>
          ，并在输出中看到{" "}
          <Typography.Text code>[weixin] channel: long-poll ready</Typography.Text>
          。若先启动后扫码，请等待约 8 秒自动重试或重启 dev:all。仅纯文本会走 Agent；配置了{" "}
          <Typography.Text code>allow_from</Typography.Text> 时需在白名单内。调试可设{" "}
          <Typography.Text code>NANOBOT_WEIXIN_VERBOSE=1</Typography.Text>。
        </>
      }
    />
  );
}
