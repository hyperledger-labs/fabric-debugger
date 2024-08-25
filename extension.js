/**
 * @param {vscode.ExtensionContext} context
 */

const vscode = require("vscode");
const fs = require("fs");
const { TreeViewProvider } = require("./src/treeview");
const { createConnectionProfileWebview } = require("./src/webview");

let treeViewProvider;

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand("connectionProfile.start", () => {
      console.log("connectionProfile.start command executed");
      createConnectionProfileWebview();
    })
  );

  const treeViewProvider = new TreeViewProvider();
  vscode.window.registerTreeDataProvider("fabric-network", treeViewProvider);

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "extension.handleConnectionProfileData",
      (data) => {
        const connectionProfilePath = data.connectionProfilePath;
        console.log("Connection Profile Path:", connectionProfilePath);

        // Ensure the path exists
        if (fs.existsSync(connectionProfilePath)) {
          // First, check if the path is a directory
          if (fs.statSync(connectionProfilePath).isDirectory()) {
            console.error(
              "Error: The provided path is a directory, not a file."
            );
            vscode.window.showErrorMessage(
              "Error: The provided path is a directory, not a file."
            );
            return;
          }

          // If not a directory, proceed to read the file
          try {
            const connectionProfile = JSON.parse(
              fs.readFileSync(connectionProfilePath, "utf8")
            );
            const networkDetails = extractNetworkDetails(connectionProfile);
            data.networkDetails = networkDetails;

            treeViewProvider.addNetwork(data);
          } catch (err) {
            console.error("Error reading the connection profile:", err);
            vscode.window.showErrorMessage(
              "Failed to read the connection profile."
            );
          }
        } else {
          vscode.window.showErrorMessage("Connection profile not found.");
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "fabric-network.startNetwork",
      (treeItem) => {
        if (treeItem && treeItem.label) {
          console.log(`Starting network: ${treeItem.label}`);
          vscode.window.showInformationMessage(
            `Starting network: ${treeItem.label}`
          );
          // Add your logic to start the network here
        } else {
          console.error(
            "Start network command triggered without a valid treeItem."
          );
          vscode.window.showErrorMessage(
            "Failed to start network: Invalid network selection."
          );
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "fabric-network.stopNetwork",
      (treeItem) => {
        if (treeItem && treeItem.label) {
          console.log(`Stopping network: ${treeItem.label}`);
          vscode.window.showInformationMessage(
            `Stopping network: ${treeItem.label}`
          );
          // Add your logic to stop the network here
        } else {
          console.error(
            "Stop network command triggered without a valid treeItem."
          );
          vscode.window.showErrorMessage(
            "Failed to stop network: Invalid network selection."
          );
        }
      }
    )
  );

  // Registers network buttons
  //   const buttons = [1, 2, 3];
  //   buttons.forEach((num) => {
  //     const disposableButton = vscode.commands.registerCommand(
  //       `fabric-network.button${num}`,
  //       function () {
  //         vscode.window.showInformationMessage(`Network ${num} Selected!`);
  //         console.log(`Button ${num}`);
  //       }
  //     );
  //     context.subscriptions.push(disposableButton);
  //   });
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

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
