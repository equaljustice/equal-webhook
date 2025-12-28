// Copyright 2021 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import express from "express";
import { pinoHttp, logger } from "./utils/logging.js";
import APIrouter from "./routes.js";
import { connectDB } from "./src/db/config.js";
import cors from "cors";
const app = express();

// Root route handler - place early to avoid body parsing issues
app.get("/", (req, res) => {
  res.send(`
    <html>
      <head>
        <title>EqualJustice Server Status</title>
        <style>
          body { font-family: Arial, sans-serif; background: #f0f8ff; margin: 0; padding: 0; }
          .container {
            max-width: 600px;
            margin: 100px auto;
            background: #fff;
            border-radius: 10px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.07);
            padding: 40px;
            text-align: center;
          }
          h1 { color: #22743a; margin-bottom: 20px; }
          p { color: #333; font-size: 1.1em; }
          .live {
            color: #fff;
            background: #39c36e;
            padding: 10px 25px;
            border-radius: 25px;
            display: inline-block;
            font-weight: bold;
            letter-spacing: 1px;
            margin-top: 18px;
            font-size: 1.15em;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>EqualJustice Server is Live</h1>
          <div class="live">Status: LIVE ✅</div>
          <p>Welcome to the EqualJustice API server.<br>
          If you see this message, the service is running properly.</p>
        </div>
      </body>
    </html>
  `);
});

// Health check endpoint - returns JSON for monitoring tools
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    service: "EqualJustice API",
    timestamp: new Date().toISOString(),
  });
});

// JSON body parser - only for requests with JSON content type
// Configure to handle empty bodies gracefully
app.use(express.json({ 
  type: ["application/json"],
  limit: '10mb'
}));

// Error handling middleware for JSON parsing errors (must be after body parser)
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    // JSON parsing error - likely empty or invalid JSON body
    // For GET/HEAD/DELETE requests, this is fine - just continue without body
    if (['GET', 'HEAD', 'DELETE', 'OPTIONS'].includes(req.method)) {
      req.body = {};
      return next();
    }
    return res.status(400).json({ 
      error: 'Invalid JSON in request body',
      message: err.message 
    });
  }
  next(err);
});

connectDB();

// Use request-based logger for log correlation
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: "*",
    credentials: true,
  })
);

app.use((req, res, next) => {
  // Only log body if it exists and is not empty
  if (req.body && Object.keys(req.body).length > 0) {
    logger.info(req.body);
  }
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, PUT, HEAD");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
});

app.use(pinoHttp);

app.use("/api", APIrouter);

// Final error handler for any unhandled errors
app.use((err, req, res, next) => {
  logger.error({ err, req: { method: req.method, url: req.url } }, 'Unhandled error');
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

import "./src/cronSessionCleanup.js";

export default app;
