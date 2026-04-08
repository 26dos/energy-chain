package types

import "context"

type QueryServer interface {
	GetLatestData(context.Context, *QueryLatestDataRequest) (*QueryLatestDataResponse, error)
	GetDataHistory(context.Context, *QueryDataHistoryRequest) (*QueryDataHistoryResponse, error)
	GetOracle(context.Context, *QueryOracleRequest) (*QueryOracleResponse, error)
	GetAllOracles(context.Context, *QueryAllOraclesRequest) (*QueryAllOraclesResponse, error)
	GetParams(context.Context, *QueryParamsRequest) (*QueryParamsResponse, error)
}

type QueryLatestDataRequest struct {
	Category string `json:"category"`
}
type QueryLatestDataResponse struct {
	Data OracleData `json:"data"`
}

type QueryDataHistoryRequest struct {
	Category string `json:"category"`
	FromTime int64  `json:"from_time"`
	ToTime   int64  `json:"to_time"`
}
type QueryDataHistoryResponse struct {
	Data []OracleData `json:"data"`
}

type QueryOracleRequest struct {
	Address string `json:"address"`
}
type QueryOracleResponse struct {
	Oracle OracleInfo `json:"oracle"`
}

type QueryAllOraclesRequest struct{}
type QueryAllOraclesResponse struct {
	Oracles []OracleInfo `json:"oracles"`
}

type QueryParamsRequest struct{}
type QueryParamsResponse struct {
	Params Params `json:"params"`
}
