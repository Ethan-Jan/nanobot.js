import { Body, Controller, HttpException, InternalServerErrorException, Post } from "@nestjs/common";
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
}
