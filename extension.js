/**
 * @param {vscode.ExtensionContext} context
 */
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const { TreeViewProvider } = require("./src/admin/treeview");
const { createConnectionProfileWebview } = require("./src/admin/webview");
const {
  saveConnectionProfileToStorage,
  saveWalletToStorage,
  loadConnectionProfilesFromStorage,
  loadWalletsFromStorage,
} = require("./src/admin/storageUtility");
const {
  getLatestBlockNumber,
  connectToFabric,
} = require("./src/blockReader/blockQueries");

let loadedConnectionProfile = null;

function activate(context) {
  const treeViewProviderFabric = new TreeViewProvider(
    "fabric-network",
    context
  );
  const treeViewProviderDesc = new TreeViewProvider("network-desc", context);
  const treeViewProviderWallet = new TreeViewProvider("wallets", context);

  vscode.window.createTreeView("fabric-network", {
    treeDataProvider: treeViewProviderFabric,
  });
  vscode.window.createTreeView("network-desc", {
    treeDataProvider: treeViewProviderDesc,
  });
  vscode.window.createTreeView("wallets", {
    treeDataProvider: treeViewProviderWallet,
  });

  const loadProfilesAndWallets = async () => {
    try {
      const savedProfiles = await loadConnectionProfilesFromStorage(context);
      const savedWallets = await loadWalletsFromStorage(context);

      if (savedProfiles.length > 0) {
        loadedConnectionProfile = savedProfiles[0];
        // console.log("Loaded connection profile:", loadedConnectionProfile);
      } else {
        console.warn("No connection profiles found in storage.");
      }

      savedProfiles.forEach((profile) => {
        const networkDetails = extractNetworkDetails(profile);
        const networkData = {
          channelName: profile.name,
          networkDetails,
          walletDetails: [],
        };
        treeViewProviderFabric.addNetwork(networkData);
        treeViewProviderDesc.addNetwork(networkData);
      });

      savedWallets.forEach((wallet) => {
        //console.log("Adding wallet:", JSON.stringify(wallet, null, 2));
        treeViewProviderWallet.addWallet(wallet);
      });

      savedProfiles.forEach((profile) => {
        const associatedWallets = savedWallets.filter(
          (wallet) =>
            wallet.mspId ===
            profile.organizations[profile.client.organization].mspid
        );
        if (associatedWallets.length > 0) {
          treeViewProviderWallet.networkWalletMap.set(
            profile.name,
            associatedWallets
          );
        }
      });
    } catch (error) {
      vscode.window.showErrorMessage(
        "Error loading profiles or wallets from storage."
      );
      console.error("Error loading profiles or wallets from storage:", error);
    }
  };

  loadProfilesAndWallets()
    .then(() => {
      //console.log("Profiles and wallets loaded successfully.");
    })
    .catch((error) => {
      console.error("Error loading profiles and wallets: ", error);
    });

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "fabric-network.openFilePicker",
      async () => {
        const fileUri = await vscode.window.showOpenDialog({
          canSelectFiles: true,
          canSelectMany: false,
          filters: {
            "JSON files": ["json"],
            "All files": ["*"],
          },
        });

        if (fileUri && fileUri[0]) {
          const filePath = fileUri[0].fsPath;
          fs.readFile(filePath, "utf8", async (err, fileContents) => {
            if (err) {
              vscode.window.showErrorMessage("Error reading the file");
              console.error(err);
              return;
            }

            try {
              const parsedData = JSON.parse(fileContents);
              loadedConnectionProfile = parsedData;

              if (loadedConnectionProfile) {
                await saveConnectionProfileToStorage(
                  context,
                  loadedConnectionProfile
                );

                const wallets = extractWalletsFromProfile(
                  loadedConnectionProfile
                );

                if (!wallets || wallets.length === 0) {
                  vscode.window.showWarningMessage(
                    "Wallet files or embedded data are missing. Please upload the wallet."
                  );
                } else {
                  for (const wallet of wallets) {
                    await saveWalletToStorage(context, wallet);
                    treeViewProviderWallet.addWallet(wallet);
                  }
                  const walletStoragePath = vscode.Uri.joinPath(
                    context.globalStorageUri,
                    "wallets.json"
                  );

                  await vscode.workspace.fs.writeFile(
                    walletStoragePath,
                    Buffer.from(JSON.stringify(wallets))
                  );

                  if (
                    !treeViewProviderWallet.networkWalletMap.has(
                      loadedConnectionProfile.name
                    )
                  ) {
                    treeViewProviderWallet.networkWalletMap.set(
                      loadedConnectionProfile.name,
                      []
                    );
                  }

                  wallets.forEach((wallet) => {
                    if (wallet && typeof wallet === "object") {
                      treeViewProviderWallet.networkWalletMap
                        .get(loadedConnectionProfile.name)
                        .push(wallet);
                      saveWalletToStorage(context, wallet);
                      treeViewProviderWallet.addWallet(wallet);
                    } else {
                      console.warn("Invalid wallet structure:", wallet);
                    }
                  });
                }

                const networkDetails = extractNetworkDetails(
                  loadedConnectionProfile
                );
                const networkData = {
                  channelName: loadedConnectionProfile.name,
                  networkDetails,
                  walletDetails: wallets,
                };

                treeViewProviderDesc.addNetwork(networkData);
                treeViewProviderFabric.addNetwork(networkData);
                vscode.window.showInformationMessage(
                  "Network loaded successfully"
                );
              } else {
                console.warn("Connection profile is not valid.");
              }
            } catch (parseError) {
              vscode.window.showErrorMessage("Error parsing JSON file");
              console.error(parseError);
            }
          });
        } else {
          vscode.window.showErrorMessage("No file selected");
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "fabric-network.switchNetwork",
      async (treeItem) => {
        const descItem = treeViewProviderDesc.getNetworkByLabel(treeItem.label);
        const fabricItem = treeViewProviderFabric.getNetworkByLabel(
          treeItem.label
        );

        if (descItem) {
          treeViewProviderDesc.setActiveNetwork(descItem);
        }
        if (fabricItem) {
          treeViewProviderFabric.setActiveNetwork(fabricItem);
        }

        const activeNetwork = fabricItem || descItem;
        if (!activeNetwork) {
          vscode.window.showErrorMessage(
            `Network not found for: ${treeItem.label}`
          );
          return;
        }

        const connectionProfileName = activeNetwork.label;

        let walletDetails =
          treeViewProviderWallet.networkWalletMap.get(connectionProfileName) ||
          [];

        if (walletDetails.length === 0) {
          vscode.window.showErrorMessage(
            `No wallets associated with network ${connectionProfileName}. Please upload the wallets.`
          );
          return;
        }
        const walletItem = treeViewProviderWallet.getWalletByLabel(
          walletDetails[0].name
        );
        if (walletItem) {
          vscode.window.showInformationMessage(
            `Switched to wallet: ${walletDetails[0].name}`
          );
        } else {
          vscode.window.showErrorMessage(
            `Wallet not found for network ${connectionProfileName}`
          );
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "fabric-network.deleteNetwork",
      async (treeItem) => {
        if (!treeItem || !treeItem.label) {
          vscode.window.showErrorMessage("No channel selected for deletion.");
          return;
        }

        const channelName = treeItem.label;

        const confirmation = await vscode.window.showWarningMessage(
          `Are you sure you want to delete the channel "${channelName}"? This action cannot be undone.`,
          { modal: true },
          "Delete"
        );

        if (confirmation === "Delete") {
          const wallets =
            treeViewProviderWallet.networkWalletMap.get(channelName) || [];
          //   console.log("Deleting wallets for channel:", channelName, wallets);

          if (wallets.length === 0) {
            console.warn(`No wallets found for channel: ${channelName}`);
          } else {
            // console.log(`Found ${wallets.length} wallets for deletion.`);
          }

          for (const wallet of wallets) {
            const walletId = wallet.name;

            if (walletId) {
              //   console.log(`Attempting to delete wallet with ID: ${walletId}`);
              await treeViewProviderWallet.deleteWallet(walletId, context);

              const storagePath = context.globalStorageUri.fsPath;
              const walletsPath = path.join(
                storagePath,
                `${walletId}-wallet.json`
              );

              //console.log(`Checking for wallet at: ${walletsPath}`);

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
            } else {
              console.warn(
                `Skipping wallet deletion due to undefined wallet ID for wallet:`,
                wallet
              );
            }
          }

          const storagePath = context.globalStorageUri.fsPath;
          const profilePath = path.join(
            storagePath,
            `${channelName}-connection.json`
          );

          if (fs.existsSync(profilePath)) {
            try {
              await fs.promises.unlink(profilePath);
              //   console.log(
              //     `Connection profile "${channelName}" deleted from storage.`
              //   );
            } catch (error) {
              console.error(
                `Failed to delete connection profile "${channelName}":`,
                error
              );
            }
          } else {
            console.warn(
              `Connection profile "${channelName}" not found in storage.`
            );
          }

          treeViewProviderFabric.deleteNetwork(channelName);
          treeViewProviderDesc.deleteNetwork(channelName);
          treeViewProviderWallet.networkWalletMap.delete(channelName);

          vscode.window.showInformationMessage(
            `Channel "${channelName}" has been deleted.`
          );
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "wallets.deleteWallet",
      async (walletItem) => {
        const walletId = walletItem.label.split(" (")[0];
        const connectionProfileName = walletItem.connectionProfileName;

        const confirmation = await vscode.window.showWarningMessage(
          `Are you sure you want to delete the wallet "${walletId}"?`,
          { modal: true },
          "Delete"
        );

        if (confirmation === "Delete") {
          treeViewProviderWallet.deleteWallet(walletId, context);

          const storagePath = context.globalStorageUri.fsPath;
          const walletsPath = path.join(storagePath, `${walletId}-wallet.json`);

          //console.log(`Checking for wallet at: ${walletsPath}`);

          try {
            if (fs.existsSync(walletsPath)) {
              await fs.promises.unlink(walletsPath);
              //console.log(`Wallet "${walletId}" deleted from storage.`);
            } else {
              console.warn(`Wallet storage for "${walletId}" not found.`);
            }
          } catch (error) {
            console.error(`Failed to delete wallet "${walletId}":`, error);
          }

          vscode.window.showInformationMessage(`Wallet "${walletId}" deleted.`);
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("fabric-network.start", () => {
      createConnectionProfileWebview();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("fabric-network.upload", (data) => {
      const connectionProfilePath = data.connectionProfilePath;
      if (fs.existsSync(connectionProfilePath)) {
        if (fs.statSync(connectionProfilePath).isDirectory()) {
          vscode.window.showErrorMessage(
            "Error: The provided path is a directory, not a file."
          );
          return;
        }
        try {
          const connectionProfile = JSON.parse(
            fs.readFileSync(connectionProfilePath, "utf8")
          );

          loadedConnectionProfile = connectionProfile;

          const wallets = extractWalletsFromProfile(connectionProfile);
          if (wallets.length > 0) {
            wallets.forEach((wallet) => {
              treeViewProviderWallet.addWallet(wallet);
            });
            vscode.window.showInformationMessage(
              "Wallets loaded successfully."
            );
          } else {
            vscode.window.showWarningMessage(
              "No wallet data found in connection profile."
            );
          }

          const networkDetails = extractNetworkDetails(connectionProfile);
          const networkData = {
            channelName: connectionProfile.name,
            networkDetails,
          };
          addNetworkWithWallets(networkData, wallets);
        } catch (err) {
          console.error("Error reading the connection profile:", err);
          vscode.window.showErrorMessage(
            "Failed to read the connection profile."
          );
        }
      } else {
        vscode.window.showErrorMessage("Connection profile file not found.");
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "wallets.checkConnectionProfile",
      (connectionProfile) => {
        if (connectionProfile && connectionProfile.organizations) {
          for (const orgName in connectionProfile.organizations) {
            const orgDetails = connectionProfile.organizations[orgName];
            const walletData = {
              name: orgName,
              mspId: orgDetails.mspid,
              adminPrivateKey: orgDetails.adminPrivateKey,
              signedCert: orgDetails.signedCert,
              type: orgDetails.type,
            };
            treeViewProviderWallet.addWallet(walletData);
          }
        } else {
          vscode.window.showWarningMessage(
            "No organization wallet data found in the connection profile."
          );
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("wallets.uploadWallet", async () => {
      try {
        const fileUri = await vscode.window.showOpenDialog({
          canSelectFiles: true,
          canSelectMany: false,
          filters: {
            "JSON files": ["json"],
            "All files": ["*"],
          },
        });

        if (!fileUri || !fileUri[0]) {
          vscode.window.showErrorMessage("No file selected");
          return;
        }

        const filePath = fileUri[0].fsPath;
        const fileContents = await fs.promises.readFile(filePath, "utf8");
        const walletData = JSON.parse(fileContents);
        const walletDetails = extractWalletDetails(walletData);

        if (!walletDetails) {
          vscode.window.showErrorMessage("Invalid wallet data");
          return;
        }

        const connectionProfiles = Array.from(
          treeViewProviderFabric.networks.keys()
        );
        const selectedProfile = await vscode.window.showQuickPick(
          connectionProfiles,
          {
            placeHolder:
              "Select a connection profile to associate with the wallet",
          }
        );

        if (!selectedProfile) {
          vscode.window.showWarningMessage(
            "Wallet upload cancelled; no connection profile selected."
          );
          return;
        }

        walletDetails.connectionProfileName = selectedProfile;

        const connectionProfile =
          treeViewProviderFabric.networks.get(selectedProfile);

        if (!connectionProfile) {
          vscode.window.showErrorMessage("Connection profile not found.");
          console.warn("Connection profile not found.");
          return;
        }

        if (!connectionProfile.wallets) {
          connectionProfile.wallets = [];
        }

        const existingWallet = connectionProfile.wallets.find(
          (wallet) => wallet.name === walletDetails.name
        );

        if (existingWallet) {
          console.warn("Wallet already exists.");
          return;
        } else {
          connectionProfile.wallets.push({
            name: walletDetails.name,
            mspId: walletDetails.mspId,
            certificate: walletDetails.certificate,
            privateKey: walletDetails.privateKey,
            type: walletDetails.type,
          });
        }

        treeViewProviderWallet.addWallet(walletDetails);

        const walletItem = {
          name: walletDetails.name,
          organization: walletDetails.mspId,
          isActive: false,
          ...walletDetails,
        };
        //treeViewProviderWallet.setActiveWallet(walletItem);

        tieWalletToConnectionProfile(selectedProfile);
        loadedConnectionProfile = connectionProfile;

        await saveWalletToStorage(context, walletDetails);

        treeViewProviderFabric.networks.set(selectedProfile, connectionProfile);
        vscode.window.showInformationMessage(
          `Wallet ${walletDetails.name} uploaded and associated with ${selectedProfile} successfully`
        );
      } catch (error) {
        vscode.window.showErrorMessage(
          `Error uploading wallet: ${error.message}`
        );
        console.error("Error uploading wallet:", error);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("wallets.switchWallet", (walletItems) => {
      if (!Array.isArray(walletItems) || walletItems.length === 0) {
        vscode.window.showErrorMessage("No wallets available for selection.");
        return;
      }

      if (walletItems.length === 1) {
        const walletItem = walletItems[0];
        //treeViewProviderWallet.setActiveWallet(walletItem);
        vscode.window.showInformationMessage(
          `Switched to wallet for organization: ${walletItem.label}`
        );
      } else {
        vscode.window
          .showQuickPick(
            walletItems.map((w) => w.label),
            { placeHolder: "Select a wallet to switch to" }
          )
          .then((selectedOrg) => {
            const selectedWallet = walletItems.find(
              (w) => w.label === selectedOrg
            );
            if (selectedWallet) {
              //treeViewProviderWallet.setActiveWallet(selectedWallet);
              vscode.window.showInformationMessage(
                `Switched to wallet for organization: ${selectedOrg}`
              );
            } else {
              vscode.window.showWarningMessage(
                `Wallet for organization ${selectedOrg} not found.`
              );
            }
          });
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("fabric-network.queryBlocks", async () => {
      if (!loadedConnectionProfile || !loadedConnectionProfile.name) {
        console.error(
          "Connection profile not loaded. Unable to query latest blocks."
        );
        vscode.window.showErrorMessage("Connection profile not loaded.");
        return;
      }

      const connectionProfileName = loadedConnectionProfile.name;
      const walletDetails =
        treeViewProviderWallet.networkWalletMap.get(connectionProfileName) ||
        [];
      //console.log("Wallet structure:", walletDetails);

      if (!walletDetails || walletDetails.length === 0) {
        console.error(
          `No wallets associated with network ${connectionProfileName}.`
        );
        vscode.window.showErrorMessage(
          "No wallets found. Please upload the wallets."
        );
        return;
      }

      const invalidWallets = walletDetails.filter(
        (wallet) => !wallet.name || !wallet.certificate || !wallet.privateKey
      );

      if (invalidWallets.length > 0) {
        console.error(
          "Invalid wallet item(s) provided for activation:",
          invalidWallets
        );
        vscode.window.showErrorMessage(
          "Invalid wallet data found. Please check wallet structure."
        );
        return;
      }

      try {
        const latestBlockNumber = await getLatestBlockNumber(
          loadedConnectionProfile
        );

        if (!latestBlockNumber) {
          vscode.window.showErrorMessage(
            "Failed to retrieve latest block number."
          );
          return;
        }
        console.log(`Latest block number: ${latestBlockNumber}`);

        const numOfBlocksInput = await vscode.window.showInputBox({
          prompt: `Enter the number of latest blocks to query (up to ${latestBlockNumber}):`,
        });

        const numOfBlocks = parseInt(numOfBlocksInput, 10);
        console.log(`User input for number of blocks: ${numOfBlocks}`);

        if (
          isNaN(numOfBlocks) ||
          numOfBlocks <= 0 ||
          numOfBlocks > latestBlockNumber
        ) {
          vscode.window.showErrorMessage(
            "Invalid number of blocks. Please enter a valid number."
          );
          return;
        }

        for (let i = 0; i < numOfBlocks; i++) {
          const blockNumber = latestBlockNumber - i;
          console.log(`Querying block number: ${blockNumber}`);
          vscode.window.showInformationMessage(
            `Querying block number: ${blockNumber}`
          );

          const block = await connectToFabric(
            loadedConnectionProfile,
            blockNumber
          );
          if (block) {
            console.log("Block data:", block);
            vscode.window.showInformationMessage(
              `Successfully queried block ${blockNumber}. Block Hash: ${block.header.data_hash}`
            );
          } else {
            vscode.window.showErrorMessage(`Block ${blockNumber} not found.`);
          }
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Error: ${error.message}`);
        console.error("Error during block query:", error);
      }
    })
  );

  function tieWalletToConnectionProfile(connectionProfileName) {
    if (typeof connectionProfileName !== "string") {
      console.warn(
        `Invalid connection profile name: Expected a string, got ${typeof connectionProfileName}`
      );
      return;
    }

    const connectionProfile = treeViewProviderFabric.networks.get(
      connectionProfileName
    );
    //console.log("retrieved connection profile:", connectionProfile);

    if (!connectionProfile) {
      console.warn(`Connection profile "${connectionProfileName}" not found.`);
      return;
    }
    if (!connectionProfile.wallets || connectionProfile.wallets.length === 0) {
      console.warn("No wallets associated with this connection profile.");
      vscode.window.showErrorMessage(
        "No wallets associated with this connection profile."
      );
      return;
    }
  }

  function extractNetworkDetails(profile) {
    const organizations = Object.keys(profile.organizations || {});
    const peers = Object.values(profile.peers || {}).map((peer) => peer.url);
    const orderers = Object.values(profile.orderers || {}).map(
      (orderer) => orderer.url
    );
    const cas = Object.values(profile.certificateAuthorities || {}).map(
      (ca) => ca.url
    );
    return { organizations, peers, orderers, cas };
  }
}

function extractWalletsFromProfile(profile) {
  const wallets = [];
  if (profile.organizations) {
    Object.keys(profile.organizations).forEach((orgKey) => {
      const orgData = profile.organizations[orgKey];
      const keyPath = orgData.adminPrivateKey?.path;
      const certPath = orgData.signedCert?.path;
      const privateKey = orgData.adminPrivateKey?.privateKey;
      const certificate = orgData.signedCert?.certificate;

      if (
        keyPath &&
        certPath &&
        fs.existsSync(keyPath) &&
        fs.existsSync(certPath)
      ) {
        const wallet = {
          connectionProfileName: profile.name,
          name: orgKey,
          mspId: orgData.mspid,
          certPath: certPath,
          keyPath: keyPath,
          type: "X.509",
          credentials: {
            certificate: fs.readFileSync(certPath).toString(),
            privateKey: fs.readFileSync(keyPath).toString(),
          },
        };
        wallets.push(wallet);
      } else if (privateKey && certificate) {
        const wallet = {
          connectionProfileName: profile.name,
          name: orgKey,
          mspId: orgData.mspid,
          type: "X.509",
          credentials: {
            certificate: certificate,
            privateKey: privateKey,
          },
        };
        wallets.push(wallet);
      }
    });
  }
  return wallets;
}

function extractWalletDetails(walletData) {
  if (
    walletData &&
    (walletData.credentials ||
      walletData.signedCert ||
      walletData.adminPrivateKey)
  ) {
    const {
      name = walletData.name || "Unknown Wallet",
      mspId = walletData.mspId || "Unknown MSP",
      type = walletData.type || "Unknown Type",
      credentials = {},
    } = walletData;

    const certificate =
      credentials.certificate ||
      walletData.signedCert ||
      walletData.certificate ||
      "No Certificate Found";

    const privateKey =
      credentials.privateKey ||
      walletData.privateKey ||
      walletData.adminPrivateKey ||
      "No Private Key Found";

    if (
      name &&
      mspId &&
      type &&
      certificate !== "No Certificate Found" &&
      privateKey !== "No Private Key Found"
    ) {
      return {
        name,
        mspId,
        certificate,
        privateKey,
        type,
      };
    } else {
      console.warn("Missing required wallet data fields:");
    }
  }
  return null;
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
