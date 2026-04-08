package evmd

import (
	"encoding/json"

	erc20types "github.com/cosmos/evm/x/erc20/types"
	feemarkettypes "github.com/cosmos/evm/x/feemarket/types"
	evmtypes "github.com/cosmos/evm/x/vm/types"

	minttypes "github.com/cosmos/cosmos-sdk/x/mint/types"
)

const (
	NativeDenom         = "uecy"
	NativeERC20Contract = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
)

// GenesisState of the blockchain is represented here as a map of raw json
// messages key'd by an identifier string.
type GenesisState map[string]json.RawMessage

// NewEVMGenesisState returns the default genesis state for the EVM module.
func NewEVMGenesisState() *evmtypes.GenesisState {
	evmGenState := evmtypes.DefaultGenesisState()
	evmGenState.Params.ActiveStaticPrecompiles = evmtypes.AvailableStaticPrecompiles
	evmGenState.Preinstalls = evmtypes.DefaultPreinstalls

	return evmGenState
}

// NewErc20GenesisState returns the default genesis state for the ERC20 module.
func NewErc20GenesisState() *erc20types.GenesisState {
	erc20GenState := erc20types.DefaultGenesisState()
	erc20GenState.TokenPairs = []erc20types.TokenPair{
		{
			Erc20Address:  NativeERC20Contract,
			Denom:         NativeDenom,
			Enabled:       true,
			ContractOwner: erc20types.OWNER_MODULE,
		},
	}
	erc20GenState.NativePrecompiles = []string{NativeERC20Contract}

	return erc20GenState
}

// NewMintGenesisState returns the default genesis state for the mint module.
func NewMintGenesisState() *minttypes.GenesisState {
	mintGenState := minttypes.DefaultGenesisState()
	mintGenState.Params.MintDenom = NativeDenom
	return mintGenState
}

// NewFeeMarketGenesisState returns the default genesis state for the feemarket module.
func NewFeeMarketGenesisState() *feemarkettypes.GenesisState {
	feeMarketGenState := feemarkettypes.DefaultGenesisState()
	feeMarketGenState.Params.NoBaseFee = false

	return feeMarketGenState
}
