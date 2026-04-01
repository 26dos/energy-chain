package types

import (
	"fmt"

	sdk "github.com/cosmos/cosmos-sdk/types"
	sdkerrors "github.com/cosmos/cosmos-sdk/types/errors"
)

const (
	TypeMsgRegisterIdentity = "register_identity"
	TypeMsgUpdateIdentity   = "update_identity"
	TypeMsgRevokeIdentity   = "revoke_identity"
)

var (
	_ sdk.Msg = &MsgRegisterIdentity{}
	_ sdk.Msg = &MsgUpdateIdentity{}
	_ sdk.Msg = &MsgRevokeIdentity{}
)

// ---------------------------------------------------------------------------
// MsgRegisterIdentity
// ---------------------------------------------------------------------------

type MsgRegisterIdentity struct {
	Creator  string   `json:"creator"`
	Address  string   `json:"address"`
	Name     string   `json:"name"`
	Role     RoleType `json:"role"`
	Metadata string   `json:"metadata"`
}

func NewMsgRegisterIdentity(creator, address, name string, role RoleType, metadata string) *MsgRegisterIdentity {
	return &MsgRegisterIdentity{
		Creator:  creator,
		Address:  address,
		Name:     name,
		Role:     role,
		Metadata: metadata,
	}
}

func (msg *MsgRegisterIdentity) Reset()         {}
func (msg *MsgRegisterIdentity) ProtoMessage()   {}
func (msg *MsgRegisterIdentity) String() string  { return fmt.Sprintf("MsgRegisterIdentity{%s}", msg.Address) }
func (msg *MsgRegisterIdentity) Route() string   { return RouterKey }
func (msg *MsgRegisterIdentity) Type() string    { return TypeMsgRegisterIdentity }

func (msg *MsgRegisterIdentity) ValidateBasic() error {
	if _, err := sdk.AccAddressFromBech32(msg.Creator); err != nil {
		return sdkerrors.ErrInvalidAddress.Wrapf("invalid creator address: %s", err)
	}
	if _, err := sdk.AccAddressFromBech32(msg.Address); err != nil {
		return sdkerrors.ErrInvalidAddress.Wrapf("invalid identity address: %s", err)
	}
	if msg.Name == "" {
		return sdkerrors.ErrInvalidRequest.Wrap("name cannot be empty")
	}
	if msg.Role < RoleUser || msg.Role > RoleRegulator {
		return sdkerrors.ErrInvalidRequest.Wrap("invalid role type")
	}
	return nil
}

func (msg *MsgRegisterIdentity) GetSigners() []sdk.AccAddress {
	creator, _ := sdk.AccAddressFromBech32(msg.Creator)
	return []sdk.AccAddress{creator}
}

func (msg *MsgRegisterIdentity) GetSignBytes() []byte {
	return sdk.MustSortJSON(amino.MustMarshalJSON(msg))
}

// ---------------------------------------------------------------------------
// MsgUpdateIdentity
// ---------------------------------------------------------------------------

type MsgUpdateIdentity struct {
	Creator  string `json:"creator"`
	Address  string `json:"address"`
	Name     string `json:"name"`
	Metadata string `json:"metadata"`
}

func NewMsgUpdateIdentity(creator, address, name, metadata string) *MsgUpdateIdentity {
	return &MsgUpdateIdentity{
		Creator:  creator,
		Address:  address,
		Name:     name,
		Metadata: metadata,
	}
}

func (msg *MsgUpdateIdentity) Reset()         {}
func (msg *MsgUpdateIdentity) ProtoMessage()   {}
func (msg *MsgUpdateIdentity) String() string  { return fmt.Sprintf("MsgUpdateIdentity{%s}", msg.Address) }
func (msg *MsgUpdateIdentity) Route() string   { return RouterKey }
func (msg *MsgUpdateIdentity) Type() string    { return TypeMsgUpdateIdentity }

func (msg *MsgUpdateIdentity) ValidateBasic() error {
	if _, err := sdk.AccAddressFromBech32(msg.Creator); err != nil {
		return sdkerrors.ErrInvalidAddress.Wrapf("invalid creator address: %s", err)
	}
	if _, err := sdk.AccAddressFromBech32(msg.Address); err != nil {
		return sdkerrors.ErrInvalidAddress.Wrapf("invalid identity address: %s", err)
	}
	return nil
}

func (msg *MsgUpdateIdentity) GetSigners() []sdk.AccAddress {
	creator, _ := sdk.AccAddressFromBech32(msg.Creator)
	return []sdk.AccAddress{creator}
}

func (msg *MsgUpdateIdentity) GetSignBytes() []byte {
	return sdk.MustSortJSON(amino.MustMarshalJSON(msg))
}

// ---------------------------------------------------------------------------
// MsgRevokeIdentity
// ---------------------------------------------------------------------------

type MsgRevokeIdentity struct {
	Creator string `json:"creator"`
	Address string `json:"address"`
	Reason  string `json:"reason"`
}

func NewMsgRevokeIdentity(creator, address, reason string) *MsgRevokeIdentity {
	return &MsgRevokeIdentity{
		Creator: creator,
		Address: address,
		Reason:  reason,
	}
}

func (msg *MsgRevokeIdentity) Reset()         {}
func (msg *MsgRevokeIdentity) ProtoMessage()   {}
func (msg *MsgRevokeIdentity) String() string  { return fmt.Sprintf("MsgRevokeIdentity{%s}", msg.Address) }
func (msg *MsgRevokeIdentity) Route() string   { return RouterKey }
func (msg *MsgRevokeIdentity) Type() string    { return TypeMsgRevokeIdentity }

func (msg *MsgRevokeIdentity) ValidateBasic() error {
	if _, err := sdk.AccAddressFromBech32(msg.Creator); err != nil {
		return sdkerrors.ErrInvalidAddress.Wrapf("invalid creator address: %s", err)
	}
	if _, err := sdk.AccAddressFromBech32(msg.Address); err != nil {
		return sdkerrors.ErrInvalidAddress.Wrapf("invalid identity address: %s", err)
	}
	return nil
}

func (msg *MsgRevokeIdentity) GetSigners() []sdk.AccAddress {
	creator, _ := sdk.AccAddressFromBech32(msg.Creator)
	return []sdk.AccAddress{creator}
}

func (msg *MsgRevokeIdentity) GetSignBytes() []byte {
	return sdk.MustSortJSON(amino.MustMarshalJSON(msg))
}
