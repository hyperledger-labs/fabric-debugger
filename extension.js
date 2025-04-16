/**
 * @param {vscode.ExtensionContext} context
 */
const vscode = require("vscode");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { exec } = require("child_process");
const fabricsamples = require("./src/fabricsamples");
const { Wallets } = require("fabric-network");
const { TreeViewProvider } = require("./src/admin/treeview");
const DelveDebugAdapterDescriptorFactory = require("./src/debugAdapter/delveDebugAdapterDescriptorFactory.js");
const {
  saveConnectionProfileToStorage,
  loadConnectionProfilesFromStorage,
} = require("./src/admin/storageUtility");
const {
  getLatestBlockNumber,
  connectToFabric,
  decodeBlock,
} = require("./src/blockReader/blockQueries.js");
const {
  BlockchainTreeDataProvider,
} = require("./src/blockReader/blockchainExplorer.js");
const { log } = require("console");
let loadedConnectionProfile = null;

function activate(context) {
  console.log("Activating Fabric Debugger extension...");

  const factory = new DelveDebugAdapterDescriptorFactory();
  context.subscriptions.push(
    vscode.debug.registerDebugAdapterDescriptorFactory("delve", factory)
  );
  context.subscriptions.push(factory);
  console.log("Fabric Debugger extension Registered");
  generateEnvFile();
  generateLaunchConfig();

  const fabricDebuggerPathNew = "C:\\Users\\chinm\\fabric-debugger";
  const fabricDebuggerPath = context.extensionPath;

  let greenButton = vscode.commands.registerCommand("myview.button1", () => {
    const platform = process.platform;
    let command;
    if (platform === "win32") {
      command = `cd "${fabricDebuggerPath}" && wsl bash local-networkup.sh`;
    } else {
      command = `cd "${fabricDebuggerPath}" && bash local-networkup.sh`;
    }

    exec(command, (err, stdout, stderr) => {
      if (err) {
        vscode.window.showErrorMessage(`Error: ${stderr}`);
        return;
      }
      console.log(`Output: ${stdout}`);
      vscode.window.showInformationMessage("network is up and running");
    });
  });

  let redButton = vscode.commands.registerCommand("myview.button2", () => {
    const platform = process.platform;

    let command;
    if (platform === "win32") {
      command = `cd "${fabricDebuggerPath}" && wsl bash local-networkdown.sh`;
    } else {
      command = `cd "${fabricDebuggerPath}" && bash local-networkdown.sh`;
    }

    exec(command, (err, stdout, stderr) => {
      if (err) {
        vscode.window.showErrorMessage(`Error: ${stderr}`);
        return;
      }
      console.log(`Output: ${stdout}`);
      vscode.window.showInformationMessage("network is down");
    });
  });

  context.subscriptions.push(greenButton);
  context.subscriptions.push(redButton);
  const outputChannel = vscode.window.createOutputChannel(
    "Chaincode Invocation"
  );
  let disposableExtractFunctions = vscode.commands.registerCommand(
    "extension.extractFunctions",
    function () {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showInformationMessage(
          "No active editor. Open a chaincode file."
        );
        return;
      }
      const filePath = editor.document.fileName;
      const text = editor.document.getText();
      let functions = [];

      if (isGoChaincodeFile(filePath)) {
        functions = extractGoFunctions(text);
      }

      const filteredFunctions = filterIntAndStringFunctions(functions);
      const uniqueFunctions = [...new Set(filteredFunctions)];
      storeFunctions(uniqueFunctions, context);

      vscode.window.showInformationMessage(
        `Extracted and stored ${uniqueFunctions.length} unique functions with int or string parameters.`
      );

      showStoredFunctions(context, outputChannel);
    }
  );

  context.subscriptions.push(disposableExtractFunctions);
  function isGoChaincodeFile(filePath) {
    return filePath.toLowerCase().endsWith(".go");
  }

  function extractGoFunctions(code) {
    const functionDetails = [];
    const regex =
      /func\s*\((\w+)\s+\*SmartContract\)\s*(\w+)\s*\((.*?)\)\s*(\w*)/g;
    let match;

    while ((match = regex.exec(code)) !== null) {
      const functionName = match[2];
      const params = match[3];
      functionDetails.push({ name: functionName, params });
    }

    return functionDetails;
  }

  function filterIntAndStringFunctions(functions) {
    return functions
      .filter((func) => /int|string/.test(func.params))
      .map((func) => `${func.name}(${func.params})`);
  }

  function storeFunctions(functions, context) {
    let storedFunctions = context.workspaceState.get("storedFunctions", []);
    storedFunctions = [...new Set([...storedFunctions, ...functions])];
    context.workspaceState.update("storedFunctions", storedFunctions);
  }

  function showStoredFunctions(context, outputChannel) {
    const storedFunctions = context.workspaceState.get("storedFunctions", []);

    vscode.window
      .showQuickPick(storedFunctions, {
        placeHolder: "Select a function to invoke",
        canPickMany: false,
      })
      .then((selectedFunction) => {
        if (selectedFunction) {
          vscode.window.showInformationMessage(`Selected: ${selectedFunction}`);
          promptForArgumentsSequentially(selectedFunction, outputChannel);
        }
      });
  }

  async function promptForArgumentsSequentially(
    selectedFunction,
    outputChannel
  ) {
    const functionPattern = /(\w+)\((.*)\)/;
    const match = functionPattern.exec(selectedFunction);

    if (!match) {
      vscode.window.showErrorMessage("Invalid function format.");
      return;
    }

    const functionName = match[1];
    const paramList = match[2].split(",").map((param) => param.trim());

    let argumentValues = [];

    for (let param of paramList) {
      if (/int/.test(param)) {
        const input = await vscode.window.showInputBox({
          prompt: `Enter an integer value for ${param}`,
        });
        const intValue = parseInt(input, 10);
        if (isNaN(intValue)) {
          vscode.window.showErrorMessage(`Invalid integer value for ${param}.`);
          return;
        }
        argumentValues.push(intValue);
      } else if (/string/.test(param)) {
        const input = await vscode.window.showInputBox({
          prompt: `Enter a string value for ${param}`,
        });
        if (!input) {
          vscode.window.showErrorMessage(`Invalid string value for ${param}.`);
          return;
        }
        argumentValues.push(`"${input}"`);
      }
    }

    const finalArgs = argumentValues.join(", ");
    outputChannel.show();
    outputChannel.appendLine(`Function: ${functionName}`);
    outputChannel.appendLine(`Arguments: ${finalArgs}`);

    vscode.window
      .showInformationMessage(
        `Arguments captured. Press "Invoke" to execute the command.`,
        "Invoke"
      )
      .then((selection) => {
        if (selection === "Invoke") {
          invokeChaincode(functionName, argumentValues);
        }
      });
  }

  const hyperledgerProvider = new fabricsamples();
  const treeViewProviderFabric = new TreeViewProvider(
    "fabric-network",
    context
  );
  const treeViewProviderDesc = new TreeViewProvider("network-desc", context);
  const treeViewProviderWallet = new TreeViewProvider("wallets", context);

  vscode.window.registerTreeDataProvider(
    "start-local-network",
    hyperledgerProvider
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

  const BlockchainProvider = new BlockchainTreeDataProvider();
  vscode.window.createTreeView("blockchainExplorer", {
    treeDataProvider: BlockchainProvider,
  });

  const loadProfilesAndWallets = async () => {
    try {
      const savedProfiles = await loadConnectionProfilesFromStorage(context);

      if (savedProfiles.length > 0) {
        loadedConnectionProfile = savedProfiles[0];
        // console.log("Loaded connection profile:", loadedConnectionProfile);
      } else {
        console.warn("No combined profiles found in storage.");
      }

      savedProfiles.forEach((profile) => {
        const networkDetails = extractNetworkDetails(profile);
        const networkData = {
          channelName: profile.name,
          networkDetails,
          walletDetails: profile.wallets || [],
        };

        treeViewProviderFabric.addNetwork(networkData);
        treeViewProviderDesc.addNetwork(networkData);

        if (profile.wallets && profile.wallets.length > 0) {
          treeViewProviderWallet.networkWalletMap.set(
            profile.name,
            profile.wallets
          );
          profile.wallets.forEach((wallet) => {
            treeViewProviderWallet.addWallet(wallet);
          });

          if (loadedConnectionProfile.name === profile.name) {
            const activeWallet = profile.wallets[0];
            if (activeWallet) {
              treeViewProviderWallet.setActiveWallet(activeWallet.name);
            } else {
              console.warn(
                `No wallet available to activate for network "${profile.name}".`
              );
            }
          }
        }
      });
    } catch (error) {
      vscode.window.showErrorMessage(
        "Error loading profiles with wallets from storage."
      );
      console.error("Error loading profiles and wallets from storage:", error);
    }
  };

  loadProfilesAndWallets().catch((error) => {
    console.error("Error loading profiles and wallets:", error);
  });

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "fabric-network.uploadNetwork",
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
                    treeViewProviderWallet.addWallet(wallet);
                  }
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
        if (descItem) {
          treeViewProviderDesc.setActiveNetwork(descItem);
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
        const storagePath = context.globalStorageUri.fsPath;
        const profilePath = path.join(
          storagePath,
          `${channelName}-connection.json`
        );

        const confirmation = await vscode.window.showWarningMessage(
          `Are you sure you want to delete the channel "${channelName}"? This action cannot be undone.`,
          { modal: true },
          "Delete"
        );

        if (confirmation === "Delete") {
          const wallets =
            treeViewProviderWallet.networkWalletMap.get(channelName) || [];

          if (wallets.length === 0) {
            vscode.window.showErrorMessage(
              `No wallets found for channel: ${channelName}`
            );
            return;
          }

          for (const wallet of wallets) {
            const walletId = wallet.name;

            if (walletId) {
              await treeViewProviderWallet.deleteWallet(walletId, context);
              const walletPath = path.join(
                storagePath,
                `${walletId}-connection.json`
              );

              try {
                if (fs.existsSync(walletPath)) {
                  await fs.promises.unlink(walletPath);
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

          if (fs.existsSync(profilePath)) {
            try {
              await fs.promises.unlink(profilePath);
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

        const fileContents = await fs.promises.readFile(
          fileUri[0].fsPath,
          "utf8"
        );
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
          (w) => w.name === walletDetails.name
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
        await associateWalletToConnectionProfile(context, walletDetails);
        loadedConnectionProfile = connectionProfile;

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
    vscode.commands.registerCommand("wallets.generateWallet", async () => {
      if (!treeViewProviderFabric || !treeViewProviderFabric.networks) {
        vscode.window.showErrorMessage("No networks available to pick.");
        return;
      }

      const connectionProfiles = Array.from(
        treeViewProviderFabric.networks.keys()
      );
      if (connectionProfiles.length === 0) {
        vscode.window.showWarningMessage(
          "No networks available to pick. Make sure networks are loaded."
        );
        return;
      }

      const selectedProfile = await vscode.window.showQuickPick(
        connectionProfiles,
        {
          placeHolder: "Select a connection profile for wallet generation",
        }
      );

      if (!selectedProfile) {
        vscode.window.showWarningMessage(
          "Wallet generation cancelled; no connection profile selected."
        );
        return;
      }

      await generateWallet(context, selectedProfile);
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
        treeViewProviderWallet.setActiveWallet(walletItem);
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
              treeViewProviderWallet.setActiveWallet(selectedWallet);
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
    vscode.commands.registerCommand(
      "wallets.deleteWallet",
      async (walletItem) => {
        const walletId = walletItem.label.split(" (")[0];
        let connectionProfileName = walletItem.connectionProfileName;

        if (!connectionProfileName) {
          const profiles = Array.from(treeViewProviderFabric.networks.keys());
          connectionProfileName = await vscode.window.showQuickPick(profiles, {
            placeHolder: `Select the network for wallet "${walletId}"`,
          });

          if (!connectionProfileName) {
            vscode.window.showErrorMessage(
              "No network selected; deletion canceled."
            );
            return;
          }
        }

        const confirmation = await vscode.window.showWarningMessage(
          `Are you sure you want to delete the wallet "${walletId}"?`,
          { modal: true },
          "Delete"
        );

        if (confirmation === "Delete") {
          const profilePath = path.join(
            context.globalStorageUri.fsPath,
            `${connectionProfileName}-connection.json`
          );

          try {
            const profileData = JSON.parse(
              await fs.promises.readFile(profilePath, "utf8")
            );
            profileData.wallets = profileData.wallets.filter(
              (wallet) => wallet.name !== walletId
            );
            await fs.promises.writeFile(
              profilePath,
              JSON.stringify(profileData, null, 2),
              "utf8"
            );

            treeViewProviderWallet.deleteWallet(walletId, context);
            vscode.window.showInformationMessage(
              `Wallet "${walletId}" deleted.`
            );
          } catch (error) {
            console.error(`Failed to delete wallet "${walletId}":`, error);
            vscode.window.showErrorMessage(
              `Failed to delete wallet "${walletId}".`
            );
          }
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("fabric-network.queryBlocks", async () => {
      if (!loadedConnectionProfile || !loadedConnectionProfile.name) {
        vscode.window.showErrorMessage("Connection profile not loaded.");
        return;
      }

      const connectionProfileName = loadedConnectionProfile.name;
      const walletDetails =
        treeViewProviderWallet.networkWalletMap.get(connectionProfileName) ||
        [];

      if (!walletDetails || walletDetails.length === 0) {
        vscode.window.showErrorMessage(
          "No wallets found. Please upload the wallets."
        );
        return;
      }

      try {
        const latestBlockNumber = await getLatestBlockNumber(
          loadedConnectionProfile,
          "mychannel"
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

        if (!numOfBlocksInput || isNaN(numOfBlocks) || numOfBlocks <= 0) {
          vscode.window.showErrorMessage(
            "Please enter a valid positive number."
          );
          return;
        }

        if (numOfBlocks > latestBlockNumber) {
          vscode.window.showErrorMessage(
            `Please enter a number less than or equal to the latest block number (${latestBlockNumber}).`
          );
          return;
        }

        let decodedBlocks = [];

        for (let i = 0; i < numOfBlocks; i++) {
          const blockNumber = latestBlockNumber - i;
          const rawBlockData = await connectToFabric(
            loadedConnectionProfile,
            blockNumber,
            "mychannel"
          );

          if (rawBlockData) {
            try {
              const decodedBlock = await decodeBlock(rawBlockData);

              decodedBlocks.push(decodedBlock);
            } catch (decodeError) {
              vscode.window.showErrorMessage(
                `Error decoding block ${blockNumber}: ${decodeError.message}`
              );
              console.error("Error decoding block:", decodeError);
            }
          } else {
            vscode.window.showErrorMessage(`Block ${blockNumber} not found.`);
          }
        }

        BlockchainProvider.refresh(decodedBlocks);
      } catch (error) {
        vscode.window.showErrorMessage(`Error: ${error.message}`);
        console.error("Error during block query:", error);
      }
    })
  );

  context.subscriptions.push(
    vscode.debug.onDidStartDebugSession((session) => {
      console.log(`Debugging started: ${session.name}`);
      vscode.window.showInformationMessage(
        `Debugging started: ${session.name}`
      );
    })
  );

  context.subscriptions.push(
    vscode.debug.onDidTerminateDebugSession((session) => {
      console.log(`Debugging terminated: ${session.name}`);
      vscode.window.showInformationMessage(
        `Debugging terminated: ${session.name}`
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("chaincode.Packagechaincode", async () => {
      try {
        vscode.window.showInformationMessage("Packaging chaincode");

        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showErrorMessage(
            "No active editor with chaincode file."
          );
          return;
        }
        const chaincodePath = path.dirname(editor.document.fileName);

        const packager = new BasePackager();
        const packageBuffer = await packager.package(chaincodePath, "go");
        const outputPath = path.join(chaincodePath, "chaincode.tar.gz");
        fs.writeFileSync(outputPath, packageBuffer);

        vscode.window.showInformationMessage(
          `Chaincode packaged successfully at: ${outputPath}`
        );
      } catch (error) {
        vscode.window.showErrorMessage(
          `Error packaging chaincode: ${error.message}`
        );
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("chaincode.Installchaincode", async () => {
      try {
        vscode.window.showInformationMessage("Installing chaincode");

        const ccpPath = await vscode.window.showOpenDialog({
          canSelectFiles: true,
          canSelectMany: false,
          filters: { JSON: ["json"] },
          openLabel: "Select Connection Profile",
        });

        if (!ccpPath || ccpPath.length === 0) {
          vscode.window.showErrorMessage("No connection profile selected.");
          return;
        }

        const ccp = JSON.parse(fs.readFileSync(ccpPath[0].fsPath, "utf8"));
        const walletPath = path.join(__dirname, "..", "wallet");
        const wallet = await Wallets.newFileSystemWallet(walletPath);

        const gateway = new Gateway();
        await gateway.connect(ccp, {
          wallet,
          identity: "admin",
          discovery: { enabled: true, asLocalhost: true },
        });

        const client = gateway.getClient();
        const peers = Object.keys(ccp.peers || {});

        const chaincodePackagePath = await vscode.window.showOpenDialog({
          canSelectFiles: true,
          canSelectMany: false,
          filters: { TAR: ["gz"] },
          openLabel: "Select Chaincode Package",
        });

        if (!chaincodePackagePath || chaincodePackagePath.length === 0) {
          vscode.window.showErrorMessage("No chaincode package selected.");
          return;
        }

        const packageBuffer = fs.readFileSync(chaincodePackagePath[0].fsPath);

        for (const peer of peers) {
          const installRequest = {
            targets: [client.getPeer(peer)],
            chaincodePackage: packageBuffer,
          };

          const response = await client.installChaincode(installRequest);
          if (response && response[0]?.response?.status === 200) {
            vscode.window.showInformationMessage(
              `Chaincode installed on peer: ${peer}`
            );
          } else {
            vscode.window.showErrorMessage(
              `Failed to install chaincode on peer: ${peer}`
            );
          }
        }

        gateway.disconnect();
      } catch (error) {
        vscode.window.showErrorMessage(
          `Error installing chaincode: ${error.message}`
        );
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("chaincode.Approvechaincode", async () => {
      try {
        vscode.window.showInformationMessage(
          "Approving chaincode definition..."
        );

        const ccpPath = await vscode.window.showOpenDialog({
          canSelectFiles: true,
          canSelectMany: false,
          filters: { JSON: ["json"] },
          openLabel: "Select Connection Profile",
        });

        if (!ccpPath || ccpPath.length === 0) {
          vscode.window.showErrorMessage("No connection profile selected.");
          return;
        }

        const ccp = JSON.parse(fs.readFileSync(ccpPath[0].fsPath, "utf8"));
        const walletPath = path.join(__dirname, "..", "wallet");
        const wallet = await Wallets.newFileSystemWallet(walletPath);

        const gateway = new Gateway();
        await gateway.connect(ccp, {
          wallet,
          identity: "admin",
          discovery: { enabled: true, asLocalhost: true },
        });

        const network = await gateway.getNetwork("mychannel");
        const contract = network.getContract("lscc");

        const approveRequest = {
          chaincodeName: "mychaincode",
          chaincodeVersion: "1.0",
          sequence: 1,
          chaincodePackageId: "<PACKAGE_ID>", // Replace with actual Package ID from install
        };

        await contract.submitTransaction(
          "approveChaincodeDefinitionForMyOrg",
          JSON.stringify(approveRequest)
        );

        vscode.window.showInformationMessage(
          "Chaincode definition approved successfully."
        );
        gateway.disconnect();
      } catch (error) {
        vscode.window.showErrorMessage(
          `Error approving chaincode: ${error.message}`
        );
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("chaincode.Commitchaincode", async () => {
      try {
        vscode.window.showInformationMessage(
          "Committing chaincode definition..."
        );

        const ccpPath = await vscode.window.showOpenDialog({
          canSelectFiles: true,
          canSelectMany: false,
          filters: { JSON: ["json"] },
          openLabel: "Select Connection Profile",
        });

        if (!ccpPath || ccpPath.length === 0) {
          vscode.window.showErrorMessage("No connection profile selected.");
          return;
        }

        const ccp = JSON.parse(fs.readFileSync(ccpPath[0].fsPath, "utf8"));
        const walletPath = path.join(__dirname, "..", "wallet");
        const wallet = await Wallets.newFileSystemWallet(walletPath);

        const gateway = new Gateway();
        await gateway.connect(ccp, {
          wallet,
          identity: "admin",
          discovery: { enabled: true, asLocalhost: true },
        });

        const network = await gateway.getNetwork("mychannel");
        const contract = network.getContract("lscc");

        const commitRequest = {
          chaincodeName: "mychaincode",
          chaincodeVersion: "1.0",
          sequence: 1,
          endorsementPolicy: "", // Add your endorsement policy if needed
        };

        await contract.submitTransaction(
          "commitChaincodeDefinition",
          JSON.stringify(commitRequest)
        );

        vscode.window.showInformationMessage(
          "Chaincode definition committed successfully."
        );
        gateway.disconnect();
      } catch (error) {
        vscode.window.showErrorMessage(
          `Error committing chaincode: ${error.message}`
        );
      }
    })
  );

  async function generateWallet(context, connectionProfileName) {
    try {
      const connectionProfile = loadedConnectionProfile;

      if (!connectionProfile) {
        vscode.window.showErrorMessage(
          `Connection profile "${connectionProfileName}" not found or not loaded.`
        );
        return;
      }

      let mspId;
      if (connectionProfile.organizations) {
        const organizationEntries = Object.entries(
          connectionProfile.organizations
        );
        if (organizationEntries.length > 0) {
          const [orgName, orgDetails] = organizationEntries[0];
          console.log(`Processing organization: ${orgName}`, orgDetails);
          mspId = orgDetails.mspid;
        }
      }

      if (!mspId) {
        vscode.window.showErrorMessage(
          `MSP ID not found in the loaded connection profile for "${connectionProfileName}".`
        );
        return;
      }
      const certUri = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectMany: false,
        filters: { "PEM Certificate Files": ["pem"] },
      });

      if (!certUri || !certUri[0]) {
        vscode.window.showWarningMessage("No certificate file selected.");
        return;
      }
      const certPath = certUri[0].fsPath;

      const keyUri = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectMany: false,
        filters: { "Private Key Files": ["*"] },
      });

      if (!keyUri || !keyUri[0]) {
        vscode.window.showWarningMessage("No private key file selected.");
        return;
      }
      const privKeyPath = keyUri[0].fsPath;

      const walletPath = path.join(os.homedir(), "wallets");
      await fs.promises.mkdir(walletPath, { recursive: true });
      const wallet = await Wallets.newFileSystemWallet(walletPath);
      const certificate = await fs.promises.readFile(certPath, "utf8");
      const privateKey = await fs.promises.readFile(privKeyPath, "utf8");

      const identityName = connectionProfileName;
      const identity = {
        name: identityName,
        credentials: { certificate, privateKey },
        mspId,
        type: "X.509",
        version: 1,
      };

      const walletFilePath = path.join(
        walletPath,
        `${connectionProfileName}.json`
      );
      const identityJson = JSON.stringify(identity, null, 2);

      await fs.promises.writeFile(walletFilePath, identityJson, "utf8");
      vscode.window.showInformationMessage(
        `Wallet saved as JSON file at: ${walletFilePath}`
      );

      await wallet.put(identityName, {
        credentials: identity.credentials,
        mspId: identity.mspId,
        type: identity.type,
      });

      if (!connectionProfile.wallets) {
        connectionProfile.wallets = [];
      }

      connectionProfile.wallets.push({
        name: identityName,
        mspId,
        type: identity.type,
        credentials: { certificate, privateKey },
        version: identity.version,
      });
    } catch (error) {
      vscode.window.showErrorMessage(
        `Error generating wallet: ${error.message}`
      );
      console.error("Error generating wallet:", error);
    }
  }

  async function associateWalletToConnectionProfile(context, wallet) {
    if (!loadedConnectionProfile) {
      vscode.window.showErrorMessage("No connection profile loaded.");
      return;
    }

    if (!loadedConnectionProfile.wallets) {
      loadedConnectionProfile.wallets = [];
    }

    const existingWallet = loadedConnectionProfile.wallets.find(
      (w) => w.name === wallet.name
    );

    if (!existingWallet) {
      loadedConnectionProfile.wallets.push(wallet);

      try {
        await saveConnectionProfileToStorage(context, loadedConnectionProfile);
        vscode.window.showInformationMessage(
          `Wallet "${wallet.name}" associated with connection profile "${loadedConnectionProfile.label}".`
        );
      } catch (error) {
        vscode.window.showErrorMessage(
          "Failed to save the updated connection profile."
        );
      }
    }
  }
  async function invokeChaincode(functionName, args) {
    try {
      const walletPath = path.join(os.homedir(), "wallets");
      const wallet = await Wallets.newFileSystemWallet(walletPath);

      if (!loadedConnectionProfile) {
        vscode.window.showErrorMessage("No connection profile loaded.");
        return;
      }

      const identities = await wallet.list();
      if (!identities.length) {
        vscode.window.showErrorMessage("No identities found in the wallet.");
        return;
      }

      const identityName = identities[0];
      const gateway = new Gateway();

      await gateway.connect(loadedConnectionProfile, {
        wallet,
        identity: identityName,
        discovery: { enabled: true, asLocalhost: false },
      });

      const channelName = Object.keys(
        loadedConnectionProfile.channels || {}
      )[0];
      if (!channelName) {
        vscode.window.showErrorMessage(
          "No channel found in the connection profile."
        );
        return;
      }

      const chaincodes =
        loadedConnectionProfile.channels[channelName]?.chaincodes || [];
      if (!chaincodes.length) {
        vscode.window.showErrorMessage(
          `No chaincodes found for channel "${channelName}".`
        );
        return;
      }

      const chaincodeName = chaincodes[0];
      const network = await gateway.getNetwork(channelName);
      const contract = network.getContract(chaincodeName);

      const result = await contract.submitTransaction(functionName, ...args);
      vscode.window.showInformationMessage(
        `Transaction invoked successfully. Result: ${result.toString()}`
      );
      console.log("Transaction result:", result.toString());

      await gateway.disconnect();
    } catch (error) {
      vscode.window.showErrorMessage(
        `Error invoking chaincode: ${error.message}`
      );
      console.error("Error invoking chaincode:", error);
    }
  }
}

async function generateEnvFile() {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showErrorMessage("No workspace found.");
    return;
  }

  const workspacePath = workspaceFolders[0].uri.fsPath;
  const envFilePath = path.join(workspacePath, "chaincode.env");

  if (fs.existsSync(envFilePath)) {
    vscode.window.showInformationMessage("chaincode.env already exists.");
    return;
  }

  const defaultEnvContent = `CHAINCODE_SERVER_ADDRESS=localhost:9999
CHAINCODE_ID=
CHAINCODE_TLS_DISABLED=false
CHAINCODE_TLS_CERT=
CHAINCODE_TLS_KEY=
CHAINCODE_CLIENT_CA_CERT=
CORE_PEER_ADDRESS=`;

  try {
    fs.writeFileSync(envFilePath, defaultEnvContent);
    vscode.window.showInformationMessage(
      "chaincode.env file generated successfully."
    );
  } catch (error) {
    console.error("Error generating chaincode.env:", error);
    vscode.window.showErrorMessage(
      `Failed to create chaincode.env: ${error.message}`
    );
  }
}

async function generateLaunchConfig() {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showErrorMessage("No workspace found.");
    return;
  }

  const workspacePath = workspaceFolders[0].uri.fsPath;
  const launchJsonPath = path.join(workspacePath, ".vscode", "launch.json");
  const envFilePath = path.join(workspacePath, "chaincode.env");

  function readEnvConfig() {
    const defaultConfig = {
      chaincodeServerAddress: "localhost:9999",
      chaincodeId: "",
      tlsEnabled: false,
      tlsCertFile: "",
      tlsKeyFile: "",
      tlsRootCertFile: "",
      peerAddress: "",
    };

    if (!fs.existsSync(envFilePath)) {
      vscode.window.showWarningMessage(
        "chaincode.env not found. Using default configuration."
      );
      return defaultConfig;
    }

    try {
      const envContent = fs.readFileSync(envFilePath, "utf8").trim();
      const envConfig = { ...defaultConfig };

      // Split into lines, ignoring empty ones
      const envLines = envContent
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"));

      for (const line of envLines) {
        // Ensure we only split at the first "="
        const [key, ...valueParts] = line.split("=");
        if (!key || valueParts.length === 0) continue;

        const keyTrimmed = key.trim();
        const valueTrimmed = valueParts.join("=").trim();
        // Join back in case value had `=` in it

        switch (keyTrimmed) {
          case "CHAINCODE_SERVER_ADDRESS":
            envConfig.chaincodeServerAddress = valueTrimmed;
            break;
          case "CHAINCODE_ID":
            envConfig.chaincodeId = valueTrimmed;
            break;
          case "CHAINCODE_TLS_DISABLED":
            envConfig.tlsEnabled = valueTrimmed.toLowerCase() === "true";
            break;
          case "CHAINCODE_TLS_CERT":
            envConfig.tlsCertFile = valueTrimmed;
            break;
          case "CHAINCODE_TLS_KEY":
            envConfig.tlsKeyFile = valueTrimmed;
            break;
          case "CHAINCODE_CLIENT_CA_CERT":
            envConfig.tlsRootCertFile = valueTrimmed;
            break;
          case "CORE_PEER_ADDRESS":
            envConfig.peerAddress = valueTrimmed;
            break;

          default:
            console.warn(`Ignoring unrecognized key: ${keyTrimmed}`);
        }
      }

      if (!envConfig.chaincodeId) {
        vscode.window.showWarningMessage(
          "Warning: CHAINCODE_ID not found in chaincode.env"
        );
      }

      return envConfig;
    } catch (error) {
      console.error("Error reading env file:", error);
      vscode.window.showErrorMessage(
        `Error reading chaincode.env: ${error.message}`
      );
      return defaultConfig;
    }
  }

  async function findChaincodeEntryPoint(workspacePath) {
    const options = {
      canSelectMany: false,
      openLabel: "Select Chaincode Entry Point",
      filters: {
        Go: ["go"],
      },
    };

    const fileUri = await vscode.window.showOpenDialog(options);
    if (!fileUri || fileUri.length === 0) {
      throw new Error("No chaincode file selected.");
    }

    let selectedPath = fileUri[0].fsPath;
    if (selectedPath.startsWith(workspacePath)) {
      selectedPath =
        "${workspaceFolder}" + selectedPath.substring(workspacePath.length);
    }

    return selectedPath;
  }

  async function updateLaunchConfig() {
    try {
      const envConfig = readEnvConfig();
      const programPath = await findChaincodeEntryPoint(workspacePath);
      const launchConfig = {
        version: "0.2.0",
        configurations: [
          {
            name: "Hyperledger Fabric Debugger",
            type: "delve",
            request: "launch",
            mode: "debug",
            program: programPath,
            env: {
              CHAINCODE_SERVER_ADDRESS: envConfig.chaincodeServerAddress,
              CHAINCODE_ID: envConfig.chaincodeId,
              CHAINCODE_TLS_DISABLED: envConfig.tlsEnabled.toString(),
              ...(envConfig.tlsEnabled && {
                CHAINCODE_TLS_CERT: envConfig.tlsCertFile,
                CHAINCODE_TLS_KEY: envConfig.tlsKeyFile,
                CHAINCODE_CLIENT_CA_CERT: envConfig.tlsRootCertFile,
              }),
            },
            args: envConfig.peerAddress
              ? [`--peer.address=${envConfig.peerAddress}`]
              : [],
            port: 2345,
          },
        ],
      };

      fs.mkdirSync(path.dirname(launchJsonPath), { recursive: true });

      fs.writeFileSync(launchJsonPath, JSON.stringify(launchConfig, null, 2));
      vscode.window.showInformationMessage(
        "launch.json updated for Fabric chaincode debugging."
      );
    } catch (error) {
      console.error("Error updating launch config:", error);
      vscode.window.showErrorMessage(
        `Failed to update launch configuration: ${error.message}`
      );
    }
  }

  await updateLaunchConfig();

  if (fs.existsSync(envFilePath)) {
    let restartTimeout;
    fs.watch(envFilePath, (eventType) => {
      if (eventType === "change") {
        vscode.window.showInformationMessage(
          "Detected changes in chaincode.env. Updating debug configurations..."
        );

        clearTimeout(restartTimeout);
        restartTimeout = setTimeout(() => {
          updateLaunchConfig().then(() => {
            vscode.commands.executeCommand("workbench.action.debug.stop");
            setTimeout(() => {
              vscode.commands.executeCommand("workbench.action.debug.start");
            }, 1000);
          });
        }, 1500);
      }
    });
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
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
