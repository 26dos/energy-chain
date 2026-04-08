package types

import "context"

type MsgServer interface {
	SubmitEnergyData(context.Context, *MsgSubmitEnergyData) (*MsgSubmitEnergyDataResponse, error)
	BatchSubmit(context.Context, *MsgBatchSubmit) (*MsgBatchSubmitResponse, error)
}

type MsgSubmitEnergyDataResponse struct {
	ID string `json:"id"`
}

type MsgBatchSubmitResponse struct {
	BatchID   string `json:"batch_id"`
	DataCount uint32 `json:"data_count"`
}
