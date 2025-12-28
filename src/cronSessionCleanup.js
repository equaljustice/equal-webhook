import cron from "node-cron";
import { Session } from "../src/model/sesssion.model.js";
import mongoose from "mongoose";

// Schedule to run at 2:00 AM IST (20:30 UTC)
const cleanupJob = cron.schedule("30 20 * * *", async () => {
  try {
    // Check if database is connected
    if (mongoose.connection.readyState !== 1) {
      console.error("Database not connected, skipping session cleanup");
      return;
    }

    const now = new Date();
    // Find sessions where endedOn has passed (sessions are created with endedOn set)
    const expiredSessions = await Session.find({
      endedOn: { $lte: now },
    });

    if (expiredSessions.length === 0) {
      console.log(`No expired sessions found at ${now.toISOString()}`);
      return;
    }

    // Delete expired sessions
    const result = await Session.deleteMany({
      endedOn: { $lte: now },
    });

    console.log(
      `✅ Cleaned up ${
        result.deletedCount
      } expired session(s) at ${now.toISOString()}`
    );
  } catch (err) {
    console.error("❌ Error in session cleanup:", err);
  }
});

// Log when cron job is scheduled
console.log(
  "✅ Session cleanup cron job scheduled: Daily at 2:00 AM IST (20:30 UTC)"
);

// Export cleanup function for manual testing
export const runCleanup = async () => {
  try {
    if (mongoose.connection.readyState !== 1) {
      console.error("Database not connected, cannot run cleanup");
      return;
    }

    const now = new Date();
    const expiredSessions = await Session.find({
      endedOn: { $lte: now },
    });

    if (expiredSessions.length === 0) {
      console.log(`No expired sessions found at ${now.toISOString()}`);
      return;
    }

    const result = await Session.deleteMany({
      endedOn: { $lte: now },
    });

    console.log(
      `✅ Cleaned up ${
        result.deletedCount
      } expired session(s) at ${now.toISOString()}`
    );
  } catch (err) {
    console.error("❌ Error in session cleanup:", err);
  }
};
