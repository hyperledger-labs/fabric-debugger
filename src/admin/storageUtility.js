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

    if (fs.existsSync(profilePath)) {
      const existingProfileData = await fs.promises.readFile(
        profilePath,
        "utf8"
      );
      const existingProfile = JSON.parse(existingProfileData);

      if (JSON.stringify(existingProfile) === JSON.stringify(profile)) {
        // console.log(
        //   `Connection profile "${profile.name}" already exists with identical content. Skipping save.`
        // );
        return;
      }
    }

    await fs.promises.writeFile(
      profilePath,
      JSON.stringify(profile, null, 2),
      "utf8"
    );
    //console.log(`Connection profile saved at: ${profilePath}`);
  } catch (error) {
    console.error("Error saving connection profile to storage:", error);
  }
}

async function saveWalletToStorage(context, wallet) {
  try {
    const storagePath = context.globalStorageUri.fsPath;
    const walletPath = path.join(storagePath, `${wallet.name}-wallet.json`);

    if (!fs.existsSync(storagePath)) {
      fs.mkdirSync(storagePath, { recursive: true });
    }
    if (fs.existsSync(walletPath)) {
      const existingWalletData = await fs.promises.readFile(walletPath, "utf8");
      const existingWallet = JSON.parse(existingWalletData);

      if (JSON.stringify(existingWallet) === JSON.stringify(wallet)) {
        console.log(
          `Wallet "${wallet.name}" already exists with identical content. Skipping save.`
        );
        return;
      }
    }
    await fs.promises.writeFile(
      walletPath,
      JSON.stringify(wallet, null, 2),
      "utf8"
    );
    console.log(`Wallet saved at: ${walletPath}`);
  } catch (error) {
    console.error("Error saving wallet to storage:", error);
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

async function loadWalletsFromStorage(context) {
  const storagePath = context.globalStorageUri.fsPath;
  console.log(`Loading wallets from: ${storagePath}`);

  if (fs.existsSync(storagePath)) {
    const files = fs.readdirSync(storagePath);
    const wallets = [];

    for (const file of files) {
      if (file.endsWith("-wallet.json")) {
        try {
          const walletData = await fs.promises.readFile(
            path.join(storagePath, file),
            "utf8"
          );
          const wallet = JSON.parse(walletData);
          if (
            wallet.name &&
            wallet.certificate &&
            wallet.privateKey &&
            wallet.mspId
          ) {
            wallets.push(wallet);
          } else {
            console.error(`Invalid wallet structure in file ${file}:`, wallet);
          }
        } catch (err) {
          console.error(`Error reading wallet file ${file}:`, err);
        }
      }
    }
    console.log("Loaded wallets:", wallets);
    return wallets;
  }

  console.warn("Storage path does not exist:", storagePath);
  return [];
}



async function deleteConnectionProfileFromStorage(context, profileName) {
  const storagePath = context.globalStorageUri.fsPath;
  const profilePath = path.join(storagePath, `${profileName}-connection.json`);

  if (fs.existsSync(profilePath)) {
    await fs.promises.unlink(profilePath);
    // console.log(`Connection profile "${profileName}" deleted from storage.`);
  } else {
    console.warn(`Connection profile "${profileName}" not found in storage.`);
  }
}

async function deleteWalletFromStorage(context, profileName, walletId) {
  const storagePath = context.globalStorageUri.fsPath;
  const walletsPath = path.join(storagePath, `${walletId}-wallet.json`);

//   console.log(`Checking for wallet at: ${walletsPath}`);
  console.warn(`Wallet storage for "${profileName}" not found.`);

  try {
    if (fs.existsSync(walletsPath)) {
      await fs.promises.unlink(walletsPath);
    //   console.log(`Wallet "${walletId}" deleted from storage.`);
    } else {
      console.warn(`Wallet storage for "${walletId}" not found.`);
    }
  } catch (error) {
    console.error(`Failed to delete wallet "${walletId}":`, error);
  }
}

module.exports = {
  saveConnectionProfileToStorage,
  saveWalletToStorage,
  loadConnectionProfilesFromStorage,
  loadWalletsFromStorage,
  deleteWalletFromStorage,
  deleteConnectionProfileFromStorage,
};
