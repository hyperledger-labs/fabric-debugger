/**
 * @param {vscode.ExtensionContext} context
 */

const vscode = require("vscode");
const fs = require("fs");
const { TreeViewProvider } = require("./src/treeview");
const { createConnectionProfileWebview } = require("./src/webview");

const fabricsamples = require('./src/fabricsamples');

function activate(context) {
  const hyperledgerProvider = new fabricsamples();
  vscode.window.registerTreeDataProvider('start-local-network', hyperledgerProvider);
  const treeViewProviderFabric = new TreeViewProvider(
    "fabric-network",
    context
  );
  const treeViewProviderDesc = new TreeViewProvider("network-desc", context);
  const treeViewProviderWallet = new TreeViewProvider("wallets", context);
  const disposable1 = vscode.commands.registerCommand(
    "myview.button1",
    function () {
      vscode.window.showInformationMessage("Stop Network!");
      console.log("Button1");
    }
  );
  const disposable2 = vscode.commands.registerCommand(
    "myview.button2",
    function () {
      vscode.window.showInformationMessage("Start Network!");
      console.log("Button2");
    }
  );
  vscode.window.createTreeView("fabric-network", {
    treeDataProvider: treeViewProviderFabric,
  });
  vscode.window.createTreeView("network-desc", {
    treeDataProvider: treeViewProviderDesc,
  });
  vscode.window.createTreeView("wallets", {
    treeDataProvider: treeViewProviderWallet,
  });

  context.subscriptions.push(
    vscode.commands.registerCommand("wallets.uploadWallet", async () => {
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
        fs.readFile(filePath, "utf8", (err, fileContents) => {
          if (err) {
            vscode.window.showErrorMessage("Error reading the file");
            console.error(err);
            return;
          }
          try {
            const walletData = JSON.parse(fileContents);
            const walletDetails = extractWalletDetails(walletData);
            if (walletDetails) {
              vscode.window.showInformationMessage(
                `Wallet ${walletDetails.name} uploaded successfully`
              );
              treeViewProviderWallet.addWallet(walletDetails);
            } else {
              vscode.window.showWarningMessage(
                "No wallet data found in the uploaded file!"
              );
            }
          } catch (parseError) {
            vscode.window.showErrorMessage("Error parsing JSON file");
            console.error(parseError);
          }
        });
      } else {
        vscode.window.showErrorMessage("No file selected");
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "wallets.checkConnectionProfile",
      (connectionProfile) => {
        if (connectionProfile && connectionProfile.wallet) {
          addWalletToTreeView(connectionProfile.wallet);
        } else {
          vscode.window.showWarningMessage(
            "No wallet data found, upload wallet file?"
          );
        }
      }
    )
  );

  function addWalletToTreeView(walletData) {
    const walletName = walletData.name || walletData.walletId || null;
    if (walletName) {
      treeViewProviderWallet.addWallet({ id: walletName });
    }
  }

  context.subscriptions.push(
    vscode.commands.registerCommand("wallets.deleteWallet", (walletItem) => {
      const walletId = walletItem.label.split(" (")[0];
      vscode.window
        .showWarningMessage(
          `Are you sure you want to delete the wallet "${walletId}"?`,
          { modal: true },
          "Delete"
        )
        .then((confirmation) => {
          if (confirmation === "Delete") {
            treeViewProviderWallet.deleteWallet(walletId);
            vscode.window.showInformationMessage(
              `Wallet "${walletId}" deleted.`
            );
          }
        });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("wallets.switchWallet", (walletItem) => {
      const selectedWallet = walletItem.label;
      const activeNetwork = treeViewProviderFabric.getActiveNetwork()?.label;
      if (activeNetwork) {
        const networkWallets =
          treeViewProviderWallet.getWalletsForNetwork(activeNetwork);
        const wallet = networkWallets.find(
          (wallet) => wallet.name === selectedWallet
        );
        if (wallet) {
          treeViewProviderWallet.setActiveWallet(wallet);
          treeViewProviderWallet.refresh();
          vscode.window.showInformationMessage(
            `Switched to wallet: ${selectedWallet}`
          );
        } else {
          vscode.window.showErrorMessage(
            `Wallet not found for the network: ${activeNetwork}`
          );
        }
      } else {
        vscode.window.showErrorMessage("No active network selected.");
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "fabric-network.switchNetwork",
      (treeItem) => {
        const descItem = treeViewProviderDesc.getNetworkByLabel(treeItem.label);
        const fabricItem = treeViewProviderFabric.getNetworkByLabel(
          treeItem.label
        );
        if (descItem) treeViewProviderDesc.setActiveNetwork(descItem);
        if (fabricItem) treeViewProviderFabric.setActiveNetwork(fabricItem);

        vscode.window.showInformationMessage(
          `Switched to network: ${treeItem.label}`
        );
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "fabric-network.deleteNetwork",
      (treeItem) => {
        const channelName = treeItem.label;

        vscode.window
          .showWarningMessage(
            `Are you sure you want to delete the channel "${channelName}"? This action cannot be undone.`,
            { modal: true },
            "Delete"
          )
          .then((confirmation) => {
            if (confirmation === "Delete") {
              treeViewProviderFabric.deleteNetwork(channelName);
              treeViewProviderDesc.deleteNetwork(channelName);

              treeViewProviderWallet.deleteWalletsForNetwork(channelName);

              vscode.window.showInformationMessage(
                `Channel "${channelName}" has been deleted.`
              );
            }
          });
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("fabricDebugger.openFilePicker", () => {
      vscode.window
        .showOpenDialog({
          canSelectFiles: true,
          canSelectMany: false,
          filters: {
            "JSON files": ["json"],
            "All files": ["*"],
          },
        })
        .then((fileUri) => {
          if (fileUri && fileUri[0]) {
            const filePath = fileUri[0].fsPath;
            fs.readFile(filePath, "utf8", (err, fileContents) => {
              if (err) {
                vscode.window.showErrorMessage("Error reading the file");
                console.error(err);
                return;
              }
              try {
                const parsedData = JSON.parse(fileContents);
                vscode.window.showInformationMessage(
                  "Network loaded successfully"
                );

                const wallets = extractWalletsFromProfile(parsedData);
                if (wallets.length > 0) {
                  wallets.forEach((wallet) => {
                    treeViewProviderWallet.addWallet(wallet);
                  });
                } else {
                  vscode.window.showWarningMessage(
                    "No wallet found in Network. Upload wallet"
                  );
                }

                const networkDetails = extractNetworkDetails(parsedData);
                const networkData = {
                  channelName: parsedData.name,
                  networkDetails,
                };
                treeViewProviderDesc.addNetwork(networkData);
                treeViewProviderFabric.addNetwork(networkData);
              } catch (parseError) {
                vscode.window.showErrorMessage("Error parsing JSON file");
                console.error(parseError);
              }
            });
          } else {
            vscode.window.showErrorMessage("No file selected");
          }
        });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("connectionProfile.start", () => {
      console.log("connectionProfile.start command executed");
      createConnectionProfileWebview();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "extension.handleConnectionProfileData",
      (data) => {
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

            const wallets = extractWalletsFromProfile(connectionProfile);
            if (wallets.length > 0) {
              wallets.forEach((wallet) => {
                console.log("Adding Wallet from Network:", wallet);
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
            data.networkDetails = networkDetails;

            treeViewProviderDesc.addNetwork(data);
            treeViewProviderFabric.addNetwork(data);
          } catch (err) {
            console.error("Error reading the connection profile:", err);
            vscode.window.showErrorMessage(
              "Failed to read the connection profile."
            );
          }
        } else {
          vscode.window.showErrorMessage("connection profile.");
        }
      }
    )
  );

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
      if (orgData.adminPrivateKey && orgData.signedCert) {
        const wallet = {
          name: orgKey,
          mspId: orgData.mspid,
          certPath: orgData.signedCert.path,
          keyPath: orgData.adminPrivateKey.path,
          type: "X.509",
        };
        wallets.push(wallet);
      }
    });
  }
  return wallets;
}

function extractWalletDetails(walletData) {
  if (walletData && walletData.name && walletData.mspId && walletData.type) {
    return {
      name: walletData.name,
      mspId: walletData.mspId,
      type: walletData.type,
    };
  }
  return null;
}

function deactivate() { }

module.exports = {
  activate,
  deactivate,
};
