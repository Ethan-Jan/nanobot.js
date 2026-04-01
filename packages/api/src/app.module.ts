import { existsSync } from "node:fs";
import { join } from "node:path";
import { Module } from "@nestjs/common";
import { ServeStaticModule } from "@nestjs/serve-static";
import { ChatController } from "./chat/chat.controller";
import { ChatService } from "./chat/chat.service";
import { ConfigController } from "./config/config.controller";
import { NanobotConfigService } from "./config/nanobot-config.service";
import { HealthController } from "./health/health.controller";
import { StatusController } from "./status/status.controller";
import { WeixinLoginController } from "./weixin/weixin-login.controller";

const adminDist = join(__dirname, "..", "..", "admin", "dist-web");

/** `start:dev` 设置：开发时用 Vite（5173）+ HMR；勿用上次 build 的 dist-web 冒充热更新 */
const serveAdminUi =
  process.env.NANOBOT_API_DEV !== "1" && existsSync(join(adminDist, "index.html"));

@Module({
  imports: serveAdminUi
    ? [
        ServeStaticModule.forRoot({
          rootPath: adminDist,
          // path-to-regexp v8：`/api/*path` 不匹配裸 `/api/`；用可选段 + 通配
          exclude: ["/api{/*path}"],
        }),
      ]
    : [],
  controllers: [HealthController, StatusController, ConfigController, ChatController, WeixinLoginController],
  providers: [NanobotConfigService, ChatService],
})
export class AppModule {}
