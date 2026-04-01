import type { ChatTurn } from "@/shared/api";

export type ChatThread = {
  id: string;
  title: string;
  updatedAt: number;
  turns: ChatTurn[];
};
