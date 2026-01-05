import express from "express";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import { jwtAuth } from "../middleware/jwtAuth.js";
import { Assistant } from "../model/assistant.model.js";
import { Session } from "../model/sesssion.model.js";
import path from "path";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import os from "os";

const router = express.Router();

// Configure multer for temporary file storage
const upload = multer({
  dest: os.tmpdir(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept PDF, DOCX, and image files
    const allowedMimes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "image/jpeg",
      "image/png",
      "image/jpg",
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error("Invalid file type. Only PDF, DOCX, and images are allowed."),
        false
      );
    }
  },
});

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

//Create Assistant instance into db
router.post("/create", async (req, res) => {
  const { name, key, id, price, desc, provider, config } = req.body;

  if (!name || !key || !id || !price || !desc || !provider) {
    return res.status(404).json({ message: "Info is required" });
  }

  try {
    const payload = {
      name,
      key,
      assistantId: id,
      price,
      description: desc,
      provider,
      config: config || {},
    };
    const response = await Assistant.create(payload);
    return res.status(201).json(response);
  } catch (error) {
    return res.status(500).json({
      message: "Error creating assistant",
      error: error.message,
    });
  }
});

//Modify a assistant
router.put("/update/:assistantId", async (req, res) => {
  const { assistantId } = req.params;
  const updateFields = {};
  const allowedFields = [
    "name",
    "key",
    "assistantId",
    "price",
    "description",
    "provider",
    "config",
  ];

  // Prepare an update object only with provided allowed fields
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updateFields[field] = req.body[field];
    }
  }

  if (Object.keys(updateFields).length === 0) {
    return res
      .status(400)
      .json({ message: "No valid fields provided to update" });
  }

  try {
    // Check for unique key and assistantId if updating them
    if (updateFields.key) {
      const exists = await Assistant.findOne({
        key: updateFields.key,
        _id: { $ne: assistantId },
      });
      if (exists) {
        return res
          .status(409)
          .json({ message: "Key already in use by another assistant" });
      }
    }
    if (updateFields.assistantId) {
      const exists = await Assistant.findOne({
        assistantId: updateFields.assistantId,
        _id: { $ne: assistantId },
      });
      if (exists) {
        return res
          .status(409)
          .json({ message: "assistantId already in use by another assistant" });
      }
    }

    // Find and update the assistant
    const assistant = await Assistant.findByIdAndUpdate(
      assistantId,
      { $set: updateFields },
      { new: true }
    );
    if (!assistant) {
      return res.status(404).json({ message: "Assistant not found!" });
    }

    return res
      .status(200)
      .json({ message: "Assistant updated successfully", assistant });
  } catch (error) {
    return res.status(500).json({
      message: "Error updating assistant",
      error: error.message,
    });
  }
});

router.get("/listall", async (req, res) => {
  try {
    const assistants = await Assistant.find({});
    return res.status(200).json({ assistants });
  } catch (error) {
    return res.status(500).json({
      message: "Error fetching assistants",
      error: error.message,
    });
  }
});

//Create a new session
router.post("/start-session", jwtAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { key } = req.body;

    //Find AssistantId from key
    const assistant = await Assistant.findOne({ key });

    if (!assistant) {
      return res.status(404).json({ message: "Assistant not found!" });
    }
    const assistantId = assistant.assistantId;
    const sessionKey = assistant.key;

    // return res.status(200).json({
    //   assistantId,
    //   userId,
    // });

    let threadId = undefined;
    let geminiConfig = undefined;
    let provider = assistant.provider || "openai";

    if (provider === "openai") {
      //Create a new thread - OpenAI flow
      const thread = await client.beta.threads.create();
      threadId = thread.id;
    } else if (provider === "gemini") {
      // For Gemini, threadId may not be needed, but store config
      const { v4: uuidv4 } = await import("uuid");
      geminiConfig = assistant.config || {};
      threadId = uuidv4(); // Use a unique threadId (uuid) for Gemini
    }

    //Create session in DB
    const startedOn = new Date();
    const endedOn = new Date(startedOn.getTime() + 7 * 24 * 60 * 60 * 1000);
    const session = await Session.create({
      userId,
      assistantId,
      threadId,
      title: assistant.name,
      assistantKey: sessionKey,
      price: assistant.price,
      startedOn,
      endedOn,
      provider,
      geminiConfig,
    });

    //Send SuccessMessage
    return res.status(201).json({
      message: "Session created successfully",
      sessionId: session._id,
      threadId: threadId,
      provider,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create session" });
  }
});

