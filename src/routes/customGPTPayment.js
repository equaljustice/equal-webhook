import express from "express";
import { CustomGPTpayment } from "../model/ customGPTPayment.model.js";
import axios from "axios";

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

router.post("/create-order", async (req, res) => {
  const { toPay, email } = req.body;
  const amt = toPay * 100;

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
    const pay_record = await CustomGPTpayment.create(dbPayload);
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

    const paymentRecord = await CustomGPTpayment.findOneAndUpdate(
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

    // const sessionId = paymentRecord.sessionId;
    // if (paymentRecord.status?.value === "paid") {
    //   await Session.findByIdAndUpdate(sessionId, { $set: { isPaid: true } });
    // }

    res.status(200).send("OK");
  } catch (err) {
    console.error("Webhook Error:", err);
    res.status(200).send("OK");
  }
});

router.get("/status/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!orderId) {
      return res.status(400).json({ message: "orderId is required" });
    }

    const payment = await CustomGPTpayment.findOne({ orderId });
    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    res.json({
      success: true,
      status: payment.status?.value || "unpaid",
      paidAt: payment.status?.paidAt || null,
      payment,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error checking payment status",
      error: error.message,
    });
  }
});

export default router;
