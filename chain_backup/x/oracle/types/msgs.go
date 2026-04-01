package types

import (
	"fmt"

	sdk "github.com/cosmos/cosmos-sdk/types"
)

var (
	_ sdk.Msg = &MsgSubmitPrice{}
	_ sdk.Msg = &MsgAddOracle{}
	_ sdk.Msg = &MsgRemoveOracle{}
)

// --------------------------------------------------------------------------
// MsgSubmitPrice
// --------------------------------------------------------------------------

type MsgSubmitPrice struct {
	Submitter string   `json:"submitter"`
	DataType  DataType `json:"data_type"`
	Value     uint64   `json:"value"`
	Timestamp int64    `json:"timestamp"`
}

func NewMsgSubmitPrice(submitter string, dataType DataType, value uint64, timestamp int64) *MsgSubmitPrice {
	return &MsgSubmitPrice{
		Submitter: submitter,
		DataType:  dataType,
		Value:     value,
		Timestamp: timestamp,
	}
}

func (msg MsgSubmitPrice) ValidateBasic() error {
	if _, err := sdk.AccAddressFromBech32(msg.Submitter); err != nil {
		return fmt.Errorf("invalid submitter address: %w", err)
	}
	if !IsValidDataType(msg.DataType) {
		return fmt.Errorf("invalid data type: %d", msg.DataType)
	}
	if msg.Value == 0 {
		return fmt.Errorf("value must be positive")
	}
	if msg.Timestamp <= 0 {
		return fmt.Errorf("timestamp must be positive")
	}
	return nil
}

func (msg MsgSubmitPrice) GetSigners() []sdk.AccAddress {
	signer, _ := sdk.AccAddressFromBech32(msg.Submitter)
	return []sdk.AccAddress{signer}
}

// --------------------------------------------------------------------------
// MsgAddOracle
// --------------------------------------------------------------------------

type MsgAddOracle struct {
	Authority       string     `json:"authority"`
	OracleAddress   string     `json:"oracle_address"`
	Name            string     `json:"name"`
	AuthorizedTypes []DataType `json:"authorized_types"`
}

func NewMsgAddOracle(authority, oracleAddress, name string, authorizedTypes []DataType) *MsgAddOracle {
	return &MsgAddOracle{
		Authority:       authority,
		OracleAddress:   oracleAddress,
		Name:            name,
		AuthorizedTypes: authorizedTypes,
	}
}

func (msg MsgAddOracle) ValidateBasic() error {
	if _, err := sdk.AccAddressFromBech32(msg.Authority); err != nil {
		return fmt.Errorf("invalid authority address: %w", err)
	}
	if _, err := sdk.AccAddressFromBech32(msg.OracleAddress); err != nil {
		return fmt.Errorf("invalid oracle address: %w", err)
	}
	if msg.Name == "" {
		return fmt.Errorf("oracle name cannot be empty")
	}
	if len(msg.AuthorizedTypes) == 0 {
		return fmt.Errorf("authorized types cannot be empty")
	}
	for _, dt := range msg.AuthorizedTypes {
		if !IsValidDataType(dt) {
			return fmt.Errorf("invalid authorized data type: %d", dt)
		}
	}
	return nil
}

func (msg MsgAddOracle) GetSigners() []sdk.AccAddress {
	signer, _ := sdk.AccAddressFromBech32(msg.Authority)
	return []sdk.AccAddress{signer}
}

// --------------------------------------------------------------------------
// MsgRemoveOracle
// --------------------------------------------------------------------------

type MsgRemoveOracle struct {
	Authority     string `json:"authority"`
	OracleAddress string `json:"oracle_address"`
}

func NewMsgRemoveOracle(authority, oracleAddress string) *MsgRemoveOracle {
	return &MsgRemoveOracle{
		Authority:     authority,
		OracleAddress: oracleAddress,
	}
}

func (msg MsgRemoveOracle) ValidateBasic() error {
	if _, err := sdk.AccAddressFromBech32(msg.Authority); err != nil {
		return fmt.Errorf("invalid authority address: %w", err)
	}
	if _, err := sdk.AccAddressFromBech32(msg.OracleAddress); err != nil {
		return fmt.Errorf("invalid oracle address: %w", err)
	}
	return nil
}

func (msg MsgRemoveOracle) GetSigners() []sdk.AccAddress {
	signer, _ := sdk.AccAddressFromBech32(msg.Authority)
	return []sdk.AccAddress{signer}
}
