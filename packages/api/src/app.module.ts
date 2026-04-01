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

const adminDist = join(__dirname, "..", "..", "admin", "dist-web");

@Module({
  imports: existsSync(join(adminDist, "index.html"))
    ? [
        ServeStaticModule.forRoot({
          rootPath: adminDist,
          // path-to-regexp v8：`/api/*path` 不匹配裸 `/api/`；用可选段 + 通配
          exclude: ["/api{/*path}"],
        }),
      ]
    : [],
  controllers: [HealthController, StatusController, ConfigController, ChatController],
  providers: [NanobotConfigService, ChatService],
})
export class AppModule {}