//Fetch All User sessions
router.get("/get-sessions", jwtAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const sessions = await Session.find({ userId });
    if (!sessions) {
      return res.status(404).json({
        message: "Sessions not found!",
      });
    }
    return res.status(200).json(sessions);
  } catch (error) {
    return res.status(500).json({
      error: error.message,
      message: "Error fetching User Sessions",
    });
  }
});

// Delete Session by ID
router.delete("/delete-session/:sessionId", jwtAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;

    // Find session and ensure it belongs to the requesting user
    const session = await Session.findOne({ _id: sessionId, userId });
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    await Session.deleteOne({ _id: sessionId });

    return res.status(200).json({ message: "Session deleted successfully" });
  } catch (error) {
    return res.status(500).json({
      error: error.message,
      message: "Failed to delete session",
    });
  }
});

// Upload document for Gemini file analysis
router.post(
  "/upload-document",
  jwtAuth,
  upload.single("document"),
  async (req, res) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

      // Read file buffer
      const fs = await import("fs/promises");
      const fileBuffer = await fs.readFile(file.path);

      // Determine mimeType with fallback
      let mimeType = file.mimetype;
      if (!mimeType || mimeType === "application/octet-stream") {
        // Fallback based on file extension
        const ext = path.extname(file.originalname || "").toLowerCase();
        const mimeTypes = {
          ".pdf": "application/pdf",
          ".doc": "application/msword",
          ".docx":
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          ".jpg": "image/jpeg",
          ".jpeg": "image/jpeg",
          ".png": "image/png",
        };
        mimeType = mimeTypes[ext] || "application/pdf";
      }

      // Upload file to Gemini Files API
      let fileId;
      try {
        // Use Gemini's file upload API
        // The API requires mimeType in the config object
        let uploadResponse;
        try {
          // Format 1: Using file path with config containing mimeType
          uploadResponse = await ai.files.upload({
            file: file.path,
            config: {
              mimeType: mimeType,
              displayName: file.originalname || `document_${uuidv4()}`,
            },
          });
        } catch (pathErr) {
          // Format 2: Using file buffer if path doesn't work
          uploadResponse = await ai.files.upload({
            file: fileBuffer,
            config: {
              mimeType: mimeType,
              displayName: file.originalname || `document_${uuidv4()}`,
            },
          });
        }

        // Extract file URI from response (handle different response structures)
        fileId =
          uploadResponse?.file?.uri ||
          uploadResponse?.file?.name ||
          uploadResponse?.uri ||
          uploadResponse?.fileId ||
          uploadResponse?.name;

        if (!fileId) {
          throw new Error(
            "Failed to extract file ID from Gemini upload response"
          );
        }
      } catch (uploadErr) {
        // Clean up temp file on error
        await fs.unlink(file.path).catch(() => {});
        return res.status(500).json({
          error: "Failed to upload file to Gemini",
          message: uploadErr.message,
        });
      }

      // Clean up temp file after successful upload
      await fs.unlink(file.path).catch(() => {});

      return res.status(200).json({
        fileId: fileId,
        fileName: file.originalname,
        message: "File uploaded successfully",
      });
    } catch (error) {
      // Clean up temp file on error
      if (req.file?.path) {
        const fs = await import("fs/promises");
        await fs.unlink(req.file.path).catch(() => {});
      }
      return res.status(500).json({
        error: "File upload failed",
        message: error.message,
      });
    }
  }
);

