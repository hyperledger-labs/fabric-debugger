const vscode = require("vscode");
const {
  Wallets,
  Gateway,
  DefaultQueryHandlerStrategies,
} = require("fabric-network");
const fs = require("fs");

function extractCredentials(loadedConnectionProfile) {
  if (!loadedConnectionProfile) {
    throw new Error("Loaded connection profile is undefined.");
  }

  const wallets = loadedConnectionProfile.wallets || [];
  console.log("Loaded Wallets from connection profile:", wallets);

  if (!wallets || wallets.length === 0) {
    throw new Error("Invalid connection profile: No wallets found.");
  }

  const credentials = wallets.map((wallet, index) => {
    console.log(`Processing wallet #${index + 1}:`, wallet);

    const { certificate, privateKey, mspId, type = "X.509" } = wallet;

    if (!certificate || !privateKey || !mspId || !type) {
      console.error("Missing data for wallet:", wallet);
      throw new Error("Missing data for wallet: " + JSON.stringify(wallet));
    }

    return { certificate, privateKey, mspId, type, name: wallet.name };
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

  console.log(
    "Calling connectToFabric with channel:",
    channelName,
    "and contract:",
    contractName
  );

  console.log("Channel name:", channelName);
  console.log("Contract name:", contractName);

  try {
    console.log("Preparing to connect to Fabric gateway");
    console.log("Extracting credentials from connection profile...");
    const credentials = extractCredentials(loadedConnectionProfile);
    console.log("Credentials extracted:", credentials);

    const { certificate, privateKey, mspId, name } = credentials[0];

    console.log("Creating wallet with name:", name);
    const wallet = await Wallets.newInMemoryWallet();
    await wallet.put(name, {
      credentials: { certificate, privateKey },
      mspId,
      type: "X.509",
    });

    console.log(`Added identity to wallet: ${name}`);
    console.log("Connecting to Fabric gateway...");

    gateway = new Gateway();
    await gateway.connect(loadedConnectionProfile, {
      wallet,
      identity: name,
      discovery: { enabled: true, asLocalhost: true },
    });

    console.log("Successfully connected to the gateway.");
    console.log(`Getting network for channel: ${channelName}`);

    const network = await gateway.getNetwork(channelName);
    const contract = network.getContract(contractName);

    console.log(`Querying block number: ${blockNumber}`);
    const blockData = await contract.evaluateTransaction(
      "GetBlockByNumber",
      blockNumber.toString()
    );

    console.log("Block data retrieved successfully.");
    return JSON.parse(blockData.toString());
  } catch (error) {
    console.error("Error querying block:", error);
    vscode.window.showErrorMessage(`Failed to query block: ${error.message}`);
    throw error;
  } finally {
    if (gateway) {
      console.log("Disconnecting from the gateway...");
      await gateway.disconnect();
    }
  }
}

async function getLatestBlockNumber(loadedConnectionProfile) {
  let gateway;

  try {
    console.log("Starting to get the latest block number...");
    console.log("Connecting to the Fabric network...");

    const credentials = extractCredentials(loadedConnectionProfile);
    const { certificate, privateKey, mspId, name } = credentials[0];
    const wallet = await Wallets.newInMemoryWallet();
    await wallet.put(name, {
      credentials: { certificate, privateKey },
      mspId,
      type: "X.509",
    });
    console.log(`Added identity to wallet: ${name}`);

    gateway = new Gateway();
    await gateway.connect(loadedConnectionProfile, {
      wallet,
      identity: name,
      discovery: { enabled: true, asLocalhost: true },
      //discovery: { enabled: false },
      eventHandlerOptions: { strategy: "persistence" },
      logging: { level: "debug" },
    });
    console.log("Successfully connected to the Fabric gateway.");

    const network = await gateway.getNetwork("mychannel");
    const contract = network.getContract("qscc");
    const blockData = await contract.evaluateTransaction(
      "GetBlockByNumber",
      "0"
    );
    const latestBlock = JSON.parse(blockData.toString());
    console.log("Latest block data:", latestBlock);

    return latestBlock.header.number;
  } catch (error) {
    console.error("Error getting latest block number:", error);
    throw new Error("Failed to retrieve latest block number");
  } finally {
    if (gateway) {
      console.log("Disconnecting from Fabric gateway...");
      await gateway.disconnect();
    }
  }
}

module.exports = { getLatestBlockNumber, connectToFabric };
