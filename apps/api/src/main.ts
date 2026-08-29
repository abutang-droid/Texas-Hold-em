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
  signAccessToken,
  verifyAccessToken,
  newDeviceId,
  getDualLeaderboard,
  searchUsers,
  setUserStatus,
  adminAdjustChips,
  verifyAdminKey,
  adminGrantPrivatePermission,
  listHandHistories,
  getHandById,
  getSystemConfig,
  updateSystemConfig,
  isPrivateRoomAllowed,
  grantPrivateRoomPermission,
  createPrivateRoom,
  findPrivateRoomByCode,
  countOfficialHandsForUser,
  createReport,
  listReports,
  updateReportStatus,
  getEconomyStats,
  listRiskAlerts,
  processRecharge,
  listUserChipTransactions,
  getIapProducts,
  declareAge,
  setSelfExclusion,
  acknowledgeBetaMigration,
  getComplianceStatus,
  isUserPlayAllowed,
  setAdminRemark,
  verifyOAuthIdToken,
  loginOrRegisterOAuth,
  registerWithEmail,
  loginWithEmail,
  isValidEmail,
  isValidPassword,
  createRefreshSession,
  rotateRefreshSession,
  updateUserProfile,
  setLeaderboardStealth,
  getUserSettings,
  type UserRow,
  type RechargeChannel,
  type OAuthProvider,
} from '@texas-holdem/db';
import type { SupportedLocale } from '@texas-holdem/shared';
import { AVATAR_PRESETS, DEFAULT_LOCALE, isValidPresetAvatarUrl, SUPPORTED_LOCALES } from '@texas-holdem/shared';

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
    privateRoomPermission: user.private_room_permission,
    ageVerified: !!user.age_verified_at,
    hasCompletedRecharge: !!user.has_completed_recharge,
  };
}

