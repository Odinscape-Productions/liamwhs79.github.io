const jwt = require("jsonwebtoken");

const secret = () => process.env.JWT_SECRET || "development-only-secret-change-me";

function signToken(user) {
  return jwt.sign(
    { sub: user.id, handle: user.handle, role: user.role || "member" },
    secret(),
    { expiresIn: "7d" }
  );
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) return res.status(401).json({ error: "Authentication required" });

  try {
    req.auth = jwt.verify(token, secret());
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired session" });
  }
}

function authOptional(req, _res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return next();
  try {
    req.auth = jwt.verify(token, secret());
  } catch {}
  next();
}

module.exports = { signToken, authRequired, authOptional };
