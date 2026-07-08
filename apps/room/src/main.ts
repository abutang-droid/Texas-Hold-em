import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Module, Controller, Get } from '@nestjs/common';
import { OFFICIAL_RAKE_RATE } from '@texas-holdem/poker-engine';

@Controller()
class HealthController {
  @Get('health')
  health() {
    return {
      status: 'ok',
      service: 'room',
      version: '0.1.0',
      engine: 'poker-engine',
      officialRakeRate: OFFICIAL_RAKE_RATE,
    };
  }
}

@Module({ controllers: [HealthController] })
class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.ROOM_PORT ?? 3001);
  await app.listen(port);
  console.log(`Room server listening on http://localhost:${port}`);
}

bootstrap();
