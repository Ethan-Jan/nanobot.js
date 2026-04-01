import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  InternalServerErrorException,
  Post,
  Query,
} from "@nestjs/common";
import * as core from "nanobot/api-lib";
import { NanobotConfigService } from "../config/nanobot-config.service";

@Controller("weixin")
export class WeixinLoginController {
  constructor(private readonly nanobot: NanobotConfigService) {}

  @Post("login/qr")
  async startQr(@Body() body: { force?: boolean }) {
    try {
      const cfg = await this.nanobot.loadConfig();
      return await core.startWeixinQrSession(cfg, { force: body?.force === true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("重新扫码请传 force")) {
        throw new ConflictException(msg);
      }
      throw new BadRequestException(msg);
    }
  }

  @Get("login/status")
  async pollStatus(@Query("qrcode") qrcode: string) {
    const id = qrcode?.trim();
    if (!id) throw new BadRequestException("缺少查询参数 qrcode");
    try {
      const cfg = await this.nanobot.loadConfig();
      return await core.pollWeixinQrAndMaybeSave(cfg, id);
    } catch (e) {
      throw new InternalServerErrorException(e instanceof Error ? e.message : String(e));
    }
  }
}