async function assertPlayAllowed(userId: number): Promise<UserRow> {
  const user = await findUserById(userId);
  if (!user) throw new UnauthorizedException();
  if (!(await isUserPlayAllowed(userId))) {
    throw new ForbiddenException({ code: 'FORBIDDEN', messageKey: 'errors.account_blocked' });
  }
  const compliance = await getComplianceStatus(userId, user.preferred_locale);
  if (!compliance.ageVerified) {
    throw new ForbiddenException({ code: 'AGE_REQUIRED', messageKey: 'errors.age_required' });
  }
  if (compliance.migrationRequired) {
    throw new ForbiddenException({ code: 'MIGRATION_REQUIRED', messageKey: 'errors.migration_required' });
  }
  return user;
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
    const refreshToken = await createRefreshSession(user.id);
    return {
      code: 0,
      message: 'ok',
      data: { token, refreshToken, deviceId, user: toProfile(user) },
    };
  }

  @Post('auth/oauth')
  async oauthLogin(
    @Body() body: { provider: OAuthProvider; idToken: string; nickname?: string },
    @Headers('accept-language') acceptLang?: string,
    @Headers('authorization') auth?: string,
  ) {
    const provider = body.provider;
    if (provider !== 'APPLE' && provider !== 'GOOGLE') {
      throw new BadRequestException('Invalid provider');
    }
    const verified = verifyOAuthIdToken(provider, body.idToken);
    if (!verified) {
      throw new UnauthorizedException({ code: 'INVALID_TOKEN', messageKey: 'errors.invalid_oauth' });
    }

    let linkGuestUserId: number | undefined;
    try {
      linkGuestUserId = authUser(auth).userId;
    } catch {
      /* optional guest bind */
    }

    const locale = parseLocale(acceptLang);
    const nickname =
      body.nickname ?? `${provider === 'APPLE' ? 'Apple' : 'Google'}_${verified.sub.slice(-6)}`;
    const user = await loginOrRegisterOAuth({
      provider,
      sub: verified.sub,
      nickname,
      locale,
      linkGuestUserId,
    });
    const token = signAccessToken({ sub: user.id, nickname: user.nickname });
    const refreshToken = await createRefreshSession(user.id);
    return {
      code: 0,
      message: 'ok',
      data: { token, refreshToken, user: toProfile(user) },
    };
  }

  @Post('auth/register')
  async emailRegister(
    @Body() body: { email: string; password: string; nickname?: string },
    @Headers('accept-language') acceptLang?: string,
    @Headers('authorization') auth?: string,
  ) {
    if (!body.email?.trim()) {
      throw new BadRequestException({ code: 'INVALID_EMAIL', messageKey: 'errors.invalid_email' });
    }
    if (!isValidEmail(body.email)) {
      throw new BadRequestException({ code: 'INVALID_EMAIL', messageKey: 'errors.invalid_email' });
    }
    if (!isValidPassword(body.password ?? '')) {
      throw new BadRequestException({ code: 'WEAK_PASSWORD', messageKey: 'errors.weak_password' });
    }

    let linkGuestUserId: number | undefined;
    try {
      linkGuestUserId = authUser(auth).userId;
    } catch {
      /* optional guest bind */
    }

    const locale = parseLocale(acceptLang);
    const nickname = body.nickname?.trim() || body.email.split('@')[0]!.slice(0, 32);

    try {
      const user = await registerWithEmail({
        email: body.email,
        password: body.password,
        nickname,
        locale,
        linkGuestUserId,
      });
      const token = signAccessToken({ sub: user.id, nickname: user.nickname });
      const refreshToken = await createRefreshSession(user.id);
      return {
        code: 0,
        message: 'ok',
        data: { token, refreshToken, user: toProfile(user) },
      };
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === 'EMAIL_TAKEN') {
        throw new BadRequestException({ code: 'EMAIL_TAKEN', messageKey: 'errors.email_taken' });
      }
      throw e;
    }
  }

  @Post('auth/login')
  async emailLogin(@Body() body: { email: string; password: string }) {
    if (!body.email?.trim() || !body.password) {
      throw new BadRequestException({ code: 'INVALID_CREDENTIALS', messageKey: 'errors.invalid_credentials' });
    }

    try {
      const user = await loginWithEmail(body.email, body.password);
      if (!user) {
        throw new UnauthorizedException({
          code: 'INVALID_CREDENTIALS',
          messageKey: 'errors.invalid_credentials',
        });
      }
      const token = signAccessToken({ sub: user.id, nickname: user.nickname });
      const refreshToken = await createRefreshSession(user.id);
      return {
        code: 0,
        message: 'ok',
        data: { token, refreshToken, user: toProfile(user) },
      };
    } catch (e) {
      if ((e as Error).message === 'ACCOUNT_BLOCKED') {
        throw new ForbiddenException({ code: 'FORBIDDEN', messageKey: 'errors.account_blocked' });
      }
      throw e;
    }
  }

  @Post('auth/refresh')
  async refresh(@Body() body: { refreshToken: string }) {
    const rotated = await rotateRefreshSession(body.refreshToken);
    if (!rotated) {
      throw new UnauthorizedException({ code: 'INVALID_REFRESH', messageKey: 'errors.invalid_refresh' });
    }
    const user = await findUserById(rotated.userId);
    if (!user) throw new UnauthorizedException();
    const token = signAccessToken({ sub: user.id, nickname: user.nickname });
    return {
      code: 0,
      message: 'ok',
      data: { token, refreshToken: rotated.newRefreshToken, user: toProfile(user) },
    };
  }

  @Get('user/profile')
  async profile(@Headers('authorization') auth?: string) {
    const { userId } = authUser(auth);
    const user = await findUserById(userId);
    if (!user) throw new UnauthorizedException();
    const settings = await getUserSettings(userId);
    return { code: 0, message: 'ok', data: { ...toProfile(user), settings } };
  }

  @Get('user/avatar-presets')
  async avatarPresets(@Headers('accept-language') acceptLang?: string) {
    const locale = parseLocale(acceptLang);
    return {
      code: 0,
      message: 'ok',
      data: {
        presets: AVATAR_PRESETS.map((p) => ({
          id: p.id,
          emoji: p.emoji,
          color: p.color,
          label: p.label[locale] ?? p.label['en-US'],
          avatarUrl: `preset:${p.id}`,
        })),
      },
    };
  }

  @Post('user/profile')
  async updateProfile(
    @Headers('authorization') auth: string,
    @Body() body: { nickname?: string; avatarUrl?: string | null },
  ) {
    const { userId } = authUser(auth);
    if (body.avatarUrl !== undefined && !isValidPresetAvatarUrl(body.avatarUrl)) {
      throw new BadRequestException({ code: 'INVALID_AVATAR', messageKey: 'errors.invalid_avatar' });
    }
    const user = await updateUserProfile(userId, body);
    if (!user) throw new BadRequestException('Nothing to update');
    return { code: 0, message: 'ok', data: toProfile(user) };
  }

  @Post('user/leaderboard-stealth')
  async leaderboardStealth(
    @Headers('authorization') auth: string,
    @Body() body: { enabled: boolean },
  ) {
    const { userId } = authUser(auth);
    await setLeaderboardStealth(userId, !!body.enabled);
    return { code: 0, message: 'ok', data: { leaderboardStealth: !!body.enabled } };
  }

  @Get('shop/products')
  async shopProducts(@Headers('accept-language') acceptLang?: string) {
    const locale = parseLocale(acceptLang);
    const [products, cfg] = await Promise.all([getIapProducts(), getSystemConfig()]);
    return {
      code: 0,
      message: 'ok',
      data: {
        products: products.map((p) => ({
          id: p.id,
          chips: p.chips,
          priceCents: p.priceCents,
          label: p.label[locale] ?? p.label['en-US'] ?? p.id,
        })),
        firstRechargeBonusEnabled: cfg.firstRechargeBonusEnabled,
        firstRechargeBonusPct: cfg.firstRechargeBonusPct,
        iapSandboxMode: process.env.IAP_SANDBOX_MODE !== 'false',
      },
    };
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
    const result = await processRecharge({
      userId,
      channel: 'MOCK',
      amount: body.amount,
      requestId: body.requestId ?? `mock-${Date.now()}`,
    });
    return { code: 0, message: 'ok', data: result };
  }

  @Post('shop/recharge')
  async shopRecharge(
    @Headers('authorization') auth: string,
    @Body()
    body: {
      channel: RechargeChannel;
      amount?: number;
      requestId: string;
      receiptToken?: string;
      productId?: string;
      fiatAmountCents?: number;
    },
  ) {
    const { userId } = authUser(auth);
    if (body.channel === 'MOCK' && process.env.PAYMENT_MODE !== 'mock') {
      throw new ForbiddenException({ code: 'FORBIDDEN', messageKey: 'errors.mock_payment_disabled' });
    }
    try {
      const result = await processRecharge({
        userId,
        channel: body.channel,
        amount: body.amount ?? 0,
        requestId: body.requestId ?? `rc-${Date.now()}`,
        receiptToken: body.receiptToken,
        productId: body.productId,
        fiatAmountCents: body.fiatAmountCents,
      });
      return { code: 0, message: 'ok', data: result };
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === 'DAILY_LIMIT_EXCEEDED') {
        throw new BadRequestException({ code: 'DAILY_LIMIT', messageKey: 'errors.daily_limit' });
      }
      if (msg === 'INVALID_RECEIPT') {
        throw new BadRequestException({ code: 'INVALID_RECEIPT', messageKey: 'errors.invalid_receipt' });
      }
      if (msg === 'INVALID_AMOUNT' || msg === 'INVALID_PRODUCT') {
        throw new BadRequestException({ code: 'INVALID_PRODUCT', messageKey: 'errors.invalid_product' });
      }
      throw e;
    }
  }

  @Post('match/quick-start')
  async quickStart(@Headers('authorization') auth: string) {
    const { userId } = authUser(auth);
    const user = await assertPlayAllowed(userId);
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
    const board = await getDualLeaderboard(10);
    return { code: 0, message: 'ok', data: { list: board.profit } };
  }

  @Get('leaderboard')
  async leaderboard() {
    const data = await getDualLeaderboard(10);
    return { code: 0, message: 'ok', data };
  }

  @Get('user/compliance')
  async compliance(@Headers('authorization') auth: string) {
    const { userId } = authUser(auth);
    const user = await findUserById(userId);
    if (!user) throw new UnauthorizedException();
    const data = await getComplianceStatus(userId, user.preferred_locale);
    return { code: 0, message: 'ok', data };
  }

  @Post('user/age-declaration')
  async ageDeclaration(@Headers('authorization') auth: string, @Body() body: { confirmed: boolean }) {
    if (!body.confirmed) throw new BadRequestException('Confirmation required');
    const { userId } = authUser(auth);
    await declareAge(userId);
    return { code: 0, message: 'ok', data: { ok: true } };
  }

  @Post('user/self-exclude')
  async selfExclude(@Headers('authorization') auth: string, @Body() body: { days: number }) {
    const { userId } = authUser(auth);
    const until = await setSelfExclusion(userId, body.days ?? 30);
    return { code: 0, message: 'ok', data: { selfExcludedUntil: until.toISOString() } };
  }

  @Post('migration/acknowledge')
  async migrationAck(@Headers('authorization') auth: string) {
    const { userId } = authUser(auth);
    await acknowledgeBetaMigration(userId);
    return { code: 0, message: 'ok', data: { ok: true } };
  }
}

