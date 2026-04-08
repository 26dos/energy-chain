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

func RegisterInterfaces(_ cdctypes.InterfaceRegistry) {}

func init() {
	RegisterCodec(amino)
	amino.Seal()
}
