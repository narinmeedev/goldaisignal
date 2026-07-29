import { jwtVerify, SignJWT, type JWTPayload } from 'jose';
import bcrypt from 'bcryptjs';

export const getJwtSecretKey = () => {
  const secret = (process.env.JWT_SECRET && process.env.JWT_SECRET.trim().length >= 32)
    ? process.env.JWT_SECRET.trim()
    : 'super-secret-jwt-key-with-more-than-32-chars-for-goldai-signal-lab-2026';
  return new TextEncoder().encode(secret);
};

export interface AuthPayload {
  userId: string;
  email: string;
  role: string;
}

export const signToken = async (payload: AuthPayload) => {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(getJwtSecretKey());
};

export const verifyToken = async (token: string) => {
  try {
    const { payload } = await jwtVerify(token, getJwtSecretKey());
    return payload as unknown as AuthPayload;
  } catch {
    return null;
  }
};

export const hashPassword = async (password: string) => {
  return await bcrypt.hash(password, 10);
};

export const verifyPassword = async (password: string, hash: string) => {
  return await bcrypt.compare(password, hash);
};

export const signVerificationToken = async (payload: JWTPayload) => {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(getJwtSecretKey());
};

export const verifyVerificationToken = async (token: string) => {
  try {
    const { payload } = await jwtVerify(token, getJwtSecretKey());
    return payload;
  } catch {
    return null;
  }
};
