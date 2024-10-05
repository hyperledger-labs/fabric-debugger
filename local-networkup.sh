#!/bin/bash
if [ ! -d ".hidden/fabric-samples" ]; then
    curl -sSLO https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/install-fabric.sh -o .hidden/install-fabric.sh && chmod +x .hidden/install-fabric.sh
    # Clone into the hidden directory
    git clone https://github.com/hyperledger/fabric-samples.git ".hidden/fabric-samples"

    # Run the install script
    .hidden/install-fabric.sh docker samples binary
fi
cd .hidden/fabric-samples/test-network
./network.sh up

