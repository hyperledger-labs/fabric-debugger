/**
 * @param {vscode.ExtensionContext} context
 */

const vscode = require("vscode");
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

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "extension.handleConnectionProfileData",
      (data) => {
        console.log("Connection data received", data);
        if (treeViewProvider) {
          treeViewProvider.addNetwork(data);
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "fabric-network.startNetwork",
      (treeItem) => {
        vscode.window.showInformationMessage(
          `Starting network: ${treeItem.label}`
        );
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "fabric-network.stopNetwork",
      (treeItem) => {
        vscode.window.showInformationMessage(
          `Stopping network: ${treeItem.label}`
        );
      }
    )
  );

  treeViewProvider = new TreeViewProvider();
  vscode.window.registerTreeDataProvider("fabric-network", treeViewProvider);

  const buttons = [1, 2, 3];
  buttons.forEach((num) => {
    const disposableButton = vscode.commands.registerCommand(
      `fabric-network.button${num}`,
      function () {
        vscode.window.showInformationMessage(`Network ${num} Selected!`);
        console.log(`Button ${num}`);
      }
    );
    context.subscriptions.push(disposableButton);
  });
}
function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
