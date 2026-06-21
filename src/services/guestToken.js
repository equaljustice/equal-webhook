import jwt from "jsonwebtoken";

export function getGuestJwtSecret() {
  return process.env.GUEST_JWT_SECRET || process.env.JWT_SECRET;
}

export function signGuestToken(payload) {
  const secret = getGuestJwtSecret();
  if (!secret) {
    throw new Error("GUEST_JWT_SECRET or JWT_SECRET must be set for guest sessions");
  }
  return jwt.sign(payload, secret, { expiresIn: "7d" });
}

export function verifyGuestToken(token) {
  const secret = getGuestJwtSecret();
  if (!secret) {
    throw new Error("GUEST_JWT_SECRET or JWT_SECRET must be set for guest sessions");
  }
  return jwt.verify(token, secret);
}
