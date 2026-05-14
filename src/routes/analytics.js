import express from "express";
import { AnalyticsEvent } from "../model/analyticsEvent.model.js";
import { User } from "../model/user.model.js";
import { adminAuth } from "../middleware/adminAuth.js";

const router = express.Router();

const allowedEvents = new Set([
  "page_view",
  "cta_click",
  "signup_started",
  "signup_completed",
  "login_completed",
]);

const IST_TIMEZONE = "Asia/Kolkata";
const IST_OFFSET_MINUTES = 330;

const getIstStartDate = (days) => {
  const now = new Date();
  const shifted = new Date(now.getTime() + IST_OFFSET_MINUTES * 60 * 1000);
  shifted.setUTCHours(0, 0, 0, 0);
  shifted.setUTCDate(shifted.getUTCDate() - (days - 1));
  return new Date(shifted.getTime() - IST_OFFSET_MINUTES * 60 * 1000);
};

router.post("/events", async (req, res) => {
  try {
    const {
      eventName,
      anonymousId,
      userId = null,
      sessionId = null,
      path = "",
      referrer = "",
      source = "web",
      utm = {},
      metadata = {},
      occurredAt,
    } = req.body ?? {};

    if (!eventName || !anonymousId) {
      return res.status(400).json({
        message: "eventName and anonymousId are required",
      });
    }

    if (!allowedEvents.has(eventName)) {
      return res.status(400).json({
        message: "Unsupported eventName",
      });
    }

    const clientIp =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      "";

    await AnalyticsEvent.create({
      eventName,
      anonymousId,
      userId,
      sessionId,
      path,
      referrer,
      source,
      utm: {
        source: utm.source || "",
        medium: utm.medium || "",
        campaign: utm.campaign || "",
        term: utm.term || "",
        content: utm.content || "",
      },
      metadata,
      occurredAt: occurredAt ? new Date(occurredAt) : new Date(),
      ipAddress: clientIp,
      userAgent: req.headers["user-agent"] || "",
    });

    return res.status(201).json({ message: "Event tracked" });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to track analytics event",
      error: error.message,
    });
  }
});

router.get("/summary", adminAuth, async (req, res) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 180);
    const now = new Date();
    const startDate = getIstStartDate(days);

    const rangeMatch = { occurredAt: { $gte: startDate, $lte: now } };

    const [
      totalUsers,
      uniqueVisitors,
      totalPageViews,
      signupStarted,
      signupCompleted,
      visitorsWithoutSignupAgg,
      topPages,
      dailyTrafficAgg,
    ] = await Promise.all([
      User.countDocuments({}),
      AnalyticsEvent.distinct("anonymousId", {
        ...rangeMatch,
        eventName: "page_view",
      }).then((ids) => ids.length),
      AnalyticsEvent.countDocuments({
        ...rangeMatch,
        eventName: "page_view",
      }),
      AnalyticsEvent.countDocuments({
        ...rangeMatch,
        eventName: "signup_started",
      }),
      AnalyticsEvent.countDocuments({
        ...rangeMatch,
        eventName: "signup_completed",
      }),
      AnalyticsEvent.aggregate([
        { $match: rangeMatch },
        {
          $group: {
            _id: "$anonymousId",
            hasVisit: {
              $max: {
                $cond: [{ $eq: ["$eventName", "page_view"] }, 1, 0],
              },
            },
            hasSignup: {
              $max: {
                $cond: [{ $eq: ["$eventName", "signup_completed"] }, 1, 0],
              },
            },
          },
        },
        {
          $match: {
            hasVisit: 1,
            hasSignup: 0,
          },
        },
        { $count: "count" },
      ]),
      AnalyticsEvent.aggregate([
        {
          $match: {
            ...rangeMatch,
            eventName: "page_view",
            path: { $ne: "" },
          },
        },
        {
          $group: {
            _id: "$path",
            views: { $sum: 1 },
            uniqueVisitors: { $addToSet: "$anonymousId" },
          },
        },
        {
          $project: {
            _id: 0,
            path: "$_id",
            views: 1,
            uniqueVisitors: { $size: "$uniqueVisitors" },
          },
        },
        { $sort: { views: -1 } },
        { $limit: 7 },
      ]),
      AnalyticsEvent.aggregate([
        {
          $match: {
            ...rangeMatch,
            eventName: "page_view",
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$occurredAt",
                timezone: IST_TIMEZONE,
              },
            },
            pageViews: { $sum: 1 },
            uniqueVisitors: { $addToSet: "$anonymousId" },
          },
        },
        {
          $project: {
            _id: 0,
            date: "$_id",
            pageViews: 1,
            uniqueVisitors: { $size: "$uniqueVisitors" },
          },
        },
        { $sort: { date: 1 } },
      ]),
    ]);

    const visitorsWithoutSignup = visitorsWithoutSignupAgg[0]?.count || 0;
    const conversionRate =
      uniqueVisitors > 0 ? Number(((signupCompleted / uniqueVisitors) * 100).toFixed(2)) : 0;

    return res.status(200).json({
      timezone: IST_TIMEZONE,
      periodDays: days,
      range: {
        startDate,
        endDate: now,
      },
      kpis: {
        totalUsers,
        uniqueVisitors,
        totalPageViews,
        signupStarted,
        signupCompleted,
        visitorsWithoutSignup,
        conversionRate,
      },
      topPages,
      dailyTraffic: dailyTrafficAgg,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to load analytics summary",
      error: error.message,
    });
  }
});

router.get("/users", adminAuth, async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    const users = await User.find({}, { email: 1, createdAt: 1 })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return res.status(200).json({
      count: users.length,
      users,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to load users snapshot",
      error: error.message,
    });
  }
});

export default router;
