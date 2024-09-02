const fs = require("fs");
const path = require("path");

/**
 * Ensures that the storage directory exists.
 * @param {string} dirPath
 */
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Read data from a JSON file in global storage.
 * @param {vscode.ExtensionContext} context
 * @param {string} fileName
 * @returns {Promise<any>}
 */
async function readStorageFile(context, fileName) {
  const filePath = path.join(context.globalStorageUri.fsPath, fileName);
  ensureDirectoryExists(context.globalStorageUri.fsPath);
  if (fs.existsSync(filePath)) {
    const fileContents = await fs.promises.readFile(filePath, "utf8");
    return JSON.parse(fileContents);
  }
  return null;
}

/**
 * Write data to a JSON file in global storage.
 * @param {vscode.ExtensionContext} context
 * @param {string} fileName
 * @param {any} data
 */
async function writeStorageFile(context, fileName, data) {
  const filePath = path.join(context.globalStorageUri.fsPath, fileName);
  ensureDirectoryExists(context.globalStorageUri.fsPath);
  await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2));
}

module.exports = {
  readStorageFile,
  writeStorageFile,
};
