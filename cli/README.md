# EnergyChain — CLI

Command-line tool for interacting with the EnergyDataAttestation contract.

## Install

```bash
npm install
```

## Environment Variables

```bash
export ENERGY_RPC_URL=http://127.0.0.1:8545
export ENERGY_CONTRACT=0x...
export ENERGY_PRIVATE_KEY=0x...
```

## Commands

```bash
# Hash data locally
node bin/energy-cli.js hash -d '{"key":"value"}'
node bin/energy-cli.js hash -f data.json

# Submit attestation
node bin/energy-cli.js attest --category meter --source-id M001 --data '{"reading":100}'

# Batch attestation from JSON file
node bin/energy-cli.js batch-attest -f mock/meter_readings.json --category meter

# Query on-chain record
node bin/energy-cli.js query --index 0

# Verify data against on-chain hash
node bin/energy-cli.js verify --data '{"reading":100}'

# View contract info
node bin/energy-cli.js info
```

## Smoke Tests

```bash
CONTRACT=0x... bash test/cli.test.sh
```
