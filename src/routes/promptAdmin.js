import express from "express";
import multer from "multer";
import os from "os";
import fs from "fs/promises";
import { dualAuth } from "../middleware/dualAuth.js";
import {
  readPromptFile,
  uploadPromptFile,
  deletePromptFile,
  listPromptFiles,
  getPromptFileMetadata,
} from "../utils/promptManager.js";
import { PromptAudit } from "../model/promptAudit.model.js";

const router = express.Router();

// Configure multer for text file uploads
const upload = multer({
  dest: os.tmpdir(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for text files
  },
  fileFilter: (req, file, cb) => {
    // Accept only text files
    const allowedMimes = [
      "text/plain",
      "text/txt",
      "application/octet-stream", // Some systems send .txt as this
    ];

    // Also check file extension
    const ext = file.originalname.toLowerCase();
    const isTextFile =
      ext.endsWith(".txt") || allowedMimes.includes(file.mimetype);

    if (isTextFile) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only .txt files are allowed."), false);
    }
  },
});

/**
 * Helper: get admin email from the request (set by auth middleware)
 */
function getAdminEmail(req) {
  return req.admin?.email || req.apiKeyIdentifier || "unknown";
}

/**
 * GET /api/prompt-admin/list
 * List all prompt files with their identifiers
 */
router.get("/list", dualAuth, async (req, res) => {
  try {
    const files = await listPromptFiles();

    // Extract identifier from filename (remove .txt extension)
    const filesWithIdentifiers = files.map((file) => {
      const identifier = file.name.replace(/\.txt$/, "");
      return {
        identifier,
        filename: file.name,
        fullPath: file.fullPath,
        size: file.size,
        updated: file.updated,
      };
    });

    return res.status(200).json({
      message: "Prompt files retrieved successfully",
      files: filesWithIdentifiers,
      count: filesWithIdentifiers.length,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to list prompt files",
      message: error.message,
    });
  }
});

/**
 * GET /api/prompt-admin/get/:identifier
 * Get a specific prompt file content by identifier
 */
router.get("/get/:identifier", dualAuth, async (req, res) => {
  try {
    const { identifier } = req.params;

    // Validate identifier
    if (!identifier || identifier.includes("..") || identifier.includes("/")) {
      return res.status(400).json({
        error: "Invalid identifier",
      });
    }

    // Construct filename from identifier
    const filename = `${identifier}.txt`;
    const promptPath = `assets/prompts/${filename}`;

    const content = await readPromptFile(promptPath);
    const metadata = await getPromptFileMetadata(promptPath);

    return res.status(200).json({
      message: "Prompt file retrieved successfully",
      identifier,
      filename,
      content,
      metadata,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to get prompt file",
      message: error.message,
    });
  }
});

/**
 * GET /api/prompt-admin/get-by-filename/:filename
 * Get a specific prompt file content by filename (legacy endpoint)
 */
router.get("/get-by-filename/:filename", dualAuth, async (req, res) => {
  try {
    const { filename } = req.params;

    // Validate filename
    if (!filename || filename.includes("..") || filename.includes("/")) {
      return res.status(400).json({
        error: "Invalid filename",
      });
    }

    // Construct the prompt path
    const promptPath = `assets/prompts/${filename}`;

    const content = await readPromptFile(promptPath);
    const metadata = await getPromptFileMetadata(promptPath);

    return res.status(200).json({
      message: "Prompt file retrieved successfully",
      filename,
      content,
      metadata,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to get prompt file",
      message: error.message,
    });
  }
});

/**
 * POST /api/prompt-admin/upload-file
 * Upload or update a prompt file by uploading a .txt file directly
 * Form data: file (the .txt file), identifier (unique identifier for the file)
 * If identifier exists, the file will be replaced
 */
