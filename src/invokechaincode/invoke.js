const { Gateway, Wallets } = require('fabric-network');
const FabricCAServices = require('fabric-ca-client');
const path = require('path');
const fs = require('fs');
const { log } = require('console');

async function invokeChaincode(functionName, args, context) {
    try {
        
        const ccpPath = path.resolve(__dirname, 'connection-profile.json');
        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));
        const wallet = await Wallets.newFileSystemWallet(path.join(process.cwd(), 'wallet'));     
        const gateway = new Gateway();
        await gateway.connect(ccp, {
            wallet,
            identity: 'admin',
            discovery: { enabled: true, asLocalhost: true }
        });

        
        const network = await gateway.getNetwork('mychannel');
        const contract = network.getContract('mychaincode');
       
        const result = await contract.submitTransaction('CreateAsset', 'asset1', '100');
        console.log(`Chaincode invoked successfully. Result: ${result.toString()}`);

        
        await gateway.disconnect();

        return result.toString();
    } catch (error) {
        console.error(`Failed to invoke chaincode: ${error.message}`);
        throw new Error(`Failed to invoke chaincode: ${error.message}`);
    }
}


invokeChaincode();
