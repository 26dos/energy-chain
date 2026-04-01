package types

import (
	"fmt"

	sdk "github.com/cosmos/cosmos-sdk/types"
)

var (
	_ sdk.Msg = &MsgSubmitData{}
	_ sdk.Msg = &MsgAddOracle{}
	_ sdk.Msg = &MsgRemoveOracle{}
)

// ---------------------------------------------------------------------------
// MsgSubmitData — generic oracle data submission (replaces MsgSubmitPrice)
// ---------------------------------------------------------------------------

type MsgSubmitData struct {
	Submitter string `json:"submitter"`
	Category  string `json:"category"`            // user-defined, e.g. "spot_price", "weather"
	Value     string `json:"value"`               // free-form value
	Metadata  string `json:"metadata,omitempty"`  // optional context
	Timestamp int64  `json:"timestamp"`
}

func NewMsgSubmitData(submitter, category, value, metadata string, timestamp int64) *MsgSubmitData {
	return &MsgSubmitData{
		Submitter: submitter,
		Category:  category,
		Value:     value,
		Metadata:  metadata,
		Timestamp: timestamp,
	}
}

func (*MsgSubmitData) ProtoMessage()  {}
func (*MsgSubmitData) Reset()         {}
func (msg *MsgSubmitData) String() string {
	return fmt.Sprintf("MsgSubmitData{submitter=%s, category=%s}", msg.Submitter, msg.Category)
}

func (msg MsgSubmitData) ValidateBasic() error {
	if _, err := sdk.AccAddressFromBech32(msg.Submitter); err != nil {
		return fmt.Errorf("invalid submitter address: %w", err)
	}
	if msg.Category == "" {
		return fmt.Errorf("category cannot be empty")
	}
	if msg.Value == "" {
		return fmt.Errorf("value cannot be empty")
	}
	if msg.Timestamp <= 0 {
		return fmt.Errorf("timestamp must be positive")
	}
	return nil
}

func (msg MsgSubmitData) GetSigners() []sdk.AccAddress {
	signer, _ := sdk.AccAddressFromBech32(msg.Submitter)
	return []sdk.AccAddress{signer}
}

// ---------------------------------------------------------------------------
// MsgAddOracle
// ---------------------------------------------------------------------------

type MsgAddOracle struct {
	Authority            string   `json:"authority"`
	OracleAddress        string   `json:"oracle_address"`
	Name                 string   `json:"name"`
	AuthorizedCategories []string `json:"authorized_categories"` // empty = all categories
}

func NewMsgAddOracle(authority, oracleAddress, name string, categories []string) *MsgAddOracle {
	return &MsgAddOracle{
		Authority:            authority,
		OracleAddress:        oracleAddress,
		Name:                 name,
		AuthorizedCategories: categories,
	}
}

func (*MsgAddOracle) ProtoMessage()  {}
func (*MsgAddOracle) Reset()         {}
func (msg *MsgAddOracle) String() string {
	return fmt.Sprintf("MsgAddOracle{oracle=%s}", msg.OracleAddress)
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
	return nil
}

func (msg MsgAddOracle) GetSigners() []sdk.AccAddress {
	signer, _ := sdk.AccAddressFromBech32(msg.Authority)
	return []sdk.AccAddress{signer}
}

// ---------------------------------------------------------------------------
// MsgRemoveOracle
// ---------------------------------------------------------------------------

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

func (*MsgRemoveOracle) ProtoMessage()  {}
func (*MsgRemoveOracle) Reset()         {}
func (msg *MsgRemoveOracle) String() string {
	return fmt.Sprintf("MsgRemoveOracle{oracle=%s}", msg.OracleAddress)
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