router.post(
  "/upload-file",
  dualAuth,
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: "No file uploaded",
          message: "Please upload a .txt file using the 'file' field",
        });
      }

      const { identifier } = req.body;

      if (!identifier) {
        // Clean up temp file
        await fs.unlink(req.file.path).catch(() => {});
        return res.status(400).json({
          error: "Identifier is required",
          message:
            "Please provide a unique identifier in the 'identifier' field",
        });
      }

      // Validate identifier (alphanumeric, dashes, underscores only)
      const identifierRegex = /^[a-zA-Z0-9_-]+$/;
      if (!identifierRegex.test(identifier)) {
        await fs.unlink(req.file.path).catch(() => {});
        return res.status(400).json({
          error: "Invalid identifier",
          message:
            "Identifier can only contain letters, numbers, dashes, and underscores",
        });
      }

      // Read file content
      const fileContent = await fs.readFile(req.file.path, "utf-8");

      // Clean up temp file
      await fs.unlink(req.file.path).catch(() => {});

      // Use identifier as the filename (always .txt extension)
      const filename = `${identifier}.txt`;
      const promptPath = `assets/prompts/${filename}`;

      // Check if file exists (for informational purposes)
      const metadata = await getPromptFileMetadata(promptPath);
      const isUpdate = metadata.exists;

      // Read previous content for audit log
      let previousContent = null;
      if (isUpdate) {
        try {
          previousContent = await readPromptFile(promptPath);
        } catch (_) {
          // ignore
        }
      }

      // Write file locally
      await uploadPromptFile(promptPath, fileContent);

      // Audit log
      await PromptAudit.create({
        identifier,
        action: isUpdate ? "update" : "create",
        previousContent,
        newContent: fileContent,
        performedBy: getAdminEmail(req),
        metadata: {
          fileSize: fileContent.length,
          lineCount: fileContent.split("\n").length,
        },
      });

      return res.status(200).json({
        message: isUpdate
          ? "Prompt file updated successfully"
          : "Prompt file uploaded successfully",
        identifier,
        filename,
        isUpdate,
        size: fileContent.length,
      });
    } catch (error) {
      // Clean up temp file on error
      if (req.file?.path) {
        await fs.unlink(req.file.path).catch(() => {});
      }
      return res.status(500).json({
        error: "Failed to upload prompt file",
        message: error.message,
      });
    }
  },
);

/**
 * POST /api/prompt-admin/upload
 * Upload or update a prompt file (legacy endpoint - JSON content)
 * Body: { filename: string, content: string }
 */
router.post("/upload", dualAuth, async (req, res) => {
  try {
    const { filename, content } = req.body;

    if (!filename || !content) {
      return res.status(400).json({
        error: "Filename and content are required",
      });
    }

    // Validate filename
    if (filename.includes("..") || filename.includes("/")) {
      return res.status(400).json({
        error: "Invalid filename",
      });
    }

    // Construct the prompt path
    const promptPath = `assets/prompts/${filename}`;
    const identifier = filename.replace(/\.txt$/, "");

    // Check if file exists
    const metadata = await getPromptFileMetadata(promptPath);
    const isUpdate = metadata.exists;

    // Read previous content for audit log
    let previousContent = null;
    if (isUpdate) {
      try {
        previousContent = await readPromptFile(promptPath);
      } catch (_) {
        // ignore
      }
    }

    // Write file locally
    await uploadPromptFile(promptPath, content);

    // Audit log
    await PromptAudit.create({
      identifier,
      action: isUpdate ? "update" : "create",
      previousContent,
      newContent: content,
      performedBy: getAdminEmail(req),
      metadata: {
        fileSize: content.length,
        lineCount: content.split("\n").length,
      },
    });

    return res.status(200).json({
      message: "Prompt file uploaded successfully",
      filename,
      isUpdate,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to upload prompt file",
      message: error.message,
    });
  }
});

/**
 * PUT /api/prompt-admin/update/:filename
 * Update an existing prompt file
 * Body: { content: string }
 */
