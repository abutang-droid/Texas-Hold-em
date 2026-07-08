import { createHmac, randomBytes } from 'node:crypto';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-in-production';
const ACCESS_TTL_SEC = 2 * 60 * 60;

export interface JwtPayload {
  sub: number;
  nickname: string;
}

function base64url(data: string): string {
  return Buffer.from(data).toString('base64url');
}

export function signAccessToken(payload: JwtPayload): string {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const body = base64url(JSON.stringify({ ...payload, iat: now, exp: now + ACCESS_TTL_SEC }));
  const sig = createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

export function verifyAccessToken(token: string): JwtPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expected = createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  if (sig !== expected) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as JwtPayload & { exp: number };
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return { sub: payload.sub, nickname: payload.nickname };
  } catch {
    return null;
  }
}

export function newDeviceId(): string {
  return randomBytes(16).toString('hex');
}
