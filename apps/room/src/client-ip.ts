import type { Socket } from 'socket.io';

/** Resolve client IP from Socket.io handshake (supports X-Forwarded-For behind proxy). */
export function getClientIp(socket: Socket): string {
  const forwarded = socket.handshake.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]!.trim();
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return forwarded[0].split(',')[0]!.trim();
  }
  const addr = socket.handshake.address ?? '';
  if (addr.startsWith('::ffff:')) return addr.slice(7);
  return addr || 'unknown';
}
