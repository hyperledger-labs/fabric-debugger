#!/bin/bash
FABRIC_SAMPLES_PATH="${HOME}/go/src/github.com/urgetolearn/fabric-samples"
if [ -n "$FABRIC_SAMPLES_CUSTOM_PATH" ]; then
  FABRIC_SAMPLES_PATH="$FABRIC_SAMPLES_CUSTOM_PATH"
fi
if [ ! -d "$FABRIC_SAMPLES_PATH" ]; then
  echo "Error: Fabric samples directory not found at $FABRIC_SAMPLES_PATH."
  echo "Please ensure the Fabric samples are cloned from https://github.com/hyperledger/fabric-samples"
  exit 1
fi
cd "$FABRIC_SAMPLES_PATH/test-network" || exit
./network.sh down