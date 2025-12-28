//const APIrouter = require('express').Router();
import express from "express";
import authRoutes from "./src/routes/auth.js";
import assistantRoutes from "./src/routes/assistantAPI.js";
import paymentRoutes from "./src/routes/payment.js";
import CustomGPTPaymentRoutes from "./src/routes/customGPTPayment.js";
const APIrouter = express.Router();


APIrouter.use("/auth", authRoutes);
APIrouter.use("/assistant", assistantRoutes);
APIrouter.use("/payment", paymentRoutes);
APIrouter.use("/custom-payment", CustomGPTPaymentRoutes);

// Export the router
export default APIrouter;
