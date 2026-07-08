import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Module, Controller, Post, Get, Body, Headers, UnauthorizedException, BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  createGuestUser,
  findUserById,
  mockRecharge,
  signAccessToken,
  verifyAccessToken,
  newDeviceId,
  getWeeklyProfitTop,
  type UserRow,
} from '@texas-holdem/db';
import type { SupportedLocale } from '@texas-holdem/shared';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@texas-holdem/shared';

function parseLocale(header?: string): SupportedLocale {
  if (!header) return DEFAULT_LOCALE;
  const lang = header.split(',')[0]?.trim();
  if (SUPPORTED_LOCALES.includes(lang as SupportedLocale)) return lang as SupportedLocale;
  if (lang?.startsWith('zh')) return 'zh-CN';
  return DEFAULT_LOCALE;
}

function authUser(authHeader?: string): { userId: number; nickname: string } {
  const token = authHeader?.replace(/^Bearer\s+/i, '');
  if (!token) throw new UnauthorizedException({ code: 'UNAUTHORIZED', messageKey: 'errors.unauthorized' });
  const payload = verifyAccessToken(token);
  if (!payload) throw new UnauthorizedException({ code: 'UNAUTHORIZED', messageKey: 'errors.unauthorized' });
  return { userId: payload.sub, nickname: payload.nickname };
}

function toProfile(user: UserRow) {
  return {
    id: user.id,
    nickname: user.nickname,
    avatarUrl: user.avatar_url,
    chipsBalance: Number(user.chips_balance),
    level: user.level,
    totalExp: user.total_exp,
    preferredLocale: user.preferred_locale,
  };
}

@Controller('api/v1')
class ApiController {
  @Post('auth/guest')
  async guestLogin(
    @Body() body: { deviceId?: string; nickname?: string },
    @Headers('accept-language') acceptLang?: string,
  ) {
    const locale = parseLocale(acceptLang);
    const deviceId = body.deviceId ?? newDeviceId();
    const nickname = body.nickname ?? `Guest_${deviceId.slice(0, 6)}`;
    const user = await createGuestUser(deviceId, nickname, locale);
    const token = signAccessToken({ sub: user.id, nickname: user.nickname });
    return {
      code: 0,
      message: 'ok',
      data: { token, deviceId, user: toProfile(user) },
    };
  }

  @Get('user/profile')
  async profile(@Headers('authorization') auth?: string) {
    const { userId } = authUser(auth);
    const user = await findUserById(userId);
    if (!user) throw new UnauthorizedException();
    return { code: 0, message: 'ok', data: toProfile(user) };
  }

  @Post('shop/mock-recharge')
  async mockRecharge(
    @Headers('authorization') auth: string,
    @Body() body: { amount: number; requestId: string },
  ) {
    if (process.env.PAYMENT_MODE !== 'mock') {
      throw new ForbiddenException({ code: 'FORBIDDEN', messageKey: 'errors.mock_payment_disabled' });
    }
    const { userId } = authUser(auth);
    const amount = Math.floor(body.amount);
    if (!amount || amount <= 0) throw new BadRequestException('Invalid amount');
    if (amount > 50000) throw new BadRequestException('Daily limit exceeded');
    const balance = await mockRecharge(userId, amount, body.requestId ?? `mock-${Date.now()}`);
    return { code: 0, message: 'ok', data: { chipsBalance: balance, amount } };
  }

  @Post('match/quick-start')
  async quickStart(@Headers('authorization') auth: string) {
    const { userId } = authUser(auth);
    const user = await findUserById(userId);
    if (!user) throw new UnauthorizedException();
    if (Number(user.chips_balance) < 2) {
      throw new BadRequestException({ code: 'INSUFFICIENT_CHIPS', messageKey: 'errors.insufficient_chips' });
    }
    const roomId = `R${String(userId).padStart(4, '0')}${Date.now().toString().slice(-4)}`;
    const roomServerUrl = process.env.ROOM_SERVER_URL ?? 'http://localhost:3001';
    return {
      code: 0,
      message: 'ok',
      data: {
        roomId,
        wsUrl: roomServerUrl,
        buyInCap: 100,
        blinds: { sb: 1, bb: 2 },
      },
    };
  }

  @Get('leaderboard/weekly-profit')
  async weeklyProfit() {
    const top = await getWeeklyProfitTop(10);
    const enriched = await Promise.all(
      top.map(async (row) => {
        const user = await findUserById(row.userId);
        return {
          userId: row.userId,
          nickname: user?.nickname ?? `Player${row.userId}`,
          profit: row.score,
        };
      }),
    );
    return { code: 0, message: 'ok', data: { list: enriched } };
  }
}

@Controller()
class HealthController {
  @Get('health')
  health() {
    return { status: 'ok', service: 'api', version: '0.2.0' };
  }
}

@Module({ controllers: [HealthController, ApiController] })
class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: true });
  const port = Number(process.env.API_PORT ?? 3000);
  await app.listen(port);
  console.log(`API server listening on http://localhost:${port}`);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
