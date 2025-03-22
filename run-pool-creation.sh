#!/bin/bash

source /root/.bashrc
source /root/.profile

echo "Running agent $(date)"
ROOT_DIR="/root/trump-fun-agent"

# Load environment variables if .env exists
if [ -f $ROOT_DIR/.env ]; then
  source $ROOT_DIR/.env
fi

# Run the agent
/root/.nvm/versions/node/v23.10.0/bin/bun run /root/trump-fun-agent/run-pool-creation-agent.ts
#bun run test-trump-agent.ts