@Controller('api/v1/private')
class PrivateController {
  @Post('grant-permission')
  async grantPermission(
    @Headers('authorization') auth: string,
    @Headers('x-forwarded-for') forwarded: string,
    @Headers('user-agent') ua: string,
    @Body() body: { agreed: boolean },
  ) {
    if (!body.agreed) throw new BadRequestException('Agreement required');
    if (!(await isPrivateRoomAllowed())) {
      throw new ForbiddenException({ code: 'FORBIDDEN', messageKey: 'errors.private_room_disabled' });
    }
    const { userId } = authUser(auth);
    const user = await grantPrivateRoomPermission(userId, forwarded?.split(',')[0] ?? null, ua ?? null);
    return { code: 0, message: 'ok', data: toProfile(user) };
  }

  @Get('permission')
  async permission(@Headers('authorization') auth: string) {
    const { userId } = authUser(auth);
    const user = await findUserById(userId);
    if (!user) throw new UnauthorizedException();
    const officialHands = await countOfficialHandsForUser(userId);
    return {
      code: 0,
      message: 'ok',
      data: {
        hasPermission: user.private_room_permission,
        officialHandsPlayed: officialHands,
        canCreateTwoPlayer: officialHands >= 10,
        fee: 100,
      },
    };
  }

  @Post('create-room')
  async createRoom(
    @Headers('authorization') auth: string,
    @Body()
    body: {
      maxSeats: number;
      smallBlind: number;
      bigBlind: number;
      buyInCap: number;
    },
  ) {
    if (!(await isPrivateRoomAllowed())) {
      throw new ForbiddenException({ code: 'FORBIDDEN', messageKey: 'errors.private_room_disabled' });
    }
    const { userId } = authUser(auth);
    const user = await findUserById(userId);
    if (!user?.private_room_permission) {
      throw new ForbiddenException({ code: 'FORBIDDEN', messageKey: 'errors.private_permission_required' });
    }
    const maxSeats = Math.min(9, Math.max(2, Math.floor(body.maxSeats ?? 6)));
    if (maxSeats === 2) {
      const hands = await countOfficialHandsForUser(userId);
      if (hands < 10) {
        throw new ForbiddenException({ code: 'FORBIDDEN', messageKey: 'errors.two_player_requires_official' });
      }
    }
    const sb = Math.floor(body.smallBlind ?? 1);
    const bb = Math.floor(body.bigBlind ?? 2);
    const buyInCap = Math.min(10000, Math.max(10, Math.floor(body.buyInCap ?? 500)));
    if (bb <= sb) throw new BadRequestException('Invalid blinds');

    const room = await createPrivateRoom({
      hostUserId: userId,
      maxSeats,
      smallBlind: sb,
      bigBlind: bb,
      buyInCap,
    });
    const roomServerUrl = process.env.ROOM_SERVER_URL ?? 'http://localhost:3001';
    return {
      code: 0,
      message: 'ok',
      data: {
        roomCode: room.room_code,
        roomId: room.room_id,
        wsUrl: roomServerUrl,
        maxSeats: room.max_seats,
        blinds: { sb: Number(room.small_blind), bb: Number(room.big_blind) },
        buyInCap: Number(room.buy_in_cap),
        inviteText: `来打德州！房间号 ${room.room_code}，盲注 ${sb}/${bb}，上限 ${buyInCap}`,
        deepLink: `texasholdem://room/${room.room_code}`,
      },
    };
  }

