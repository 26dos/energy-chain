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
	Submitter string         `json:"submitter"`
	DataType  EnergyDataType `json:"data_type"`
	DataHash  string         `json:"data_hash"`
	Summary   string         `json:"summary,omitempty"`
	SourceID  string         `json:"source_id"`
	Period    string         `json:"period"`
}

func NewMsgSubmitEnergyData(submitter string, dataType EnergyDataType, dataHash, summary, sourceID, period string) *MsgSubmitEnergyData {
	return &MsgSubmitEnergyData{
		Submitter: submitter,
		DataType:  dataType,
		DataHash:  dataHash,
		Summary:   summary,
		SourceID:  sourceID,
		Period:    period,
	}
}

func (msg MsgSubmitEnergyData) ValidateBasic() error {
	if _, err := sdk.AccAddressFromBech32(msg.Submitter); err != nil {
		return fmt.Errorf("invalid submitter address: %w", err)
	}
	if !IsValidDataType(msg.DataType) {
		return fmt.Errorf("invalid data type: %d", msg.DataType)
	}
	if msg.DataHash == "" {
		return fmt.Errorf("data hash cannot be empty")
	}
	if msg.SourceID == "" {
		return fmt.Errorf("source id cannot be empty")
	}
	if msg.Period == "" {
		return fmt.Errorf("period cannot be empty")
	}
	return nil
}

func (msg MsgSubmitEnergyData) GetSigners() []sdk.AccAddress {
	signer, _ := sdk.AccAddressFromBech32(msg.Submitter)
	return []sdk.AccAddress{signer}
}

// ---------------------------------------------------------------------------
// MsgBatchSubmit
// ---------------------------------------------------------------------------

// BatchItem describes a single item inside a batch submission.
type BatchItem struct {
	DataHash string `json:"data_hash"`
	SourceID string `json:"source_id"`
	Period   string `json:"period"`
}

type MsgBatchSubmit struct {
	Submitter  string         `json:"submitter"`
	DataType   EnergyDataType `json:"data_type"`
	Items      []BatchItem    `json:"items"`
	MerkleRoot string         `json:"merkle_root"`
}

func NewMsgBatchSubmit(submitter string, dataType EnergyDataType, items []BatchItem, merkleRoot string) *MsgBatchSubmit {
	return &MsgBatchSubmit{
		Submitter:  submitter,
		DataType:   dataType,
		Items:      items,
		MerkleRoot: merkleRoot,
	}
}

func (msg MsgBatchSubmit) ValidateBasic() error {
	if _, err := sdk.AccAddressFromBech32(msg.Submitter); err != nil {
		return fmt.Errorf("invalid submitter address: %w", err)
	}
	if !IsValidDataType(msg.DataType) {
		return fmt.Errorf("invalid data type: %d", msg.DataType)
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
		if item.SourceID == "" {
			return fmt.Errorf("item %d: source id cannot be empty", i)
		}
		if item.Period == "" {
			return fmt.Errorf("item %d: period cannot be empty", i)
		}
	}
	return nil
}

func (msg MsgBatchSubmit) GetSigners() []sdk.AccAddress {
	signer, _ := sdk.AccAddressFromBech32(msg.Submitter)
	return []sdk.AccAddress{signer}
}
