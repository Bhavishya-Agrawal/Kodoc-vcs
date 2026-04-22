import mongoose from "mongoose";

const versionSchema = new mongoose.Schema(
  {
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      required: true,
    },
    versionNumber: {
      type: Number,
      required: true,
    },
    content: {
      type: String, // Tiptap HTML/JSON string
      default: "",
    },

    commitMessage: {
      type: String,
      required: true,
      trim: true,
      maxlength: 240,
    },
    parentVersionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Version",
      default: null,
    },
    action: {
      type: String,
      enum: ["initial", "save", "restore"],
      default: "save",
    },
    restoredFromVersionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Version",
      default: null,
    },
    restoredFromVersionNumber: {
      type: Number,
      default: null,
    },
    contentSizeBytes: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

versionSchema.index({ documentId: 1, versionNumber: -1 }, { unique: true });
versionSchema.index({ documentId: 1, createdAt: -1 });

const Version = mongoose.model("Version", versionSchema);
export default Version;
