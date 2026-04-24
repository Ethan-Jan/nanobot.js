import { Body, Controller, HttpException, InternalServerErrorException, Post, Res } from "@nestjs/common";
import type { Response } from "express";
import { ChatService } from "./chat.service";

@Controller("chat")
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Post()
  async post(@Body() body: unknown) {
    try {
      return await this.chat.chat(body);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      throw new InternalServerErrorException(e instanceof Error ? e.message : String(e));
    }
  }

  @Post("stream")
  async postStream(@Body() body: unknown, @Res({ passthrough: false }) res: Response) {
    try {
      await this.chat.chatStream(body, res);
    } catch (e) {
      if (e instanceof HttpException) {
        res.status(e.getStatus()).json({
          message: typeof e.getResponse() === "string" ? e.getResponse() : (e.getResponse() as { message?: string })?.message ?? e.message,
        });
        return;
      }
      res.status(500).json({ message: e instanceof Error ? e.message : String(e) });
    }
  }
}