  @Post('join-room')
  async joinRoom(@Headers('authorization') auth: string, @Body() body: { roomCode: string }) {
    if (!(await isPrivateRoomAllowed())) {
      throw new ForbiddenException({ code: 'FORBIDDEN', messageKey: 'errors.private_room_disabled' });
    }
    const { userId } = authUser(auth);
    const user = await findUserById(userId);
    if (!user) throw new UnauthorizedException();
    const room = await findPrivateRoomByCode(body.roomCode);
    if (!room) throw new BadRequestException({ code: 'ROOM_NOT_FOUND', messageKey: 'errors.room_not_found' });
    const roomServerUrl = process.env.ROOM_SERVER_URL ?? 'http://localhost:3001';
    return {
      code: 0,
      message: 'ok',
      data: {
        roomCode: room.room_code,
        roomId: room.room_id,
        wsUrl: roomServerUrl,
        hostUserId: Number(room.host_user_id),
        maxSeats: room.max_seats,
        blinds: { sb: Number(room.small_blind), bb: Number(room.big_blind) },
        buyInCap: Number(room.buy_in_cap),
      },
    };
  }

  @Get('room/:code')
  async roomInfo(@Param('code') code: string) {
    const room = await findPrivateRoomByCode(code);
    if (!room) throw new BadRequestException('Room not found');
    return {
      code: 0,
      message: 'ok',
      data: {
        roomCode: room.room_code,
        roomId: room.room_id,
        maxSeats: room.max_seats,
        blinds: { sb: Number(room.small_blind), bb: Number(room.big_blind) },
        buyInCap: Number(room.buy_in_cap),
        status: room.status,
      },
    };
  }

