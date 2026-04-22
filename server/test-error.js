import mongoose from "mongoose";
import Document from "./models/Document.js";
import Version from "./models/Version.js";
import User from "./models/User.js";
import { buildDefaultCommitMessage } from "./utils/versioning.js";

const MONGO_URI = "mongodb://127.0.0.1:27017/kodoc";

async function testCreate() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected");

    let user = await User.findOne();
    if (!user) {
      user = await User.create({ username: "test", email: "test@test.com", password: "pwd" });
    }

    const title = "Test Doc";
    const initialContent = "<p></p>";

    const document = new Document({
      title,
      owner: user._id,
      currentVersion: 1,
    });
    
    await document.save();
    console.log("Document saved:", document._id);

    const createdAt = new Date();
    const initialVersion = new Version({
      documentId: document._id,
      versionNumber: 1,
      content: initialContent,
      commitMessage: buildDefaultCommitMessage({ action: "initial", versionNumber: 1 }),
      action: "initial",
      contentSizeBytes: Buffer.byteLength(initialContent, "utf8"),
      createdBy: user._id,
      createdAt,
      updatedAt: createdAt,
    });
    
    await initialVersion.save();
    console.log("Version saved:", initialVersion._id);

    document.latestVersionId = initialVersion._id;
    await document.save();
    console.log("All success");

  } catch (error) {
    console.error("ERROR:", error);
  } finally {
    process.exit(0);
  }
}

testCreate();
