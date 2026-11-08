import rateLimit from "express-rate-limit";

/* Dedicated rate limiters for public endpoints */
export const clientErrorLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 15, // max 15 telemetry submissions per IP per 5 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many telemetry requests, please try again later." }
});

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // max 5 failed attempts per 15 min per IP
  skipSuccessfulRequests: true, // successful logins do not count towards the 5 attempts
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many failed login attempts. Please try again after 15 minutes." }
});

export const authVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // max 15 failed attempts per 15 min per IP
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many failed verification attempts. Please try again after 15 minutes." }
});

export const inviteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // max 20 invite link creations per hour per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Invite rate limit exceeded. Please try again later." }
});


/* Per-router ceiling for authenticated admin routes (the global /api limiter still applies on top). */
export const adminApiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." }
});