//Send Message
router.post("/send-message", jwtAuth, async (req, res) => {
  try {
    const { sessionId, userMessage, fileId } = req.body;
    const session = await Session.findById(sessionId);
    if (!session) return res.status(404).json({ error: "Session not found" });

    // Check payment
    if (!session.isPaid)
      return res
        .status(403)
        .json({ error: "Payment required before chatting" });

    if (session.provider === "gemini") {
      // Gemini logic
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      // Build history for context, if needed
      const history = (session.messages || []).map((msg) => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }],
      }));

      // Build current message parts
      const currentMessageParts = [{ text: userMessage }];

      // If fileId is provided, add file reference to the message
      // Gemini API expects file references in parts array
      if (fileId) {
        currentMessageParts.push({
          fileData: {
            fileUri: fileId,
          },
        });
      }

      history.push({ role: "user", parts: currentMessageParts });
      let config = session.geminiConfig || {};
      const model = config.model || "gemini-3-flash-preview";
      // Pull systemInstruction from assistant asset if available
      let systemInstructionText = undefined;
      try {
        // Find the assistant for the session
        const assistant = await Assistant.findOne({
          assistantId: session.assistantId,
        });
        if (
          assistant &&
          assistant.config &&
          assistant.config.systemInstructionAsset
        ) {
          const fs = await import("fs/promises");
          try {
            const promptPath = path.resolve(
              process.cwd(),
              assistant.config.systemInstructionAsset
            );
            systemInstructionText = await fs.readFile(promptPath, "utf-8");
          } catch (err) {
            // fallback or error if not found
            return res.status(500).json({
              error: "systemInstruction file not found",
              message: err.message,
            });
          }
          // Add file analysis instructions if fileId is provided
          if (fileId) {
            systemInstructionText +=
              "\n\nIMPORTANT: An uploaded document has been provided for analysis. " +
              "The uploaded document is read-only. Do not invent missing clauses. " +
              "If information is missing from the document, respond with 'Not found in document.' " +
              "Follow the system rules strictly and analyze only what is present in the uploaded document.";
          }

          config = {
            ...config,
            systemInstruction: [{ text: systemInstructionText }],
          };
        }
      } catch (resolveErr) {
        return res.status(500).json({
          error: "Failed to resolve systemInstruction asset",
          message: resolveErr.message,
        });
      }
      let assistantMessage = "";
      let chunks = [];
      try {
        const response = await ai.models.generateContentStream({
          model,
          config,
          contents: history,
        });
        for await (const chunk of response) {
          if (chunk.text) {
            assistantMessage += chunk.text;
            chunks.push(chunk.text);
            // Optionally, stream chunk.text to client with res.write (for real streaming)
          }
        }
      } catch (geminiErr) {
        return res
          .status(500)
          .json({ error: geminiErr.message, message: "Gemini failed" });
      }
      session.messages.push({ role: "user", content: userMessage });
      session.messages.push({ role: "assistant", content: assistantMessage });
      await session.save();
      return res.json({ reply: assistantMessage });
    }
    // ========== OpenAI (default) logic ==========
    // Step 3: Add message to thread
    await client.beta.threads.messages.create(session.threadId, {
      role: "user",
      content: userMessage,
    });
    // Step 4: Run the assistant
    const run = await client.beta.threads.runs.create(session.threadId, {
      assistant_id: session.assistantId,
    });
    // Step 5: Poll until completed
    let runStatus;
    do {
      await new Promise((r) => setTimeout(r, 1000));
      runStatus = await client.beta.threads.runs.retrieve(
        session.threadId,
        run.id
      );
    } while (runStatus.status !== "completed");
    // Step 6: Fetch messages
    const messages = await client.beta.threads.messages.list(session.threadId);
    const assistantMessage =
      messages.data[0].content[0].text.value || "No response";
    // Save message history
    session.messages.push({ role: "user", content: userMessage });
    session.messages.push({ role: "assistant", content: assistantMessage });
    await session.save();
    res.json({ reply: assistantMessage });
  } catch (err) {
    res.status(500).json({
      error: err.message,
      message: "Failed to send message",
    });
  }
});

//Mark payment for session
router.post("/mark-payment", jwtAuth, async (req, res) => {
  const { sessionId } = req.body;
  const session = await Session.findById(sessionId);
  if (!session) return res.status(404).json({ error: "Session not found" });

  session.isPaid = true;
  await session.save();
  res.json({ message: "Payment confirmed. You can now chat!" });
});

export default router;
