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
}

void bootstrap();
