.PHONY: build install test lint clean docker-build docker-push local-node contracts-deploy cli-install help

BINARY       := energychaind
CHAIN_DIR    := chain
CONTRACT_DIR := contracts
CLI_DIR      := cli
DOCKER_IMAGE := energychain
DOCKER_TAG   := latest

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ─── Chain ────────────────────────────────────────────────────────────────────

build: ## Build the chain binary
	cd $(CHAIN_DIR) && go build -o build/$(BINARY) ./cmd/$(BINARY)

install: ## Install the chain binary to GOPATH
	cd $(CHAIN_DIR) && go install ./cmd/$(BINARY)

test: ## Run Go tests for the chain
	cd $(CHAIN_DIR) && go test ./... -v -count=1

lint: ## Run Go vet on chain code
	cd $(CHAIN_DIR) && go vet ./...

clean: ## Remove build artifacts
	rm -rf $(CHAIN_DIR)/build

# ─── Local Node ───────────────────────────────────────────────────────────────

local-node: build ## Initialize and start a local testnet node
	bash $(CHAIN_DIR)/scripts/local_node.sh -y

# ─── Docker ───────────────────────────────────────────────────────────────────

docker-build: ## Build Docker image for the chain
	docker build -t $(DOCKER_IMAGE):$(DOCKER_TAG) $(CHAIN_DIR)

# ─── Contracts ────────────────────────────────────────────────────────────────

contracts-compile: ## Compile Solidity contracts
	cd $(CONTRACT_DIR) && npx hardhat compile

contracts-deploy: ## Deploy contracts to local testnet
	cd $(CONTRACT_DIR) && npx hardhat run scripts/deploy.ts --network localhost

contracts-test: ## Run contract tests
	cd $(CONTRACT_DIR) && npx hardhat test

# ─── CLI ──────────────────────────────────────────────────────────────────────

cli-install: ## Install CLI dependencies
	cd $(CLI_DIR) && npm install

cli-mock: ## Run mock data submission
	cd $(CLI_DIR) && bash mock/submit_all.sh
