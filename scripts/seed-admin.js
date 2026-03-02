import dotenv from "dotenv";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { Admin } from "../src/model/admin.model.js";

// Load environment variables
dotenv.config();

// MongoDB connection
const connectDB = async () => {
  try {
    const mongoUri =
      process.env.MONGO_URI ||
      process.env.MONGODB_URI ||
      process.env.MONGO_DB_URL;
    if (!mongoUri) {
      throw new Error("MongoDB URI not found in environment variables");
    }

    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
};

const seedAdmin = async () => {
  try {
    await connectDB();

    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
      console.error(
        "❌ ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required"
      );
      process.exit(1);
    }

    console.log(`🔐 Creating/updating admin account for: ${adminEmail}`);

    // Hash password with high salt rounds for security
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(adminPassword, saltRounds);

    // Upsert admin account (create if doesn't exist, update if exists)
    const admin = await Admin.findOneAndUpdate(
      { email: adminEmail },
      {
        email: adminEmail,
        passwordHash,
        loginAttempts: 0,
        lockUntil: null,
        lastLogin: null,
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
      }
    );

    console.log("✅ Admin account created/updated successfully");
    console.log(`📧 Email: ${admin.email}`);
    console.log(`📅 Created/Updated: ${admin.createdAt}`);

    if (admin.lastLogin) {
      console.log(`🕐 Last Login: ${admin.lastLogin}`);
    }

    console.log("\n⚠️  IMPORTANT:");
    console.log("- Store these credentials securely");
    console.log("- Use the admin panel at /admin to login");
    console.log("- Change password immediately after first login");
  } catch (error) {
    console.error("❌ Error seeding admin account:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
};

// Run the seed script
seedAdmin();
