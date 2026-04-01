import { Image, Modal, Typography } from "antd";
import type { WeixinQrStartResponse } from "@/shared/api";

type Props = {
  open: boolean;
  hint: string;
  session: WeixinQrStartResponse | null;
  onClose: () => void;
};

export function WeixinQrModal({ open, hint, session, onClose }: Props) {
  return (
    <Modal
      title="微信扫码登录（iLink）"
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
      width={400}
    >
      <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
        {hint}
      </Typography.Paragraph>
      {session ? (
        <div style={{ textAlign: "center" }}>
          <Image src={session.qrDataUrl} alt="微信登录二维码" preview={false} />
        </div>
      ) : null}
    </Modal>
  );
}
