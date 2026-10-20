import bcrypt from 'bcryptjs';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import type { RequestHandler } from 'express';

const JWT_ISSUER = 'hoc-tap-quest-api';
const JWT_AUDIENCE = 'hoc-tap-quest-client';
const TOKEN_LIFETIME = '1h';

export function getJwtSecret(): string | null {
  const secret = process.env.JWT_SECRET?.trim();
  return secret && Buffer.byteLength(secret, 'utf8') >= 32 ? secret : null;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export function createAccessToken(userId: string, secret: string): string {
  return jwt.sign({}, secret, {
    subject: userId,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    expiresIn: TOKEN_LIFETIME,
  });
}

export const requireAuthentication: RequestHandler = (request, response, next) => {
  const secret = getJwtSecret();
  if (!secret) {
    response.status(503).json({
      error: { code: 'AUTH_NOT_CONFIGURED', message: 'Authentication is not configured on this server.' },
    });
    return;
  }

  const authorization = request.get('authorization');
  const match = authorization?.match(/^Bearer\s+([^\s]+)$/i);
  const token = match?.[1];
  if (!token) {
    response.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'A valid bearer token is required.' },
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, secret, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }) as JwtPayload;
    if (typeof decoded.sub !== 'string' || !decoded.sub) {
      response.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'The access token is invalid or expired.' },
      });
      return;
    }
    response.locals.userId = decoded.sub;
    next();
  } catch {
    response.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'The access token is invalid or expired.' },
    });
  }
};
