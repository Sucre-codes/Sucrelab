import { Router } from "express";
import { randomUUID } from "crypto";
import User from "../models/User.js";
import { hashPassword, verifyPassword, signToken, requireAuth } from "../lib/auth.js";

const router = Router();

router.post("/signup", async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: "name, email, and password are required" });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  const existing = await User.findOne({ email: email.toLowerCase().trim() });
  if (existing) {
    return res.status(409).json({ error: "An account with that email already exists" });
  }

  const user = await User.create({
    user_id: randomUUID(),
    name,
    email: email.toLowerCase().trim(),
    password_hash: await hashPassword(password),
  });

  const token = signToken(user);
  res.json({ token, user: { name: user.name, email: user.email } });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const token = signToken(user);
  res.json({ token, user: { name: user.name, email: user.email } });
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;
