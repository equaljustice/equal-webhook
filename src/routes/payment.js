import express from "express";
import { Payment } from "../model/payment.model.js";
import axios from "axios";
import { jwtAuth } from "../middleware/jwtAuth.js";
import { Session } from "../model/sesssion.model.js";

const router = express.Router();

const airthpay_url = process.env.APAY_BASEURL;

const axiosInstance = axios.create({
  baseURL: airthpay_url,
  timeout: 10000,
  headers: {
    "x-client-id": process.env.APAY_CLIENT_ID,
    "x-client-secret": process.env.APAY_CLIENT_SECRET,
  },
});

router.post("/create-order/:sessionId", jwtAuth, async (req, res) => {
  const userId = req.user.id;
  const email = req.user.email;
  const { sessionId } = req.params;
  const session = await Session.findOne({ _id: sessionId, userId });
  if (!session) {
    return res.status(404).json({ message: "Session not found" });
  }

  if (session.isPaid) {
    return res.status(400).json({ message: "Session already paid" });
  }

  const amt = session.price * 100; //In paisa
  // const amt = 100;

  if (!amt || !email)
    return res.status(404).json({ message: "Can'nt create order" });

  const payload = {
    orderDetails: {
      currency: "INR",
      amount: amt.toString(),
    },
    customerDetails: {
      chEmail: email,
    },
  };

  try {
    const order = await axiosInstance.post("/orderCreate", payload);
    const orderId = order.data.msg;
    const payUrl = order.data.obj;
    //Now Save payment request in our db
    const dbPayload = {
      userId,
      sessionId: session._id,
      status: {
        value: "unpaid",
        paidAt: null,
      },
      orderDetails: {
        currency: "INR",
        amount: (amt / 100).toString() + " INR",
      },
      customerDetails: {
        chEmail: email,
      },
      orderId: orderId,
      createdOn: new Date(),
    };
    const pay_record = await Payment.create(dbPayload);
    return res.status(201).json({
      message: "Order created successfully",
      paymentRecord: pay_record,
      orderId: orderId,
      payUrl: payUrl,
    });
  } catch (error) {
    console.error("Airthpay Error:", error.response?.data);

    return res.status(500).json({
      airthpay_error: error.response?.data || null,
      status: error.response?.status || null,
      message: error.message,
    });
  }
});

router.post("/airthpay-webhook", async (req, res) => {
  try {
    const data = req.body;

    console.log("Webhook received:", data);

    // Determine new payment status and paidAt for known webhook status codes
    let statusValue = "unpaid";
    let paidAt = null;
    if (data.status === "00") {
      statusValue = "paid";
      paidAt = new Date();
    } else if (data.status === "02") {
      statusValue = "cancelled";
    } else if (data.status === "04") {
      statusValue = "failed";
    }

    const paymentRecord = await Payment.findOneAndUpdate(
      { orderId: data.orderId },
      {
        $set: {
          status: {
            value: statusValue,
            paidAt: paidAt,
          },
          webhookTransaction: data,
        },
      },
      { new: true }
    );

    const sessionId = paymentRecord.sessionId;
    if (paymentRecord.status?.value === "paid") {
      await Session.findByIdAndUpdate(sessionId, { $set: { isPaid: true } });
    }

    res.status(200).send("OK");
  } catch (err) {
    console.error("Webhook Error:", err);
    res.status(200).send("OK");
  }
});

// Get all payment history for logged in user
router.get("/history", jwtAuth, async (req, res) => {
  try {
    // Expect userId to be provided by authentication middleware or query/body (change as needed)
    const userId = req.user?.id || req.query.userId;
    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    const payments = await Payment.find({ userId }).sort({ createdOn: -1 });
    res.json({
      success: true,
      count: payments.length,
      payments,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching payment history",
      error: error.message,
    });
  }
});

// Get payment(s) for a specific sessionId
router.get("/history/session/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) {
      return res.status(400).json({ message: "sessionId is required" });
    }

    const payment = await Payment.find({ sessionId }).sort({ createdOn: -1 });
    res.json({
      success: true,
      count: payment.length,
      payments: payment,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching payment(s) for session",
      error: error.message,
    });
  }
});

export default router;
