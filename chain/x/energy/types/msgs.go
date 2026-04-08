package types

import (
	"fmt"

	sdk "github.com/cosmos/cosmos-sdk/types"
)

var (
	_ sdk.Msg = &MsgSubmitEnergyData{}
	_ sdk.Msg = &MsgBatchSubmit{}
)

// ---------------------------------------------------------------------------
// MsgSubmitEnergyData
// ---------------------------------------------------------------------------

type MsgSubmitEnergyData struct {
	Submitter string `json:"submitter"`
	Category  string `json:"category"`           // user-defined, e.g. "meter", "trade", "carbon"
	DataHash  string `json:"data_hash"`
	Metadata  string `json:"metadata,omitempty"`  // optional free-form JSON
}

func NewMsgSubmitEnergyData(submitter, category, dataHash, metadata string) *MsgSubmitEnergyData {
	return &MsgSubmitEnergyData{
		Submitter: submitter,
		Category:  category,
		DataHash:  dataHash,
		Metadata:  metadata,
	}
}

func (*MsgSubmitEnergyData) ProtoMessage()  {}
func (*MsgSubmitEnergyData) Reset()         {}
func (msg *MsgSubmitEnergyData) String() string {
	return fmt.Sprintf("MsgSubmitEnergyData{submitter=%s, category=%s}", msg.Submitter, msg.Category)
}

func (msg MsgSubmitEnergyData) ValidateBasic() error {
	if _, err := sdk.AccAddressFromBech32(msg.Submitter); err != nil {
		return fmt.Errorf("invalid submitter address: %w", err)
	}
	if msg.Category == "" {
		return fmt.Errorf("category cannot be empty")
	}
	if msg.DataHash == "" {
		return fmt.Errorf("data hash cannot be empty")
	}
	return nil
}

func (msg MsgSubmitEnergyData) GetSigners() []sdk.AccAddress {
	signer, _ := sdk.AccAddressFromBech32(msg.Submitter)
	return []sdk.AccAddress{signer}
}

func (*MsgSubmitEnergyData) Route() string { return RouterKey }
func (*MsgSubmitEnergyData) Type() string  { return "submit_energy_data" }
func (msg *MsgSubmitEnergyData) GetSignBytes() []byte {
	return sdk.MustSortJSON(amino.MustMarshalJSON(msg))
}

// ---------------------------------------------------------------------------
// MsgBatchSubmit
// ---------------------------------------------------------------------------

// BatchItem describes a single item inside a batch submission.
type BatchItem struct {
	DataHash string `json:"data_hash"`
	Metadata string `json:"metadata,omitempty"`
}

type MsgBatchSubmit struct {
	Submitter  string      `json:"submitter"`
	Category   string      `json:"category"`
	Items      []BatchItem `json:"items"`
	MerkleRoot string      `json:"merkle_root"`
}

func NewMsgBatchSubmit(submitter, category string, items []BatchItem, merkleRoot string) *MsgBatchSubmit {
	return &MsgBatchSubmit{
		Submitter:  submitter,
		Category:   category,
		Items:      items,
		MerkleRoot: merkleRoot,
	}
}

func (*MsgBatchSubmit) ProtoMessage()  {}
func (*MsgBatchSubmit) Reset()         {}
func (msg *MsgBatchSubmit) String() string {
	return fmt.Sprintf("MsgBatchSubmit{submitter=%s, items=%d}", msg.Submitter, len(msg.Items))
}

func (msg MsgBatchSubmit) ValidateBasic() error {
	if _, err := sdk.AccAddressFromBech32(msg.Submitter); err != nil {
		return fmt.Errorf("invalid submitter address: %w", err)
	}
	if msg.Category == "" {
		return fmt.Errorf("category cannot be empty")
	}
	if len(msg.Items) == 0 {
		return fmt.Errorf("batch must contain at least one item")
	}
	if msg.MerkleRoot == "" {
		return fmt.Errorf("merkle root cannot be empty")
	}
	for i, item := range msg.Items {
		if item.DataHash == "" {
			return fmt.Errorf("item %d: data hash cannot be empty", i)
		}
	}
	return nil
}

func (msg MsgBatchSubmit) GetSigners() []sdk.AccAddress {
	signer, _ := sdk.AccAddressFromBech32(msg.Submitter)
	return []sdk.AccAddress{signer}
}

func (*MsgBatchSubmit) Route() string { return RouterKey }
func (*MsgBatchSubmit) Type() string  { return "batch_submit" }
func (msg *MsgBatchSubmit) GetSignBytes() []byte {
	return sdk.MustSortJSON(amino.MustMarshalJSON(msg))
}
