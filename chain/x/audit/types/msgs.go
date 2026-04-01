package types

import (
	"fmt"

	sdk "github.com/cosmos/cosmos-sdk/types"
	sdkerrors "github.com/cosmos/cosmos-sdk/types/errors"
)

const TypeMsgRecordAudit = "record_audit"

var _ sdk.Msg = &MsgRecordAudit{}

type MsgRecordAudit struct {
	Creator   string `json:"creator"`
	EventType string `json:"event_type"`          // user-defined event type string
	Target    string `json:"target,omitempty"`
	Action    string `json:"action"`
	Data      string `json:"data,omitempty"`       // free-form JSON payload
}

func NewMsgRecordAudit(creator, eventType, target, action, data string) *MsgRecordAudit {
	return &MsgRecordAudit{
		Creator:   creator,
		EventType: eventType,
		Target:    target,
		Action:    action,
		Data:      data,
	}
}

func (msg *MsgRecordAudit) Reset()        {}
func (msg *MsgRecordAudit) ProtoMessage() {}
func (msg *MsgRecordAudit) String() string {
	return fmt.Sprintf("MsgRecordAudit{%s, %s}", msg.Creator, msg.EventType)
}
func (msg *MsgRecordAudit) Route() string { return RouterKey }
func (msg *MsgRecordAudit) Type() string  { return TypeMsgRecordAudit }

func (msg *MsgRecordAudit) ValidateBasic() error {
	if _, err := sdk.AccAddressFromBech32(msg.Creator); err != nil {
		return sdkerrors.ErrInvalidAddress.Wrapf("invalid creator address: %s", err)
	}
	if msg.EventType == "" {
		return sdkerrors.ErrInvalidRequest.Wrap("event_type cannot be empty")
	}
	if msg.Action == "" {
		return sdkerrors.ErrInvalidRequest.Wrap("action cannot be empty")
	}
	return nil
}

func (msg *MsgRecordAudit) GetSigners() []sdk.AccAddress {
	creator, _ := sdk.AccAddressFromBech32(msg.Creator)
	return []sdk.AccAddress{creator}
}

func (msg *MsgRecordAudit) GetSignBytes() []byte {
	return sdk.MustSortJSON(amino.MustMarshalJSON(msg))
}
