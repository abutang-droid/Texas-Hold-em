import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Module, Controller, Get } from '@nestjs/common';

@Controller()
class HealthController {
  @Get('health')
  health() {
    return { status: 'ok', service: 'api', version: '0.1.0' };
  }

  @Get('api/v1/health')
  apiHealth() {
    return { code: 0, message: 'ok', data: { service: 'api' } };
  }
}

@Module({ controllers: [HealthController] })
class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.API_PORT ?? 3000);
  await app.listen(port);
  console.log(`API server listening on http://localhost:${port}`);
}

bootstrap();
