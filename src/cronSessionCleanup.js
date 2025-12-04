import cron from "node-cron";
import { Session } from "../src/model/sesssion.model.js";

// Schedule to run at 2:00 AM IST (20:30 UTC)
cron.schedule("30 20 * * *", async () => {
  try {
    const now = new Date();
    // Find sessions older than 7 days and not ended
    const expiredSessions = await Session.find({
      endedOn: { $exists: false },
      startedOn: { $lte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
    });

    for (const session of expiredSessions) {
      // Mark endedOn
      session.endedOn = new Date(
        session.startedOn.getTime() + 7 * 24 * 60 * 60 * 1000
      );
      await session.save();
      // Remove from DB
      await Session.deleteOne({ _id: session._id });
    }
    console.log(`Expired sessions cleaned up at ${now.toISOString()}`);
  } catch (err) {
    console.error("Error in session cleanup:", err);
  }
});
