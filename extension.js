/**
 * @param {vscode.ExtensionContext} context
 */

const vscode = require("vscode");
const fs = require("fs");
const { TreeViewProvider } = require("./src/treeview");
const { createConnectionProfileWebview } = require("./src/webview");
const simpleGit = require('simple-git');
const { exec } = require('child_process');
const path = require('path');
const os = require('os');
const fabricsamples = require('./src/fabricsamples');
const { Console } = require("console");
const outputChannel = vscode.window.createOutputChannel("Function Arguments Logger");

function activate(context) {
  const fabricDebuggerPath = 'C:\\Users\\Public\\fabric-debugger';

  let greenButton = vscode.commands.registerCommand('myview.button1', () => {
    const platform = process.platform;
    const scriptUpPath = path.join(fabricDebuggerPath, 'local-networkup.sh');
    // Command to execute based on the platform
    let command;
    if (platform === 'win32') {
      command = `wsl bash "${scriptUpPath}"`;
    } else {
      command = `bash "${scriptUpPath}"`;
    }

    exec(command, (err, stdout, stderr) => {
      if (err) {
        vscode.window.showErrorMessage(`Error: ${stderr}`);
        return;
      }
      vscode.window.showInformationMessage(`Output: ${stdout}`);
      console.log("network is up and running");
    });
  });

  // Command for the red button
  let redButton = vscode.commands.registerCommand('myview.button2', () => {
    const platform = process.platform;

    const scriptDownPath = path.join(fabricDebuggerPath, 'local-networkdown.sh');
    let command;
    if (platform === 'win32') {
      command = `wsl bash "${scriptDownPath}"`;
    } else {
      command = `bash "${scriptDownPath}"`;
    }

    // Execute the command
    exec(command, (err, stdout, stderr) => {
      if (err) {
        vscode.window.showErrorMessage(`Error: ${stderr}`);
        return;
      }
      vscode.window.showInformationMessage(`Output: ${stdout}`);
      console.log("network is down");
    });
  });

  context.subscriptions.push(greenButton);
  context.subscriptions.push(redButton);
  let disposable5 = vscode.commands.registerCommand('extension.extractFunctions', function () {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showInformationMessage('No active editor. Open a chaincode file.');
      return;
    }

    const filePath = editor.document.fileName;


    if (!isChaincodeFile(filePath)) {
      vscode.window.showInformationMessage('This is not a recognized Go or Java chaincode file.');
      return;
    }


    const text = editor.document.getText();
    let functions = [];

    if (isGoChaincodeFile(filePath)) {
      functions = extractGoFunctions(text);
    } else if (isJavaChaincodeFile(filePath)) {
      functions = extractJavaFunctions(text);
    }

    const filteredFunctions = filterIntAndStringFunctions(functions);
    const uniqueFunctions = [...new Set(filteredFunctions)];
    storeFunctions(uniqueFunctions, context);

    vscode.window.showInformationMessage(`Extracted and stored ${uniqueFunctions.length} unique functions with int or string parameters.`);


    showStoredFunctions(context, outputChannel);
  });

  context.subscriptions.push(disposable5);

  const hyperledgerProvider = new fabricsamples();
  vscode.window.registerTreeDataProvider('start-local-network', hyperledgerProvider);
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
function isChaincodeFile(filePath) {
  return isGoChaincodeFile(filePath) || isJavaChaincodeFile(filePath);
}

function isGoChaincodeFile(filePath) {
  const fileName = filePath.toLowerCase();
  return fileName.endsWith('.go');
}

function isJavaChaincodeFile(filePath) {
  const fileName = filePath.toLowerCase();
  return fileName.endsWith('.java');
}

function extractGoFunctions(code) {
  const functionDetails = [];


  const regex = /func\s*\((\w+)\s+\*SmartContract\)\s*(\w+)\s*\((.*?)\)\s*(\w*)/g;
  let match;

  while ((match = regex.exec(code)) !== null) {
    const functionName = match[2];
    const params = match[3];
    functionDetails.push({ name: functionName, params });
  }

  return functionDetails;
}

function extractJavaFunctions(code) {
  const functionDetails = [];


  const regex = /public\s+(\w+)\s+(\w+)\s*\((.*?)\)/g;
  let match;

  while ((match = regex.exec(code)) !== null) {
    const returnType = match[1];
    const functionName = match[2];
    const params = match[3];
    functionDetails.push({ name: functionName, params });
  }

  return functionDetails;
}

function filterIntAndStringFunctions(functions) {
  return functions.filter(func => /int|string/.test(func.params)).map(func => `${func.name}(${func.params})`);
}

function storeFunctions(functions, context) {
  let storedFunctions = context.workspaceState.get('storedFunctions', []);
  storedFunctions = [...new Set([...storedFunctions, ...functions])];
  context.workspaceState.update('storedFunctions', storedFunctions);
}

function showStoredFunctions(context, outputChannel) {
  const storedFunctions = context.workspaceState.get('storedFunctions', []);

  vscode.window.showQuickPick(storedFunctions, {
    placeHolder: 'Select a function to invoke',
    canPickMany: false
  }).then(selectedFunction => {
    if (selectedFunction) {
      vscode.window.showInformationMessage(`Selected: ${selectedFunction}`);
      promptForArgumentsSequentially(selectedFunction, outputChannel);
    }
  });
}

async function promptForArgumentsSequentially(selectedFunction, outputChannel) {
  const functionPattern = /(\w+)\((.*)\)/;
  const match = functionPattern.exec(selectedFunction);

  if (!match) {
    vscode.window.showErrorMessage("Invalid function format.");
    return;
  }

  const functionName = match[1];
  const paramList = match[2].split(',').map(param => param.trim());

  let argumentValues = [];


  for (let param of paramList) {
    if (/int/.test(param)) {
      const input = await vscode.window.showInputBox({ prompt: `Enter an integer value for ${param}` });
      const intValue = parseInt(input, 10);
      if (isNaN(intValue)) {
        vscode.window.showErrorMessage(`Invalid integer value for ${param}.`);
        return;
      }
      argumentValues.push(intValue);
    } else if (/string/.test(param)) {
      const input = await vscode.window.showInputBox({ prompt: `Enter a string value for ${param}` });
      if (!input) {
        vscode.window.showErrorMessage(`Invalid string value for ${param}.`);
        return;
      }
      argumentValues.push(`"${input}"`);
    }
  }


  const finalArgs = argumentValues.join(', ');
  outputChannel.show();
  outputChannel.appendLine(`Function: ${functionName}`);
  outputChannel.appendLine(`Arguments: ${finalArgs}`);

  showInvokeCommand(functionName, argumentValues);
}

function showInvokeCommand(functionName, argumentValues) {
  const invokeCommand = `peer chaincode invoke -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com --tls --cafile "${PWD}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem" -C mychannel -n basic --peerAddresses localhost:7051 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt" --peerAddresses localhost:9051 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt" -c '{"function":"${functionName}","Args":[${argumentValues.join(', ')}]}'`;

  vscode.window.showInformationMessage(`Invoke Command:\n${invokeCommand}`, 'Copy Command', 'Run Command').then(selection => {
    if (selection === 'Copy Command') {
      vscode.env.clipboard.writeText(invokeCommand);
      vscode.window.showInformationMessage('Command copied to clipboard.');
    } else if (selection === 'Run Command') {
      runInvokeCommand(invokeCommand);
    }
  });
}

function runInvokeCommand(command) {
  const terminal = vscode.window.createTerminal('Chaincode Invoke');
  terminal.show();
  terminal.sendText(command);
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