router.put("/update/:filename", dualAuth, async (req, res) => {
  try {
    const { filename } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({
        error: "Content is required",
      });
    }

    // Validate filename
    if (filename.includes("..") || filename.includes("/")) {
      return res.status(400).json({
        error: "Invalid filename",
      });
    }

    // Construct the prompt path
    const promptPath = `assets/prompts/${filename}`;
    const identifier = filename.replace(/\.txt$/, "");

    // Check if file exists
    const metadata = await getPromptFileMetadata(promptPath);
    if (!metadata.exists) {
      return res.status(404).json({
        error: "Prompt file not found",
      });
    }

    // Read previous content for audit log
    let previousContent = null;
    try {
      previousContent = await readPromptFile(promptPath);
    } catch (_) {
      // ignore
    }

    // Write file locally
    await uploadPromptFile(promptPath, content);

    // Audit log
    await PromptAudit.create({
      identifier,
      action: "update",
      previousContent,
      newContent: content,
      performedBy: getAdminEmail(req),
      metadata: {
        fileSize: content.length,
        lineCount: content.split("\n").length,
      },
    });

    return res.status(200).json({
      message: "Prompt file updated successfully",
      filename,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to update prompt file",
      message: error.message,
    });
  }
});

/**
 * DELETE /api/prompt-admin/delete/:identifier
 * Delete a prompt file by identifier
 */
router.delete("/delete/:identifier", dualAuth, async (req, res) => {
  try {
    const { identifier } = req.params;

    // Validate identifier
    if (!identifier || identifier.includes("..") || identifier.includes("/")) {
      return res.status(400).json({
        error: "Invalid identifier",
      });
    }

    // Construct filename from identifier
    const filename = `${identifier}.txt`;
    const promptPath = `assets/prompts/${filename}`;

    // Check if file exists
    const metadata = await getPromptFileMetadata(promptPath);
    if (!metadata.exists) {
      return res.status(404).json({
        error: "Prompt file not found",
      });
    }

    // Read previous content for audit log
    let previousContent = null;
    try {
      previousContent = await readPromptFile(promptPath);
    } catch (_) {
      // ignore
    }

    // Delete locally
    await deletePromptFile(promptPath);

    // Audit log
    await PromptAudit.create({
      identifier,
      action: "delete",
      previousContent,
      newContent: null,
      performedBy: getAdminEmail(req),
      metadata: {
        fileSize: previousContent ? previousContent.length : 0,
        lineCount: previousContent ? previousContent.split("\n").length : 0,
      },
    });

    return res.status(200).json({
      message: "Prompt file deleted successfully",
      identifier,
      filename,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to delete prompt file",
      message: error.message,
    });
  }
});

/**
 * GET /api/prompt-admin/metadata/:filename
 * Get metadata for a prompt file
 */
router.get("/metadata/:filename", dualAuth, async (req, res) => {
  try {
    const { filename } = req.params;

    // Validate filename
    if (filename.includes("..") || filename.includes("/")) {
      return res.status(400).json({
        error: "Invalid filename",
      });
    }

    // Construct the prompt path
    const promptPath = `assets/prompts/${filename}`;

    const metadata = await getPromptFileMetadata(promptPath);

    if (!metadata.exists) {
      return res.status(404).json({
        error: "Prompt file not found",
      });
    }

    return res.status(200).json({
      message: "Metadata retrieved successfully",
      filename,
      metadata,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to get prompt file metadata",
      message: error.message,
    });
  }
});

/**
 * POST /api/prompt-admin/preview
 * Preview instruction content with formatting (no changes applied)
 * Body: { identifier: string, content?: string }
 * If content provided, shows preview of new content
 * If no content, shows preview of existing content
 */
