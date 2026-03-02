import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Admin } from "../model/admin.model.js";
import { adminAuth } from "../middleware/adminAuth.js";

const router = express.Router();

/**
 * POST /api/admin/signup
 * Create admin account (temporary for development)
 * Body: { email: string, password: string }
 */
router.post("/signup", async (req, res) => {
  try {
    console.log("=== ADMIN SIGNUP ATTEMPT ===");
    console.log("Request body:", req.body);

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Email and password are required",
      });
    }

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email: email.toLowerCase() });
    if (existingAdmin) {
      return res.status(409).json({
        error: "Conflict",
        message: "Admin account already exists",
      });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create admin
    const admin = await Admin.create({
      email: email.toLowerCase(),
      passwordHash,
      loginAttempts: 0,
      lockUntil: null,
      lastLogin: null,
    });

    // Generate JWT token
    const token = jwt.sign(
      {
        id: admin._id,
        email: admin.email,
        role: "admin",
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    return res.status(201).json({
      message: "Admin account created successfully",
      admin: {
        id: admin._id,
        email: admin.email,
        createdAt: admin.createdAt,
      },
      token,
    });
  } catch (error) {
    console.error("Admin signup error:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to create admin account",
      details: error.message,
    });
  }
});

/**
 * POST /api/admin/login
 * Admin login with account lockout protection
 * Body: { email: string, password: string }
 */
router.post("/login", async (req, res) => {
  try {
    console.log("=== ADMIN LOGIN ATTEMPT ===");
    console.log("Request body:", req.body);
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Email and password are required",
      });
    }

    // Find admin by email
    const admin = await Admin.findOne({ email: email.toLowerCase() });
    if (!admin) {
      console.log("Admin not found for email:", email.toLowerCase());
      return res.status(401).json({
        error: "Unauthorized",
        message: "Invalid email or password",
      });
    }

    console.log("Found admin:", admin.email, "ID:", admin._id);

    // Check if account is locked
    if (admin.isLocked) {
      const lockTimeRemaining = Math.ceil(
        (admin.lockUntil - Date.now()) / 1000 / 60
      );
      return res.status(423).json({
        error: "Locked",
        message: `Account is locked. Try again in ${lockTimeRemaining} minutes`,
        lockTimeRemaining,
      });
    }

    // Verify password
    console.log("Comparing password with hash...");
    const isPasswordValid = await bcrypt.compare(password, admin.passwordHash);
    console.log("Password valid:", isPasswordValid);
    if (!isPasswordValid) {
      await admin.incLoginAttempts();

      const attemptsRemaining = 5 - (admin.loginAttempts + 1);
      return res.status(401).json({
        error: "Unauthorized",
        message: "Invalid email or password",
        attemptsRemaining: attemptsRemaining > 0 ? attemptsRemaining : 0,
        willLock: attemptsRemaining <= 1,
      });
    }

    // Reset login attempts on successful login
    await admin.resetLoginAttempts();

    // Generate JWT token (1 hour expiry)
    const token = jwt.sign(
      {
        id: admin._id,
        email: admin.email,
        role: "admin",
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    return res.status(200).json({
      message: "Login successful",
      token,
      admin: {
        id: admin._id,
        email: admin.email,
        lastLogin: admin.lastLogin,
        createdAt: admin.createdAt,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      message: "Login failed",
    });
  }
});

/**
 * POST /api/admin/change-password
 * Change admin password (protected)
 * Body: { currentPassword: string, newPassword: string }
 */
router.post("/change-password", adminAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Current password and new password are required",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        error: "Bad Request",
        message: "New password must be at least 8 characters long",
      });
    }

    // Get admin from database
    const admin = await Admin.findById(req.admin.id);
    if (!admin) {
      return res.status(404).json({
        error: "Not Found",
        message: "Admin account not found",
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      admin.passwordHash
    );
    if (!isCurrentPasswordValid) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Current password is incorrect",
      });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    // Update password
    await Admin.findByIdAndUpdate(admin._id, {
      passwordHash: newPasswordHash,
    });

    return res.status(200).json({
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to change password",
    });
  }
});

/**
 * GET /api/admin/me
 * Get current admin profile (protected)
 */
router.get("/me", adminAuth, async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin.id).select("-passwordHash");
    if (!admin) {
      return res.status(404).json({
        error: "Not Found",
        message: "Admin account not found",
      });
    }

    return res.status(200).json({
      message: "Admin profile retrieved successfully",
      admin,
    });
  } catch (error) {
    console.error("Get admin profile error:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to retrieve admin profile",
    });
  }
});

export default router;
