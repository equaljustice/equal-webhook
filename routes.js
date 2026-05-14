//const APIrouter = require('express').Router();
import express from "express";
import authRoutes from "./src/routes/auth.js";
import assistantRoutes from "./src/routes/assistantAPI.js";
import paymentRoutes from "./src/routes/payment.js";
import CustomGPTPaymentRoutes from "./src/routes/customGPTPayment.js";
import promptAdminRoutes from "./src/routes/promptAdmin.js";
import adminRoutes from "./src/routes/admin.js";
import analyticsRoutes from "./src/routes/analytics.js";
const APIrouter = express.Router();

APIrouter.use("/auth", authRoutes);
APIrouter.use("/assistant", assistantRoutes);
APIrouter.use("/payment", paymentRoutes);
APIrouter.use("/custom-payment", CustomGPTPaymentRoutes);
APIrouter.use("/prompt-admin", promptAdminRoutes);
APIrouter.use("/admin", adminRoutes);
APIrouter.use("/analytics", analyticsRoutes);

// Export the router
export default APIrouter;
