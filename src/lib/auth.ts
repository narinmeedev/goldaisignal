import { jwtVerify, SignJWT } from 'jose';
import bcrypt from 'bcryptjs';

const getJwtSecretKey = () => {
  const secret = process.env.JWT_SECRET || 'gold-signal-fallback-secret-key-32-chars';
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
  } catch (error) {
    return null;
  }
};

export const hashPassword = async (password: string) => {
  return await bcrypt.hash(password, 10);
};

export const verifyPassword = async (password: string, hash: string) => {
  return await bcrypt.compare(password, hash);
};

export const signVerificationToken = async (payload: any) => {
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
  } catch (error) {
    return null;
  }
};
