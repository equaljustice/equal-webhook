import express from "express";
import OpenAI from "openai";
import { jwtAuth } from "../middleware/jwtAuth.js";
import { Assistant } from "../model/assistant.model.js";
import { Session } from "../model/sesssion.model.js";

const router = express.Router();

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

//Create Assistant instance into db
router.post("/create", async (req, res) => {
  const { name, key, id, price, desc } = req.body;

  if (!name || !key || !id || !price || !desc) {
    return res.status(404).json({ message: "Info is required" });
  }

  try {
    const payload = {
      name,
      key,
      assistantId: id,
      price,
      description: desc,
    };
    const response = await Assistant.create(payload);
    return res.status(201).json(response);
  } catch (error) {
    return res.status(500).json({
      message: "Error creating assi stant",
      error: error.message,
    });
  }
});

//Modify a assistant
router.put("/update/:assistantId", async (req, res) => {
  const { assistantId } = req.params;
  const updateFields = {};
  const allowedFields = ["name", "key", "assistantId", "price", "description"];

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

    //Create a new thread
    const thread = await client.beta.threads.create();

    // return res.status(200).json({ thread });

    //Create session in DB
    const startedOn = new Date();
    const endedOn = new Date(startedOn.getTime() + 7 * 24 * 60 * 60 * 1000);
    const session = await Session.create({
      userId,
      assistantId,
      threadId: thread.id,
      title: assistant.name,
      assistantKey: sessionKey,
      price: assistant.price,
      startedOn,
      endedOn,
    });

    //Send SuccessMessage
    return res.status(201).json({
      message: "Session created successfully",
      sessionId: session._id,
      threadId: thread.id,
    });
  } catch (error) {
    console.error(err);
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

//Send Message
router.post("/send-message", jwtAuth, async (req, res) => {
  try {
    const { sessionId, userMessage } = req.body;
    const session = await Session.findById(sessionId);
    if (!session) return res.status(404).json({ error: "Session not found" });

    // Check payment
    if (!session.isPaid)
      return res
        .status(403)
        .json({ error: "Payment required before chatting" });

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
