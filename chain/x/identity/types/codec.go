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
	cdc.RegisterConcrete(&MsgRegisterIdentity{}, "identity/MsgRegisterIdentity", nil)
	cdc.RegisterConcrete(&MsgUpdateIdentity{}, "identity/MsgUpdateIdentity", nil)
	cdc.RegisterConcrete(&MsgRevokeIdentity{}, "identity/MsgRevokeIdentity", nil)
}

func RegisterInterfaces(_ cdctypes.InterfaceRegistry) {
	// Hand-written types lack proto type URLs; skip RegisterImplementations
	// to avoid typeURL collision panics. Cosmos-native tx routing is not
	// wired for these modules (no proto codegen).
}

func init() {
	RegisterCodec(amino)
	amino.Seal()
}
