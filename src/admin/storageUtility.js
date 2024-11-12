const fs = require("fs");
const path = require("path");

async function saveConnectionProfileToStorage(context, profile) {
  try {
    const storagePath = context.globalStorageUri.fsPath;
    const profilePath = path.join(
      storagePath,
      `${profile.name}-connection.json`
    );

    if (!fs.existsSync(storagePath)) {
      fs.mkdirSync(storagePath, { recursive: true });
    }

    await fs.promises.writeFile(
      profilePath,
      JSON.stringify(profile, null, 2),
      "utf8"
    );
    console.log("Connection profile saved successfully.");
  } catch (error) {
    console.error("Error saving connection profile to storage:", error);
  }
}

async function loadConnectionProfilesFromStorage(context) {
  const storagePath = context.globalStorageUri.fsPath;
  if (fs.existsSync(storagePath)) {
    const files = fs.readdirSync(storagePath);
    const connectionProfiles = [];

    for (const file of files) {
      if (file.endsWith("-connection.json")) {
        const profileData = await fs.promises.readFile(
          path.join(storagePath, file),
          "utf8"
        );
        connectionProfiles.push(JSON.parse(profileData));
      }
    }
    return connectionProfiles;
  }
  return [];
}


module.exports = {
  saveConnectionProfileToStorage,
  loadConnectionProfilesFromStorage,
};
