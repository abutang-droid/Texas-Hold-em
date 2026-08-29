import { createPublicKey, verify, X509Certificate } from 'node:crypto';

/** Apple Root CA - G3 (https://www.apple.com/certificateauthority/) */
const APPLE_ROOT_CA_G3 = `-----BEGIN CERTIFICATE-----
MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwS
QXBwbGUgUm9vdCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9u
IEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcN
MTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2WjBnMRswGQYDVQQDDBJBcHBsZSBS
b290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9y
aXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqGSM49
AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtf
TjjTuxxEtX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517
IDvYuVTZXpmkOlEKMaNCMEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySr
MA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49BAMDA2gA
MGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3meoyhpmvOwgPUnPWTxnS4
at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkLF1vLUagM
6BgD56KyKA==
-----END CERTIFICATE-----`;

interface StoreKitJwsPayload {
  productId?: string;
  transactionId?: string;
  bundleId?: string;
  environment?: string;
}

function pemFromDerBase64(derBase64: string): string {
  const lines = derBase64.match(/.{1,64}/g) ?? [derBase64];
  return `-----BEGIN CERTIFICATE-----\n${lines.join('\n')}\n-----END CERTIFICATE-----`;
}

function verifyCertificateChain(x5c: string[]): boolean {
  const chain = x5c.map((der) => new X509Certificate(pemFromDerBase64(der)));
  for (let i = 0; i < chain.length - 1; i++) {
    if (!chain[i]!.checkIssued(chain[i + 1]!)) return false;
  }
  const root = new X509Certificate(APPLE_ROOT_CA_G3);
  const last = chain[chain.length - 1]!;
  return last.checkIssued(root) || last.fingerprint256 === root.fingerprint256;
}

/** Verify StoreKit 2 signed transaction JWS (x5c chain + ES256 signature). */
export function verifyStoreKitJws(jws: string): StoreKitJwsPayload | null {
  const segments = jws.split('.');
  if (segments.length !== 3) return null;
  const [headerB64, payloadB64, signatureB64] = segments;
  if (!headerB64 || !payloadB64 || !signatureB64) return null;

  let header: { alg?: string; x5c?: string[] };
  try {
    header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8')) as {
      alg?: string;
      x5c?: string[];
    };
  } catch {
    return null;
  }

  if (header.alg !== 'ES256' || !header.x5c?.length) return null;
  if (!verifyCertificateChain(header.x5c)) return null;

  const leafPem = pemFromDerBase64(header.x5c[0]!);
  const publicKey = createPublicKey(leafPem);
  const signature = Buffer.from(signatureB64, 'base64url');
  const signed = Buffer.from(`${headerB64}.${payloadB64}`);
  const ok = verify('sha256', signed, { key: publicKey, dsaEncoding: 'ieee-p1363' }, signature);
  if (!ok) return null;

  try {
    return JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as StoreKitJwsPayload;
  } catch {
    return null;
  }
}
