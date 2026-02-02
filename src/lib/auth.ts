import type { NextApiRequest } from 'next';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-me';

export interface AuthUser {
  id: string;
  email: string | null;
  isAnonymous: boolean;
}

export function verifyToken(req: NextApiRequest): AuthUser | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  
  // Handle anonymous tokens (format: anon_<deviceId>)
  if (token.startsWith('anon_')) {
    const deviceId = token.substring(5);
    if (deviceId && deviceId.length >= 32) {
      return {
        id: deviceId,
        email: null,
        isAnonymous: true,
      };
    }
    return null;
  }
  
  // Handle JWT tokens for logged-in users
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string };
    return {
      id: decoded.id,
      email: decoded.email,
      isAnonymous: false,
    };
  } catch (err) {
    return null;
  }
}

export function requireAuth(req: NextApiRequest): AuthUser {
  const user = verifyToken(req);
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}
