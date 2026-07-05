import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_TTL = "30d";

function assertConfigured() {
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not set. Add it to .env before using auth.");
  }
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function signToken(user) {
  assertConfigured();
  return jwt.sign({ sub: user.user_id, name: user.name, email: user.email }, JWT_SECRET, {
    expiresIn: TOKEN_TTL,
  });
}

/**
 * Requires a valid "Authorization: Bearer <token>" header. Attaches
 * req.user = { id, name, email } on success. This is deliberately simple --
 * no refresh tokens, no email verification, per the "simple auth" ask.
 */
export function requireAuth(req, res, next) {
  try {
    assertConfigured();
    const header = req.headers.authorization;
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Not authenticated" });

    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.sub, name: payload.name, email: payload.email };
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired session" });
  }
}
