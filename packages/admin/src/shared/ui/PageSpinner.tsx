import { Spin } from "antd";

type Props = {
  size?: "small" | "default" | "large";
  tip?: string;
};

export function PageSpinner({ size = "large", tip }: Props) {
  return (
    <div style={{ textAlign: "center", padding: 48 }}>
      <Spin size={size} tip={tip} />
    </div>
  );
}