router.post("/preview", dualAuth, async (req, res) => {
  try {
    const { identifier, content } = req.body;

    if (!identifier) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Identifier is required",
      });
    }

    // Validate identifier
    if (identifier.includes("..") || identifier.includes("/")) {
      return res.status(400).json({
        error: "Invalid identifier",
        message: "Identifier contains invalid characters",
      });
    }

    let previewContent;
    let metadata;
    let isExisting = false;

    if (content) {
      // Preview new content
      previewContent = content;
      metadata = {
        size: content.length,
        lines: content.split("\n").length,
        words: content.split(/\s+/).filter((word) => word.length > 0).length,
      };
    } else {
      // Preview existing content
      const filename = `${identifier}.txt`;
      const promptPath = `assets/prompts/${filename}`;

      try {
        previewContent = await readPromptFile(promptPath);
        const fileMetadata = await getPromptFileMetadata(promptPath);
        metadata = fileMetadata;
        isExisting = true;
      } catch (error) {
        return res.status(404).json({
          error: "Not Found",
          message: "Instruction file not found",
          identifier,
        });
      }
    }

    // Basic formatting for preview
    const formattedContent = {
      raw: previewContent,
      lines: previewContent.split("\n"),
      paragraphs: previewContent
        .split("\n\n")
        .filter((p) => p.trim().length > 0),
      sections: previewContent
        .split(/^#{1,3}\s+/m)
        .filter((s) => s.trim().length > 0),
    };

    return res.status(200).json({
      message: "Preview generated successfully",
      identifier,
      isExisting,
      content: formattedContent,
      metadata: {
        ...metadata,
        estimatedReadTime: Math.ceil(metadata.words / 200), // Assuming 200 words per minute
      },
    });
  } catch (error) {
    return res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to generate preview",
      details: error.message,
    });
  }
});

/**
 * POST /api/prompt-admin/diff
 * Show diff between existing and new content
 * Body: { identifier: string, newContent: string }
 */
router.post("/diff", dualAuth, async (req, res) => {
  try {
    const { identifier, newContent } = req.body;

    if (!identifier || !newContent) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Identifier and new content are required",
      });
    }

    // Validate identifier
    if (identifier.includes("..") || identifier.includes("/")) {
      return res.status(400).json({
        error: "Invalid identifier",
        message: "Identifier contains invalid characters",
      });
    }

    const filename = `${identifier}.txt`;
    const promptPath = `assets/prompts/${filename}`;

    let oldContent = "";
    let fileExists = false;

    try {
      oldContent = await readPromptFile(promptPath);
      fileExists = true;
    } catch (error) {
      // File doesn't exist, this is a new file
      oldContent = "";
    }

    // Simple diff implementation
    const oldLines = oldContent.split("\n");
    const newLines = newContent.split("\n");

    const changes = {
      added: [],
      removed: [],
      modified: [],
      unchanged: [],
      summary: {
        linesAdded: 0,
        linesRemoved: 0,
        linesModified: 0,
        linesUnchanged: 0,
      },
    };

    // Basic line-by-line comparison
    const maxLines = Math.max(oldLines.length, newLines.length);

    for (let i = 0; i < maxLines; i++) {
      const oldLine = oldLines[i] || "";
      const newLine = newLines[i] || "";

      if (oldLine === newLine) {
        if (oldLine) {
          // Don't count empty lines as unchanged
          changes.unchanged.push({
            lineNumber: i + 1,
            content: oldLine,
          });
          changes.summary.linesUnchanged++;
        }
      } else if (!oldLine && newLine) {
        changes.added.push({
          lineNumber: i + 1,
          content: newLine,
        });
        changes.summary.linesAdded++;
      } else if (oldLine && !newLine) {
        changes.removed.push({
          lineNumber: i + 1,
          content: oldLine,
        });
        changes.summary.linesRemoved++;
      } else {
        changes.modified.push({
          lineNumber: i + 1,
          oldContent: oldLine,
          newContent: newLine,
        });
        changes.summary.linesModified++;
      }
    }

    return res.status(200).json({
      message: "Diff generated successfully",
      identifier,
      fileExists,
      changes,
      isNewFile: !fileExists,
      metadata: {
        oldSize: oldContent.length,
        newSize: newContent.length,
        sizeDifference: newContent.length - oldContent.length,
      },
    });
  } catch (error) {
    return res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to generate diff",
      details: error.message,
    });
  }
});

