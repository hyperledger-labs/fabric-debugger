const { Wallets } = require("fabric-network");
const fs = require("fs").promises;
const path = require("path");

/**
 * Constructs a wallet from MSP credentials.
 * @param {string} mspDir - Path to the MSP directory.
 * @param {string} walletDir - Path to the wallet directory.
 * @param {string} identityName - Unique label for the identity.
 * @param {string} mspId - MSP ID of the organization.
 */
/**
 * Exports a wallet to a JSON file.
 * @param {string} walletPath - Path to the wallet directory.
 * @param {string} outputFile - Path to the output JSON file.
 */

async function constructWallet(mspDir, walletDir, identityName, mspId) {
  try {
    const wallet = await Wallets.newFileSystemWallet(walletDir);
    console.log(`Wallet initialized at ${walletDir}`);

    const keystorePath = path.join(mspDir, "keystore");
    const signcertsPath = path.join(mspDir, "signcerts");
    const keystoreFiles = await fs.readdir(keystorePath);
    const privateKeyFile = keystoreFiles.find((file) => file.endsWith("_sk"));
    if (!privateKeyFile)
      throw new Error("Private key file ending with '_sk' not found.");
    const privateKey = await fs.readFile(
      path.join(keystorePath, privateKeyFile),
      "utf8"
    );

    const certFiles = await fs.readdir(signcertsPath);
    const certificateFile = certFiles.find((file) => file.endsWith(".pem"));
    if (!certificateFile) throw new Error("Certificate file '.pem' not found.");
    const certificate = await fs.readFile(
      path.join(signcertsPath, certificateFile),
      "utf8"
    );

    const identity = {
      credentials: {
        privateKey: privateKey.trim(),
        certificate: certificate.trim(),
      },
      mspId: mspId,
      type: "X.509",
    };

    await wallet.put(identityName, identity);
    console.log(
      `Identity "${identityName}" added to the wallet at "${walletDir}".`
    );

    const identityFromWallet = await wallet.get(identityName);
    if (identityFromWallet) {
      console.log(`Verified identity "${identityName}" exists in the wallet.`);
    } else {
      console.error(
        `Failed to verify identity "${identityName}" in the wallet.`
      );
    }
  } catch (error) {
    console.error("Error constructing wallet:", error.message);
  }
}

async function exportWalletAsJson(walletPath, outputFile) {
  console.log(`Starting export from walletPath: ${walletPath}`);
  console.log(`Output will be saved to: ${outputFile}`);

  try {
    const identities = await fs.readdir(walletPath);
    console.log("Detected files in wallet directory:", identities);

    const walletJson = {};

    for (const identityFile of identities) {
      console.log(`Processing file: ${identityFile}`);

      if (!identityFile.endsWith(".id")) {
        console.log(`Skipping non-.id file: ${identityFile}`);
        continue;
      }

      const identityPath = path.join(walletPath, identityFile);
      console.log(`Reading file at: ${identityPath}`);

      try {
        const fileContent = await fs.readFile(identityPath, "utf8");
        const identityData = JSON.parse(fileContent);
        const identityName = identityFile.replace(".id", "");
        console.log(`Parsed identity "${identityName}" successfully.`);

        walletJson.name = identityName;
        walletJson.credentials = {
          certificate:
            identityData.credentials?.certificate || "No Certificate Found",
          privateKey:
            identityData.credentials?.privateKey || "No Private Key Found",
        };
        walletJson.mspId = identityData.mspId || "Unknown MSP";
        walletJson.type = identityData.type || "X.509";
        walletJson.version = identityData.version || 1;
      } catch (err) {
        console.error(`Error processing file "${identityFile}":`, err.message);
      }
    }

    if (Object.keys(walletJson).length === 0) {
      console.error("No identities were exported.");
    } else {
      console.log("Final wallet data:", JSON.stringify(walletJson, null, 2));
    }

    await fs.writeFile(outputFile, JSON.stringify(walletJson, null, 2));
    console.log(`Wallet exported to ${outputFile}`);
  } catch (error) {
    console.error("Error exporting wallet:", error.message);
  }
}

(async () => {
  try {
    const args = process.argv.slice(2);

    if (args.length < 1) {
      throw new Error(
        "Usage:\n" +
          "To construct wallet: node constructWallet.js <mspDir> <walletDir> <identityName> <mspId>\n" +
          "To export wallet: node constructWallet.js export <walletPath> <outputFile>"
      );
    }

    if (args[0] === "export") {
      if (args.length !== 3) {
        throw new Error(
          "Usage: node constructWallet.js export <walletPath> <outputFile>"
        );
      }

      const [_, walletPath, outputFile] = args;
      try {
        await exportWalletAsJson(walletPath, outputFile);
      } catch (err) {
        console.error("Error exporting wallet:", err.message);
        throw err;
      }
    } else {
      if (args.length !== 4) {
        throw new Error(
          "Usage: node constructWallet.js <mspDir> <walletDir> <identityName> <mspId>"
        );
      }

      const [mspDir, walletDir, identityName, mspId] = args;

      try {
        await fs.access(mspDir);
        await fs.access(walletDir);
      } catch (err) {
        throw new Error(
          `Error: Ensure directories "${mspDir}" and "${walletDir}" exist and are accessible.`
        );
      }

      await constructWallet(mspDir, walletDir, identityName, mspId);
    }
  } catch (error) {
    console.error("Error:", error.message);
  }
})();

module.exports = {
  constructWallet,
  exportWalletAsJson,
};
