import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useBodyParser("json", { limit: "512kb" });
  app.setGlobalPrefix("api");
  const port = Number(process.env.ADMIN_PORT ?? process.env.PORT ?? "18791");
  await app.listen(port, "127.0.0.1");
  console.error(`[@nanobot/api] http://127.0.0.1:${port}`);
  if (process.env.NANOBOT_API_DEV === "1") {
    console.error(
      "[@nanobot/api] 管理端页面请在本仓库执行 pnpm dev:admin，浏览器打开 Vite 地址（默认 http://127.0.0.1:5173 或终端里的 Network URL）",
    );
  }
}

void bootstrap();