/**
 * POST /api/prompt-admin/update-with-preview
 * Update instruction with preview validation
 * Body: { identifier: string, content: string, confirmChanges: boolean }
 */
router.post("/update-with-preview", dualAuth, async (req, res) => {
  try {
    const { identifier, content, confirmChanges } = req.body;

    if (!identifier || !content) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Identifier and content are required",
      });
    }

    if (!confirmChanges) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Changes must be confirmed before applying",
      });
    }

    // Validate identifier
    if (identifier.includes("..") || identifier.includes("/")) {
      return res.status(400).json({
        error: "Invalid identifier",
        message: "Identifier contains invalid characters",
      });
    }

    const filename = `${identifier}.txt`;
    const promptPath = `assets/prompts/${filename}`;

    // Check if file exists for update info
    const existingMetadata = await getPromptFileMetadata(promptPath);
    const isUpdate = existingMetadata.exists;

    // Read previous content for audit log
    let previousContent = null;
    if (isUpdate) {
      try {
        previousContent = await readPromptFile(promptPath);
      } catch (_) {
        // ignore
      }
    }

    // Write file locally
    await uploadPromptFile(promptPath, content);

    // Audit log
    await PromptAudit.create({
      identifier,
      action: isUpdate ? "update" : "create",
      previousContent,
      newContent: content,
      performedBy: getAdminEmail(req),
      metadata: {
        fileSize: content.length,
        lineCount: content.split("\n").length,
      },
    });

    return res.status(200).json({
      message: isUpdate
        ? "Instruction updated successfully"
        : "Instruction created successfully",
      identifier,
      filename,
      isUpdate,
      size: content.length,
      metadata: {
        lines: content.split("\n").length,
        words: content.split(/\s+/).filter((word) => word.length > 0).length,
        paragraphs: content.split("\n\n").filter((p) => p.trim().length > 0)
          .length,
      },
    });
  } catch (error) {
    return res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to update instruction",
      details: error.message,
    });
  }
});

/**
 * GET /api/prompt-admin/audit/:identifier
 * Get audit history for a specific prompt
 * Query params: limit (default 20), skip (default 0)
 */
router.get("/audit/:identifier", dualAuth, async (req, res) => {
  try {
    const { identifier } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = parseInt(req.query.skip) || 0;

    if (!identifier || identifier.includes("..") || identifier.includes("/")) {
      return res.status(400).json({
        error: "Invalid identifier",
      });
    }

    const [logs, total] = await Promise.all([
      PromptAudit.find({ identifier })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("-previousContent -newContent")
        .lean(),
      PromptAudit.countDocuments({ identifier }),
    ]);

    return res.status(200).json({
      message: "Audit logs retrieved successfully",
      identifier,
      logs,
      total,
      limit,
      skip,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to retrieve audit logs",
      message: error.message,
    });
  }
});

/**
 * GET /api/prompt-admin/audit
 * Get recent audit logs across all prompts
 * Query params: limit (default 20), skip (default 0)
 */
router.get("/audit", dualAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = parseInt(req.query.skip) || 0;

    const [logs, total] = await Promise.all([
      PromptAudit.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("-previousContent -newContent")
        .lean(),
      PromptAudit.countDocuments(),
    ]);

    return res.status(200).json({
      message: "Audit logs retrieved successfully",
      logs,
      total,
      limit,
      skip,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to retrieve audit logs",
      message: error.message,
    });
  }
});

/**
 * GET /api/prompt-admin/audit-detail/:id
 * Get full audit log entry including content (for rollback/comparison)
 */
router.get("/audit-detail/:id", dualAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const log = await PromptAudit.findById(id).lean();
    if (!log) {
      return res.status(404).json({
        error: "Audit log entry not found",
      });
    }

    return res.status(200).json({
      message: "Audit log detail retrieved successfully",
      log,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to retrieve audit log detail",
      message: error.message,
    });
  }
});

export default router;
