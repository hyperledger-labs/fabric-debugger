/**
 * @param {vscode.ExtensionContext} context
 */

const vscode = require("vscode");
const fs = require("fs");
const { TreeViewProvider } = require("./src/treeview");
const { createConnectionProfileWebview } = require("./src/webview");

let treeViewProviderDesc;
let treeViewProviderFabric;

function activate(context) {
  treeViewProviderDesc = new TreeViewProvider("network-desc", context);
  treeViewProviderFabric = new TreeViewProvider("fabric-network", context);

  vscode.window.registerTreeDataProvider(
    "fabric-network",
    treeViewProviderFabric
  );
  vscode.window.registerTreeDataProvider("network-desc", treeViewProviderDesc);

  // Command to switch network
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

  // Load stored data
  const storedNetworks = context.globalState.get("networks", []);
  storedNetworks.forEach((data) => {
    treeViewProviderDesc.addNetwork(data);
    treeViewProviderFabric.addNetwork(data);
  });

  //Registering file picker option
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
            vscode.window.showInformationMessage(`Selected file: ${filePath}`);
            fs.readFile(filePath, "utf8", (err, fileContents) => {
              if (err) {
                vscode.window.showErrorMessage("Error reading the file");
                console.error(err);
                return;
              }

              try {
                const parsedData = JSON.parse(fileContents);
                vscode.window.showInformationMessage(
                  "File loaded successfully"
                );
                console.log(parsedData);
                const networkDetails = extractNetworkDetails(parsedData);
                const networkData = {
                  channelName: parsedData.name,
                  networkDetails,
                };

                treeViewProviderDesc.addNetwork(networkData);
                treeViewProviderFabric.addNetwork(networkData);

                const currentNetworks = context.globalState.get("networks", []);
                context.globalState.update("networks", [
                  ...currentNetworks,
                  networkData,
                ]);
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
        console.log("Connection Profile Path:", connectionProfilePath);

        if (fs.existsSync(connectionProfilePath)) {
          if (fs.statSync(connectionProfilePath).isDirectory()) {
            console.error(
              "Error: The provided path is a directory, not a file."
            );
            vscode.window.showErrorMessage(
              "Error: The provided path is a directory, not a file."
            );
            return;
          }
          try {
            const connectionProfile = JSON.parse(
              fs.readFileSync(connectionProfilePath, "utf8")
            );
            const networkDetails = extractNetworkDetails(connectionProfile);
            data.networkDetails = networkDetails;

            //Adds data to fabric network and network desc
            treeViewProviderDesc.addNetwork(data);
            treeViewProviderFabric.addNetwork(data);

            //Makes data persist
            const currentNetworks = context.globalState.get("networks", []);
            context.globalState.update("networks", [...currentNetworks, data]);
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

  // Delete command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "fabricNetwork.deleteChannel",
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

              const currentNetworks = context.globalState.get("networks", []);
              const updatedNetworks = currentNetworks.filter(
                (net) => net.channelName !== channelName
              );
              context.globalState.update("networks", updatedNetworks);

              vscode.window.showInformationMessage(
                `Channel "${channelName}" has been deleted.`
              );
            }
          });
      }
    )
  );
}

//extracting data fro treeview
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
