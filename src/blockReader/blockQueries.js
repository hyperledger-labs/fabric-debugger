const vscode = require("vscode");
const { Gateway } = require("fabric-network");
const fs = require("fs");

let loadedConnectionProfile = null;

function extractCredentials(loadedConnectionProfile) {
  if (!loadedConnectionProfile) {
    throw new Error(
      "Loaded connection profile is undefined. Cannot extract credentials."
    );
  }

  console.log(
    "Loaded Connection Profile Structure:",
    JSON.stringify(loadedConnectionProfile, null, 2)
  );

  const wallets = loadedConnectionProfile.wallets;

  if (!wallets || wallets.length === 0) {
    throw new Error("Invalid connection profile: No wallets found.");
  }

  const wallet = wallets[0];
  const certificate = wallet.certificate;
  const privateKey = wallet.privateKey;
  const mspId = wallet.mspId;

  if (!certificate || !privateKey || !mspId) {
    throw new Error("Missing data for wallet.");
  }

  return { certificate, privateKey, mspId };
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
    const wallets = extractWalletsFromProfile(ccp);
    if (wallets.length === 0) {
      throw new Error("No wallets found in connection profile.");
    }

    const wallet = wallets[0];
    const { certificate, privateKey, mspId } = wallet;

    gateway = new Gateway();

    await gateway.connect(ccp, {
      identity: {
        credentials: {
          certificate: certificate,
          privateKey: privateKey,
        },
        mspId: mspId,
        type: "X.509",
      },
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

async function getLatestBlockNumber(loadedConnectionProfile) {
  console.log(
    "Connection Profile at getLatestBlockNumber:",
    loadedConnectionProfile
  );

  if (!loadedConnectionProfile) {
    throw new Error(
      "Loaded connection profile is undefined. Cannot proceed with block query."
    );
  }

  const credentials = extractCredentials(loadedConnectionProfile);
  const gateway = new Gateway();

  try {
    const { certificate, privateKey, mspId } = credentials;

    await gateway.connect(loadedConnectionProfile, {
      identity: {
        credentials: {
          certificate: certificate,
          privateKey: privateKey,
        },
        mspId: mspId,
        type: "X.509",
      },
      discovery: { enabled: true, asLocalhost: true },
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
