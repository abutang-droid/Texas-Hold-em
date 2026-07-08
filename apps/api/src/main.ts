import 'reflect-metadata';
import {
  NestFactory,
} from '@nestjs/core';
import {
  Module,
  Controller,
  Post,
  Get,
  Body,
  Headers,
  Param,
  Query,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  ParseIntPipe,
} from '@nestjs/common';
import {
  createGuestUser,
  findUserById,
  mockRecharge,
  signAccessToken,
  verifyAccessToken,
  newDeviceId,
  getWeeklyProfitTop,
  searchUsers,
  setUserStatus,
  adminAdjustChips,
  verifyAdminKey,
  listHandHistories,
  getHandById,
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

function requireAdmin(authHeader?: string): void {
  if (!verifyAdminKey(authHeader)) {
    throw new ForbiddenException({ code: 'FORBIDDEN', messageKey: 'errors.admin_forbidden' });
  }
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
    status: user.status,
  };
}

function toHandRow(row: Awaited<ReturnType<typeof getHandById>>) {
  if (!row) return null;
  return {
    handId: row.hand_id,
    roomId: row.room_id,
    roomType: row.room_type,
    potSize: Number(row.pot_size),
    rakeAmount: Number(row.rake_amount),
    boardCards: row.board_cards,
    winners: row.winners_json,
    actions: row.actions_json,
    playerSnapshot: row.player_snapshot,
    createdAt: row.created_at,
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
    if (user.status === 'BANNED' || user.status === 'FROZEN') {
      throw new ForbiddenException({ code: 'FORBIDDEN', messageKey: 'errors.account_blocked' });
    }
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

@Controller('api/v1/admin')
class AdminController {
  @Get('users')
  async users(@Headers('authorization') auth: string, @Query('q') q?: string) {
    requireAdmin(auth);
    const rows = await searchUsers(q ?? '', 50);
    return { code: 0, message: 'ok', data: { list: rows.map(toProfile) } };
  }

  @Post('users/:id/ban')
  async banUser(
    @Headers('authorization') auth: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status?: 'BANNED' | 'FROZEN' | 'ACTIVE' },
  ) {
    requireAdmin(auth);
    const status = body.status ?? 'BANNED';
    const user = await setUserStatus(id, status);
    if (!user) throw new BadRequestException('User not found');
    return { code: 0, message: 'ok', data: toProfile(user) };
  }

  @Post('users/:id/adjust-chips')
  async adjustChips(
    @Headers('authorization') auth: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { amount: number; reason: string },
  ) {
    requireAdmin(auth);
    const balance = await adminAdjustChips(id, Math.floor(body.amount), body.reason ?? 'admin');
    return { code: 0, message: 'ok', data: { chipsBalance: balance } };
  }

  @Get('hands')
  async hands(
    @Headers('authorization') auth: string,
    @Query('roomId') roomId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    requireAdmin(auth);
    const rows = await listHandHistories({
      roomId,
      limit: limit ? Number(limit) : 20,
      offset: offset ? Number(offset) : 0,
    });
    return {
      code: 0,
      message: 'ok',
      data: {
        list: rows.map((row) => toHandRow(row)!),
      },
    };
  }

  @Get('hands/:handId')
  async handDetail(@Headers('authorization') auth: string, @Param('handId') handId: string) {
    requireAdmin(auth);
    const row = await getHandById(handId);
    if (!row) throw new BadRequestException('Hand not found');
    return { code: 0, message: 'ok', data: toHandRow(row) };
  }
}

@Controller()
class HealthController {
  @Get('health')
  health() {
    return { status: 'ok', service: 'api', version: '0.2.1' };
  }
}

@Module({ controllers: [HealthController, ApiController, AdminController] })
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
