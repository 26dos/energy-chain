package keeper

import (
	"context"
	"fmt"

	sdk "github.com/cosmos/cosmos-sdk/types"

	"energychain/x/oracle/types"
)

// QueryServer exposes read-only query handlers for the oracle module.
type QueryServer struct {
	keeper Keeper
}

func NewQueryServerImpl(keeper Keeper) *QueryServer {
	return &QueryServer{keeper: keeper}
}

// QueryLatestPriceRequest is the request type for QueryLatestPrice.
type QueryLatestPriceRequest struct {
	DataType types.DataType `json:"data_type"`
}

// QueryLatestPriceResponse is the response type for QueryLatestPrice.
type QueryLatestPriceResponse struct {
	Price types.PriceData `json:"price"`
	Found bool            `json:"found"`
}

// QueryLatestPrice returns the most recent price submission for a given data type.
func (q *QueryServer) QueryLatestPrice(goCtx context.Context, req *QueryLatestPriceRequest) (*QueryLatestPriceResponse, error) {
	if req == nil {
		return nil, fmt.Errorf("empty request")
	}
	ctx := sdk.UnwrapSDKContext(goCtx)
	price, found := q.keeper.GetLatestPrice(ctx, req.DataType)
	return &QueryLatestPriceResponse{Price: price, Found: found}, nil
}

// QueryPriceHistoryRequest is the request type for QueryPriceHistory.
type QueryPriceHistoryRequest struct {
	DataType types.DataType `json:"data_type"`
	From     int64          `json:"from"`
	To       int64          `json:"to"`
}

// QueryPriceHistoryResponse is the response type for QueryPriceHistory.
type QueryPriceHistoryResponse struct {
	Prices []types.PriceData `json:"prices"`
}

// QueryPriceHistory returns all price submissions within a time range for a given data type.
func (q *QueryServer) QueryPriceHistory(goCtx context.Context, req *QueryPriceHistoryRequest) (*QueryPriceHistoryResponse, error) {
	if req == nil {
		return nil, fmt.Errorf("empty request")
	}
	if req.From > req.To {
		return nil, fmt.Errorf("from timestamp must be <= to timestamp")
	}
	ctx := sdk.UnwrapSDKContext(goCtx)
	prices := q.keeper.GetPriceHistory(ctx, req.DataType, req.From, req.To)
	if prices == nil {
		prices = []types.PriceData{}
	}
	return &QueryPriceHistoryResponse{Prices: prices}, nil
}

// QueryOraclesRequest is the request type for QueryOracles.
type QueryOraclesRequest struct{}

// QueryOraclesResponse is the response type for QueryOracles.
type QueryOraclesResponse struct {
	Oracles []types.OracleInfo `json:"oracles"`
}

// QueryOracles returns all registered oracle nodes.
func (q *QueryServer) QueryOracles(goCtx context.Context, req *QueryOraclesRequest) (*QueryOraclesResponse, error) {
	ctx := sdk.UnwrapSDKContext(goCtx)
	oracles := q.keeper.GetAllOracles(ctx)
	if oracles == nil {
		oracles = []types.OracleInfo{}
	}
	return &QueryOraclesResponse{Oracles: oracles}, nil
}
