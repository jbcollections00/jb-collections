import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';

const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret-change-me');

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN';
  plan: 'FREE' | 'PREMIUM';
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function signSession(user: SessionUser) {
  return new SignJWT(user)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
}

export async function verifySession(token: string) {
  const { payload } = await jwtVerify(token, secret);
  return payload as unknown as SessionUser;
}
