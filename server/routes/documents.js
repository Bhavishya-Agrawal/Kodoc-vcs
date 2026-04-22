import express from "express";
import Document from "../models/Document.js";
import Version from "../models/Version.js";
import authMiddleware from "../middleware/auth.js";
import {
  buildDefaultCommitMessage,
} from "../utils/versioning.js";

const router = express.Router();

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const isTitleTaken = async (ownerId, title, excludeDocumentId = null) => {
  const query = {
    owner: ownerId,
    title: { $regex: new RegExp(`^${escapeRegExp(title)}$`, "i") },
  };

  if (excludeDocumentId) {
    query._id = { $ne: excludeDocumentId };
  }

  const existing = await Document.findOne(query).select("_id");
  return Boolean(existing);
};

const generateUniqueTitle = async (ownerId, requestedTitle) => {
  const baseTitle = requestedTitle.trim() || "Untitled Document";
  let candidate = baseTitle;
  let suffix = 2;

  while (await isTitleTaken(ownerId, candidate)) {
    candidate = `${baseTitle} (${suffix})`;
    suffix += 1;
  }

  return candidate;
};

// All routes here are protected by the auth middleware
router.use(authMiddleware);

// GET /api/documents
// Get all documents for the logged in user
router.get("/", async (req, res) => {
  try {
    // req.user.id comes from the decoded JWT in the authMiddleware
    const documents = await Document.find({ owner: req.user.id }).sort({ updatedAt: -1 });
    res.json(documents);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// POST /api/documents
// Create a new document
router.post("/", async (req, res) => {
  try {
    const { title } = req.body;
    const initialContent = "<p></p>";
    const uniqueTitle = await generateUniqueTitle(req.user.id, title || "Untitled Document");

    // Create the document
    const document = new Document({
      title: uniqueTitle,
      owner: req.user.id,
      currentVersion: 1,
    });
    
    await document.save();

    // Create the initial Version 1 (empty content)
    const createdAt = new Date();
    const initialVersion = new Version({
      documentId: document._id,
      versionNumber: 1,
      content: initialContent, // Empty paragraph for tiptap
      commitMessage: buildDefaultCommitMessage({ action: "initial", versionNumber: 1 }),
      action: "initial",
      contentSizeBytes: Buffer.byteLength(initialContent, "utf8"),
      createdBy: req.user.id,
      createdAt,
      updatedAt: createdAt,
    });
    
    await initialVersion.save();

    document.latestVersionId = initialVersion._id;
    await document.save();

    res.json({ document, initialVersion });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// GET /api/documents/:id
// Get a specific document
router.get("/:id", async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    // Make sure the user owns this document
    if (document.owner.toString() !== req.user.id) {
      return res.status(401).json({ message: "Not authorized" });
    }

    // Fetch the latest version content (prefer explicit pointer, fallback to version number)
    let currentVersion = null;
    if (document.latestVersionId) {
      currentVersion = await Version.findById(document.latestVersionId);
    }
    if (!currentVersion) {
      currentVersion = await Version.findOne({
        documentId: document._id,
        versionNumber: document.currentVersion,
      });
    }

    res.json({ document, content: currentVersion ? currentVersion.content : "" });
  } catch (err) {
    console.error(err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ message: "Document not found" });
    }
    res.status(500).send("Server Error");
  }
});

// PUT /api/documents/:id
// Update document title
router.put("/:id", async (req, res) => {
  try {
    const { title } = req.body;
    let document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    if (document.owner.toString() !== req.user.id) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const nextTitle = (title || "Untitled Document").trim() || "Untitled Document";
    const titleExists = await isTitleTaken(req.user.id, nextTitle, document._id);

    if (titleExists) {
      return res.status(409).json({ message: "A document with this title already exists." });
    }

    document.title = nextTitle;
    await document.save();

    res.json(document);
  } catch (err) {
    console.error(err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ message: "Document not found" });
    }
    res.status(500).send("Server Error");
  }
});

// DELETE /api/documents/:id
// Delete a document and all its versions
router.delete("/:id", async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    if (document.owner.toString() !== req.user.id) {
      return res.status(401).json({ message: "Not authorized" });
    }

    // Delete the document itself
    await Document.findByIdAndDelete(req.params.id);
    
    // Also delete all versions associated with this document
    await Version.deleteMany({ documentId: req.params.id });

    res.json({ message: "Document removed" });
  } catch (err) {
    console.error(err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ message: "Document not found" });
    }
    res.status(500).send("Server Error");
  }
});

export default router;
