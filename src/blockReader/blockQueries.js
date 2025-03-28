const vscode = require("vscode");
const { Wallets, Gateway } = require("fabric-network");
const protobuf = require("protobufjs");

function extractCredentials(loadedConnectionProfile) {
  if (!loadedConnectionProfile) {
    throw new Error("Loaded connection profile is undefined.");
  }

  const wallets = loadedConnectionProfile.wallets || [];
  if (!wallets || wallets.length === 0) {
    throw new Error("Invalid connection profile: No wallets found.");
  }

  const credentials = wallets.map((wallet, index) => {
    const { certificate, privateKey, mspId, type = "X.509" } = wallet;
    if (!certificate || !privateKey || !mspId || !type) {
      console.error("Missing data for wallet:", wallet);
      throw new Error("Missing data for wallet: " + JSON.stringify(wallet));
    }

    return { certificate, privateKey, mspId, type, name: wallet.name };
  });

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
    const credentials = extractCredentials(loadedConnectionProfile);
    const { certificate, privateKey, mspId, name } = credentials[0];

    const wallet = await Wallets.newInMemoryWallet();
    await wallet.put(name, {
      credentials: { certificate, privateKey },
      mspId,
      type: "X.509",
    });

    gateway = new Gateway();
    await gateway.connect(loadedConnectionProfile, {
      wallet,
      identity: name,
      discovery: { enabled: true, asLocalhost: true },
    });

    const network = await gateway.getNetwork(channelName);
    const contract = network.getContract(contractName);
    const blockData = await contract.evaluateTransaction(
      "GetBlockByNumber",
      channelName,
      blockNumber.toString()
    );

    if (!Buffer.isBuffer(blockData)) {
      console.error("Error: Block data is not a Buffer:", blockData);
      throw new Error("Expected raw binary data (Buffer) for blockData.");
    }
    const decodedBlock = await decodeBlock(blockData);

    return decodedBlock;
  } catch (error) {
    console.error("Error querying block:", {
      message: error.message,
      stack: error.stack,
    });
    throw new Error(`Failed to query block: ${error.message}`);
  } finally {
    if (gateway) {
      await gateway.disconnect();
    }
  }
}

async function decodeBlock(blockData) {
  if (!blockData || typeof blockData !== "object") {
    console.error("decodeBlock error: Input is not a valid object.", blockData);
    throw new Error("Input to decodeBlock must be an object.");
  }

  if (blockData.header && blockData.data && blockData.metadata) {
    return blockData;
  }

  const root = await protobuf.load(
    "/Users/claudiaemmanuel/vscode/fabric-debugger/src/protos/block.proto"
    //modify this to the file location on your local computer
  );
  const Block = root.lookupType("common.Block");
  const message = Block.decode(blockData);

  return Block.toObject(message, {
    longs: String,
    enums: String,
    bytes: String,
    defaults: true,
  });
}

async function decodeChainInfo(binaryData) {
  const root = await protobuf.load(
    "/Users/claudiaemmanuel/vscode/fabric-debugger/src/protos/common.proto"
    //modify this to the file location on your local computer
  );
  const ChainInfo = root.lookupType("common.BlockchainInfo");
  const message = ChainInfo.decode(binaryData);
  const chainInfoObject = ChainInfo.toObject(message, {
    longs: String,
    defaults: true,
  });
  return chainInfoObject;
}

async function getLatestBlockNumber(
  loadedConnectionProfile,
  channelName = "mychannel"
) {
  let gateway;

  try {
    const credentials = extractCredentials(loadedConnectionProfile);
    const { certificate, privateKey, mspId, name } = credentials[0];
    const wallet = await Wallets.newInMemoryWallet();
    await wallet.put(name, {
      credentials: { certificate, privateKey },
      mspId,
      type: "X.509",
    });

    gateway = new Gateway();
    await gateway.connect(loadedConnectionProfile, {
      wallet,
      identity: name,
      discovery: { enabled: true, asLocalhost: true },
    });

    const network = await gateway.getNetwork(channelName);
    const contract = network.getContract("qscc");
    const chainInfoData = await contract.evaluateTransaction(
      "GetChainInfo",
      channelName
    );

    const decodedChainInfo = await decodeChainInfo(chainInfoData);
    const latestBlockNumber = parseInt(decodedChainInfo.height) - 1;
    return latestBlockNumber;
  } catch (error) {
    console.error("Error getting latest block number:", error);
    throw new Error("Failed to retrieve latest block number");
  } finally {
    if (gateway) {
      await gateway.disconnect();
    }
  }
}

module.exports = {
  connectToFabric,
  decodeBlock,
  getLatestBlockNumber,
};
