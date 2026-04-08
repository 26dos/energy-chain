package types

import (
	"github.com/cosmos/cosmos-sdk/codec"
	cdctypes "github.com/cosmos/cosmos-sdk/codec/types"
)

var (
	amino     = codec.NewLegacyAmino()
	ModuleCdc = codec.NewAminoCodec(amino)
)

func RegisterCodec(cdc *codec.LegacyAmino) {
	cdc.RegisterConcrete(&MsgSubmitEnergyData{}, "energy/MsgSubmitEnergyData", nil)
	cdc.RegisterConcrete(&MsgBatchSubmit{}, "energy/MsgBatchSubmit", nil)
}

// RegisterInterfaces is intentionally a no-op: these message types are
// hand-written (no proto codegen) so they cannot be registered into the
// protobuf interface registry without breaking the reflection service.
// Amino registration in RegisterCodec is sufficient for tx routing.
func RegisterInterfaces(_ cdctypes.InterfaceRegistry) {}

func init() {
	RegisterCodec(amino)
	amino.Seal()
}
