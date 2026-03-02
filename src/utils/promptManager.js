import fs from "fs/promises";
import path from "path";
import { Prompt } from "../model/prompt.model.js";

/**
 * Extract identifier from a prompt path.
 * "assets/prompts/will_instructions.txt" → "will_instructions"
 * @param {string} promptPath
 * @returns {string}
 */
function extractIdentifier(promptPath) {
  const basename = path.basename(promptPath, ".txt");
  return basename;
}

/**
 * Extract filename from a prompt path.
 * "assets/prompts/will_instructions.txt" → "will_instructions.txt"
 * @param {string} promptPath
 * @returns {string}
 */
function extractFilename(promptPath) {
  return path.basename(promptPath);
}

const isDev = process.env.NODE_ENV !== "production";

/**
 * Read a prompt.
 *   - Development: reads directly from local .txt files (instant feedback on edits).
 *   - Production:  reads from MongoDB (managed via admin panel).
 *
 * @param {string} promptPath  e.g. "assets/prompts/gst_arrest.txt"
 * @returns {Promise<string>}
 */
export async function readPromptFile(promptPath) {
  if (!promptPath) {
    throw new Error("Prompt path is required");
  }

  if (isDev) {
    const filePath = path.resolve(process.cwd(), promptPath);
    console.log(`[PromptManager] READ from local file (dev) | path: "${filePath}"`);
    try {
      const content = await fs.readFile(filePath, "utf-8");
      console.log(`[PromptManager] FOUND local file | size: ${content.length} chars`);
      return content;
    } catch (err) {
      console.error(`[PromptManager] Local file not found: "${filePath}", falling back to MongoDB`);
      // Fall through to MongoDB lookup
    }
  }

  const identifier = extractIdentifier(promptPath);
  console.log(`[PromptManager] READ from MongoDB | identifier: "${identifier}" | path: "${promptPath}"`);

  const doc = await Prompt.findOne({ identifier }).lean();

  if (!doc) {
    console.error(`[PromptManager] NOT FOUND in MongoDB | identifier: "${identifier}"`);
    throw new Error(`Prompt not found: ${identifier} (path: ${promptPath})`);
  }

  console.log(`[PromptManager] FOUND in MongoDB | identifier: "${identifier}" | size: ${doc.content.length} chars | updatedAt: ${doc.updatedAt}`);
  return doc.content;
}

/**
 * Create or update a prompt in MongoDB.
 * @param {string} promptPath
 * @param {string|Buffer} content
 * @returns {Promise<string>} identifier
 */
export async function uploadPromptFile(promptPath, content) {
  if (!promptPath || !content) {
    throw new Error("Prompt path and content are required");
  }

  const identifier = extractIdentifier(promptPath);
  const filename = extractFilename(promptPath);
  const contentString = Buffer.isBuffer(content)
    ? content.toString("utf-8")
    : content;

  console.log(`[PromptManager] WRITE to MongoDB | identifier: "${identifier}" | size: ${contentString.length} chars`);

  await Prompt.findOneAndUpdate(
    { identifier },
    {
      identifier,
      filename,
      content: contentString,
      updatedAt: new Date(),
    },
    { upsert: true, new: true },
  );

  console.log(`[PromptManager] WRITE SUCCESS | identifier: "${identifier}" saved to MongoDB`);
  return identifier;
}

/**
 * Delete a prompt from MongoDB.
 * @param {string} promptPath
 * @returns {Promise<void>}
 */
export async function deletePromptFile(promptPath) {
  if (!promptPath) {
    throw new Error("Prompt path is required");
  }

  const identifier = extractIdentifier(promptPath);
  console.log(`[PromptManager] DELETE from MongoDB | identifier: "${identifier}"`);

  const result = await Prompt.deleteOne({ identifier });

  if (result.deletedCount === 0) {
    console.error(`[PromptManager] DELETE FAILED | identifier: "${identifier}" not found in MongoDB`);
    throw new Error(`Prompt not found: ${identifier}`);
  }

  console.log(`[PromptManager] DELETE SUCCESS | identifier: "${identifier}" removed from MongoDB`);
}

/**
 * List all prompts stored in MongoDB.
 * Returns the same shape the callers in promptAdmin.js expect.
 * @returns {Promise<Array<{name: string, fullPath: string, size: number, updated: Date}>>}
 */
export async function listPromptFiles() {
  console.log(`[PromptManager] LIST from MongoDB`);

  const docs = await Prompt.find({})
    .select("identifier filename content updatedAt")
    .lean();

  console.log(`[PromptManager] LIST SUCCESS | found ${docs.length} prompt(s) in MongoDB`);

  return docs.map((doc) => ({
    name: doc.filename,
    fullPath: `assets/prompts/${doc.filename}`,
    size: Buffer.byteLength(doc.content, "utf-8"),
    updated: doc.updatedAt,
  }));
}

/**
 * Get metadata for a prompt (exists check, size, updated date).
 * @param {string} promptPath
 * @returns {Promise<{exists: boolean, size?: number, updated?: Date, contentType?: string}>}
 */
export async function getPromptFileMetadata(promptPath) {
  if (!promptPath) {
    throw new Error("Prompt path is required");
  }

  const identifier = extractIdentifier(promptPath);
  console.log(`[PromptManager] METADATA from MongoDB | identifier: "${identifier}"`);

  const doc = await Prompt.findOne({ identifier })
    .select("content updatedAt")
    .lean();

  if (!doc) {
    console.log(`[PromptManager] METADATA | identifier: "${identifier}" does not exist in MongoDB`);
    return { exists: false };
  }

  console.log(`[PromptManager] METADATA FOUND | identifier: "${identifier}" | updatedAt: ${doc.updatedAt}`);
  return {
    exists: true,
    size: Buffer.byteLength(doc.content, "utf-8"),
    updated: doc.updatedAt,
    contentType: "text/plain",
  };
}

/**
 * Seed prompts from local .txt files into MongoDB.
 * Only inserts NEW prompts that don't already exist in the DB.
 * Existing prompts are never touched — update them manually via the admin panel.
 * Called once at app startup.
 */
export async function seedPromptsFromLocal() {
  const promptsDir = path.resolve(process.cwd(), "assets", "prompts");

  let entries;
  try {
    entries = await fs.readdir(promptsDir, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") {
      console.log("No local prompts directory found, skipping seed.");
      return;
    }
    throw error;
  }

  const txtFiles = entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".txt"))
    .map((e) => e.name);

  if (txtFiles.length === 0) {
    console.log("No local .txt files found, skipping seed.");
    return;
  }

  const existing = await Prompt.find({})
    .select("identifier")
    .lean();
  const existingSet = new Set(existing.map((d) => d.identifier));

  let seeded = 0;

  for (const filename of txtFiles) {
    const identifier = path.basename(filename, ".txt");

    if (existingSet.has(identifier)) {
      continue;
    }

    const filePath = path.join(promptsDir, filename);
    const content = await fs.readFile(filePath, "utf-8");

    await Prompt.create({
      identifier,
      filename,
      content,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    seeded++;
    console.log(`[Seed] Inserted new prompt: ${identifier}`);
  }

  if (seeded > 0) {
    console.log(`[Seed] Seeded ${seeded} new prompt(s).`);
  } else {
    console.log("[Seed] All prompts already exist in DB, no new ones to seed.");
  }
}
