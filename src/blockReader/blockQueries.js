const vscode = require("vscode");
const { Gateway } = require("fabric-network");
const fs = require("fs");

function extractCredentials(loadedConnectionProfile) {
  if (!loadedConnectionProfile) {
    throw new Error("Loaded connection profile is undefined.");
  }

  const wallets = loadedConnectionProfile.wallets;
  console.log("Loaded Wallets from connection profile:", wallets);

  if (!wallets || wallets.length === 0) {
    throw new Error("Invalid connection profile: No wallets found.");
  }
  const credentials = wallets.map((wallet) => {
    const { certificate, privateKey, mspId } = wallet;

    if (!certificate || !privateKey || !mspId) {
      throw new Error("Missing data for wallet: " + JSON.stringify(wallet));
    }

    return { certificate, privateKey, mspId, name: wallet.name };
  });

  console.log("Extracted Credentials:", credentials);
  return credentials;
}

async function connectToFabric(
  loadedConnectionProfile,
  blockNumber,
  channelName = "mychannel",
  contractName = "qscc"
) {
  let gateway;

  try {
    if (!loadedConnectionProfile || !loadedConnectionProfile.name) {
      vscode.window.showErrorMessage(
        "Connection profile not loaded from connectToFabric"
      );
      return;
    }

    const ccp = loadedConnectionProfile;
    const wallets = extractWalletDetails(ccp);
    console.log("Extracted Wallets:", wallets);
    if (wallets.length === 0) {
      throw new Error("No wallets found in connection profile.");
    }

    const credentials = await extractCredentials(loadedConnectionProfile);
    const { certificate, privateKey, mspId } = credentials[0];

    gateway = new Gateway();
    await gateway.connect(loadedConnectionProfile, {
      wallet: wallets[0],
      identity: credentials[0].name,
      discovery: { enabled: true, asLocalhost: true },
    });
    console.log("Connected to the gateway successfully.");

    const network = await gateway.getNetwork(channelName);
    const contract = network.getContract(contractName);
    const blockData = await contract.evaluateTransaction(
      "GetBlockByNumber",
      blockNumber
    );

    return JSON.parse(blockData.toString());
  } catch (error) {
    console.error("Error querying block:", error);
    vscode.window.showErrorMessage(`Failed to query block: ${error.message}`);
  } finally {
    if (gateway) {
      await gateway.disconnect().catch((err) => {
        console.log("Disconnected from the gateway.");
      });
    }
  }
}

async function getLatestBlockNumber(loadedConnectionProfile, walletDetails) {
  console.log("Wallets passed to getLatestBlockNumber:", walletDetails);
  console.log(
    "Connection Profile at getLatestBlockNumber:",
    loadedConnectionProfile
  );

  if (!loadedConnectionProfile) {
    throw new Error(
      "Loaded connection profile is undefined. Cannot proceed with block query."
    );
  }

  console.log("Wallets passed to getLatestBlockNumber:", walletDetails);

  const credentials = await extractCredentials(loadedConnectionProfile);

  const gateway = new Gateway();

  try {
    const { certificate, privateKey, mspId } = credentials[0];

    await gateway.connect(loadedConnectionProfile, {
      wallet: extractWalletDetails(loadedConnectionProfile)[0],
      identity: credentials[0].name,
      discovery: { enabled: true, asLocalhost: true },
      eventHandlerOptions: {
        strategy: DefaultEventHandlerStrategies.MSPID_SCOPE_ANYFORTX,
      },
      queryHandlerOptions: {
        strategy: DefaultQueryHandlerStrategies.MSPID_SCOPE_SINGLE,
      },
    });

    const network = await gateway.getNetwork("mychannel");
    const contract = network.getContract("qscc");
    const result = await contract.evaluateTransaction(
      "GetChainInfo",
      "mychannel"
    );
    const chainInfo = JSON.parse(result.toString());
    const blockHeight = chainInfo.height.low;

    return blockHeight;
  } catch (error) {
    console.error("Error getting the latest block number:", error);
    throw new Error("Failed to retrieve latest block number.");
  } finally {
    await gateway.disconnect();
  }
}

module.exports = { getLatestBlockNumber, connectToFabric };