  @Post('report')
  async report(
    @Headers('authorization') auth: string,
    @Body()
    body: {
      reportedUserId?: number;
      roomId?: string;
      handId?: string;
      category: string;
      description?: string;
    },
  ) {
    const { userId } = authUser(auth);
    const ticket = await createReport({
      reporterUserId: userId,
      reportedUserId: body.reportedUserId,
      roomId: body.roomId,
      handId: body.handId,
      category: body.category,
      description: body.description,
    });
    return {
      code: 0,
      message: 'ok',
      data: {
        id: ticket.id,
        status: ticket.status,
      },
    };
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

  @Get('users/:id')
  async userDetail(@Headers('authorization') auth: string, @Param('id', ParseIntPipe) id: number) {
    requireAdmin(auth);
    const user = await findUserById(id);
    if (!user) throw new BadRequestException('User not found');
    const [transactions, hands] = await Promise.all([
      listUserChipTransactions(id, 50),
      listHandHistories({ userId: id, limit: 10 }),
    ]);
    return {
      code: 0,
      message: 'ok',
      data: {
        user: {
          ...toProfile(user),
          adminRemark: user.admin_remark ?? '',
          deviceId: user.device_id,
          email: user.email,
          avatarUrl: user.avatar_url,
          privateRoomPermission: user.private_room_permission,
          createdAt: user.created_at,
        },
        transactions: transactions.map((t) => ({
          id: t.id,
          amount: Number(t.amount),
          balanceAfter: Number(t.balance_after),
          type: t.type,
          referenceId: t.reference_id,
          createdAt: t.created_at,
        })),
        recentHands: hands.map((row) => toHandRow(row)!),
      },
    };
  }

  @Post('users/:id/remark')
  async userRemark(
    @Headers('authorization') auth: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { remark: string },
  ) {
    requireAdmin(auth);
    await setAdminRemark(id, body.remark ?? '');
    return { code: 0, message: 'ok', data: { ok: true } };
  }

  @Post('users/:id/profile')
  async adminUpdateProfile(
    @Headers('authorization') auth: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { nickname?: string; avatarUrl?: string | null },
  ) {
    requireAdmin(auth);
    if (body.avatarUrl !== undefined && !isValidPresetAvatarUrl(body.avatarUrl)) {
      throw new BadRequestException('Invalid avatar');
    }
    const user = await updateUserProfile(id, body);
    if (!user) throw new BadRequestException('Nothing to update');
    return { code: 0, message: 'ok', data: toProfile(user) };
  }

  @Post('users/:id/private-permission')
  async adminPrivatePermission(
    @Headers('authorization') auth: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { granted: boolean },
  ) {
    requireAdmin(auth);
    const user = await adminGrantPrivatePermission(id, !!body.granted);
    if (!user) throw new BadRequestException('User not found');
    return { code: 0, message: 'ok', data: toProfile(user) };
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

  @Get('config')
  async config(@Headers('authorization') auth: string) {
    requireAdmin(auth);
    return { code: 0, message: 'ok', data: await getSystemConfig() };
  }

  @Post('config')
  async updateConfig(
    @Headers('authorization') auth: string,
    @Body() body: Partial<Awaited<ReturnType<typeof getSystemConfig>>>,
  ) {
    requireAdmin(auth);
    const data = await updateSystemConfig(body);
    return { code: 0, message: 'ok', data };
  }

  @Get('reports')
  async reports(@Headers('authorization') auth: string) {
    requireAdmin(auth);
    const rows = await listReports(100);
    return {
      code: 0,
      message: 'ok',
      data: {
        list: rows.map((r) => ({
          id: r.id,
          reporterUserId: Number(r.reporter_user_id),
          reportedUserId: r.reported_user_id ? Number(r.reported_user_id) : null,
          roomId: r.room_id,
          handId: r.hand_id,
          category: r.category,
          description: r.description,
          status: r.status,
          createdAt: r.created_at,
        })),
      },
    };
  }

  @Post('reports/:id')
  async updateReport(
    @Headers('authorization') auth: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status: string },
  ) {
    requireAdmin(auth);
    const row = await updateReportStatus(id, body.status);
    if (!row) throw new BadRequestException('Report not found');
    return {
      code: 0,
      message: 'ok',
      data: {
        id: row.id,
        status: row.status,
      },
    };
  }

  @Get('economy')
  async economy(@Headers('authorization') auth: string) {
    requireAdmin(auth);
    return { code: 0, message: 'ok', data: await getEconomyStats() };
  }

  @Get('risk-alerts')
  async riskAlerts(@Headers('authorization') auth: string) {
    requireAdmin(auth);
    const rows = await listRiskAlerts(100);
    return {
      code: 0,
      message: 'ok',
      data: {
        list: rows.map((r) => ({
          id: r.id,
          alertType: r.alert_type,
          userId: r.user_id ? Number(r.user_id) : null,
          roomId: r.room_id,
          detail: r.detail_json,
          createdAt: r.created_at,
        })),
      },
    };
  }
}

@Controller()
class HealthController {
  @Get('health')
  health() {
    return {
      status: 'ok',
      service: 'api',
      version: '0.5.0',
      features: { emailAuth: true, guestAuth: true, oauth: true },
    };
  }
}

@Module({ controllers: [HealthController, ApiController, PrivateController, AdminController] })
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
