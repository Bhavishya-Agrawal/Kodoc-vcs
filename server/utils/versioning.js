import crypto from "crypto";

export const normalizeContent = (content = "") => content.trim();

export const buildDefaultCommitMessage = ({
  action = "save",
  versionNumber,
  restoredFromVersionNumber,
}) => {
  if (action === "initial") {
    return `Initialize document history (v${versionNumber})`;
  }

  if (action === "restore") {
    return `Restore from v${restoredFromVersionNumber} into v${versionNumber}`;
  }

  return `Save changes as v${versionNumber}`;
};
