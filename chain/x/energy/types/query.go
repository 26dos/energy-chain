package types

import "context"

type QueryServer interface {
	GetEnergyData(context.Context, *QueryEnergyDataRequest) (*QueryEnergyDataResponse, error)
	GetEnergyDataByCategory(context.Context, *QueryEnergyDataByCategoryRequest) (*QueryEnergyDataByCategoryResponse, error)
	GetEnergyDataBySubmitter(context.Context, *QueryEnergyDataBySubmitterRequest) (*QueryEnergyDataBySubmitterResponse, error)
	GetBatch(context.Context, *QueryBatchRequest) (*QueryBatchResponse, error)
	GetParams(context.Context, *QueryParamsRequest) (*QueryParamsResponse, error)
}

type QueryEnergyDataRequest struct {
	ID string `json:"id"`
}

type QueryEnergyDataResponse struct {
	Data EnergyData `json:"data"`
}

type QueryEnergyDataByCategoryRequest struct {
	Category string `json:"category"`
}

type QueryEnergyDataByCategoryResponse struct {
	Data []EnergyData `json:"data"`
}

type QueryEnergyDataBySubmitterRequest struct {
	Submitter string `json:"submitter"`
}

type QueryEnergyDataBySubmitterResponse struct {
	Data []EnergyData `json:"data"`
}

type QueryBatchRequest struct {
	ID string `json:"id"`
}

type QueryBatchResponse struct {
	Batch BatchSubmission `json:"batch"`
}

type QueryParamsRequest struct{}

type QueryParamsResponse struct {
	Params Params `json:"params"`
}
