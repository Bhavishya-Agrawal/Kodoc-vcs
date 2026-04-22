import express from "express";
import Document from "../models/Document.js";
import Version from "../models/Version.js";
import authMiddleware from "../middleware/auth.js";
import {
  normalizeContent,
  buildDefaultCommitMessage,
} from "../utils/versioning.js";

const router = express.Router();

// All routes are protected
router.use(authMiddleware);

// Middleware to verify document ownership before accessing its versions
const verifyDocumentOwnership = async (req, res, next) => {
  try {
    const document = await Document.findById(req.params.docId);
    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }
    if (document.owner.toString() !== req.user.id) {
      return res.status(401).json({ message: "Not authorized" });
    }
    req.document = document; // Attach document to req for later use
    next();
  } catch (err) {
    if (err.kind === "ObjectId") {
      return res.status(404).json({ message: "Document not found" });
    }
    res.status(500).send("Server Error");
  }
};

// GET /api/documents/:docId/versions
// Get all versions for a document
router.get("/:docId/versions", verifyDocumentOwnership, async (req, res) => {
  try {
    // We sort by versionNumber descending (newest first) as requested
    const versions = await Version.find({ documentId: req.params.docId }).sort({ versionNumber: -1 });
    res.json(versions);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// POST /api/documents/:docId/versions
// Save a new version
router.post("/:docId/versions", verifyDocumentOwnership, async (req, res) => {
  try {
    const { content = "", commitMessage } = req.body;
    const document = req.document;
    const normalizedContent = normalizeContent(content);

    let latestVersion = null;
    if (document.latestVersionId) {
      latestVersion = await Version.findById(document.latestVersionId);
    }

    if (!latestVersion) {
      latestVersion = await Version.findOne({ documentId: req.params.docId }).sort({
        versionNumber: -1,
      });
    }

    const latestContent = latestVersion ? normalizeContent(latestVersion.content || "") : "";

    if (latestContent === normalizedContent) {
      return res.status(200).json({
        saved: false,
        reason: "NO_CHANGES",
        message: "No changes detected. Version not created.",
        latestVersion,
      });
    }

    // Increment version number
    const newVersionNumber = document.currentVersion + 1;
    const createdAt = new Date();
    const resolvedCommitMessage = (commitMessage || "").trim() || buildDefaultCommitMessage({
      action: "save",
      versionNumber: newVersionNumber,
    });

    // Create the new version
    const newVersion = new Version({
      documentId: document._id,
      versionNumber: newVersionNumber,
      content: normalizedContent,
      commitMessage: resolvedCommitMessage,
      parentVersionId: latestVersion?._id || null,
      action: "save",
      contentSizeBytes: Buffer.byteLength(normalizedContent, "utf8"),
      createdBy: req.user.id,
      createdAt,
      updatedAt: createdAt,
    });

    await newVersion.save();

    // Update the document's current version
    document.currentVersion = newVersionNumber;
    document.latestVersionId = newVersion._id;
    await document.save();

    res.json({ saved: true, version: newVersion });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// GET /api/documents/:docId/versions/:versionId
// Get a specific version
router.get("/:docId/versions/:versionId", verifyDocumentOwnership, async (req, res) => {
  try {
    const version = await Version.findById(req.params.versionId);
    
    if (!version || version.documentId.toString() !== req.params.docId) {
      return res.status(404).json({ message: "Version not found" });
    }

    res.json(version);
  } catch (err) {
    console.error(err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ message: "Version not found" });
    }
    res.status(500).send("Server Error");
  }
});

// POST /api/documents/:docId/versions/:versionId/restore
// Restore an old version by creating a new version with its content
router.post("/:docId/versions/:versionId/restore", verifyDocumentOwnership, async (req, res) => {
  try {
    const { commitMessage } = req.body;
    const document = req.document;
    
    // Find the version they want to restore
    const oldVersion = await Version.findById(req.params.versionId);
    
    if (!oldVersion || oldVersion.documentId.toString() !== req.params.docId) {
      return res.status(404).json({ message: "Version not found" });
    }

    let latestVersion = null;
    if (document.latestVersionId) {
      latestVersion = await Version.findById(document.latestVersionId);
    }
    if (!latestVersion) {
      latestVersion = await Version.findOne({ documentId: req.params.docId }).sort({
        versionNumber: -1,
      });
    }

    const targetContent = normalizeContent(oldVersion.content || "");
    const latestContent = latestVersion ? normalizeContent(latestVersion.content || "") : "";

    if (latestContent === targetContent) {
      return res.status(200).json({
        saved: false,
        reason: "NO_CHANGES",
        message: "Selected version matches latest content. Restore skipped.",
        latestVersion,
      });
    }

    // Increment version number to create a new version at the top of the history
    const newVersionNumber = document.currentVersion + 1;
    const createdAt = new Date();
    const resolvedCommitMessage = (commitMessage || "").trim() || buildDefaultCommitMessage({
      action: "restore",
      versionNumber: newVersionNumber,
      restoredFromVersionNumber: oldVersion.versionNumber,
    });

    const restoredVersion = new Version({
      documentId: document._id,
      versionNumber: newVersionNumber,
      content: oldVersion.content, // Copy old content
      commitMessage: resolvedCommitMessage,
      parentVersionId: latestVersion?._id || null,
      action: "restore",
      restoredFromVersionId: oldVersion._id,
      restoredFromVersionNumber: oldVersion.versionNumber,
      contentSizeBytes: Buffer.byteLength(oldVersion.content || "", "utf8"),
      createdBy: req.user.id,
      createdAt,
      updatedAt: createdAt,
    });

    await restoredVersion.save();

    // Update document
    document.currentVersion = newVersionNumber;
    document.latestVersionId = restoredVersion._id;
    await document.save();

    res.json({ saved: true, version: restoredVersion });
  } catch (err) {
    console.error(err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ message: "Version not found" });
    }
    res.status(500).send("Server Error");
  }
});

export default router;
