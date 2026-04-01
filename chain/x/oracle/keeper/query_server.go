package keeper

import (
	"context"
	"fmt"

	sdk "github.com/cosmos/cosmos-sdk/types"

	"energychain/x/oracle/types"
)

type QueryServer struct {
	keeper Keeper
}

func NewQueryServerImpl(keeper Keeper) *QueryServer {
	return &QueryServer{keeper: keeper}
}

// ---------------------------------------------------------------------------
// QueryLatestData – get the most recent data for a category
// ---------------------------------------------------------------------------

type QueryLatestDataRequest struct {
	Category string `json:"category"`
}

type QueryLatestDataResponse struct {
	Data  types.OracleData `json:"data"`
	Found bool             `json:"found"`
}

func (q *QueryServer) QueryLatestData(goCtx context.Context, req *QueryLatestDataRequest) (*QueryLatestDataResponse, error) {
	if req == nil {
		return nil, fmt.Errorf("empty request")
	}
	ctx := sdk.UnwrapSDKContext(goCtx)
	data, found := q.keeper.GetLatestData(ctx, req.Category)
	return &QueryLatestDataResponse{Data: data, Found: found}, nil
}

// ---------------------------------------------------------------------------
// QueryDataHistory – get data within a time range for a category
// ---------------------------------------------------------------------------

type QueryDataHistoryRequest struct {
	Category string `json:"category"`
	From     int64  `json:"from"`
	To       int64  `json:"to"`
}

type QueryDataHistoryResponse struct {
	Data []types.OracleData `json:"data"`
}

func (q *QueryServer) QueryDataHistory(goCtx context.Context, req *QueryDataHistoryRequest) (*QueryDataHistoryResponse, error) {
	if req == nil {
		return nil, fmt.Errorf("empty request")
	}
	if req.From > req.To {
		return nil, fmt.Errorf("from timestamp must be <= to timestamp")
	}
	ctx := sdk.UnwrapSDKContext(goCtx)
	data := q.keeper.GetDataHistory(ctx, req.Category, req.From, req.To)
	if data == nil {
		data = []types.OracleData{}
	}
	return &QueryDataHistoryResponse{Data: data}, nil
}

// ---------------------------------------------------------------------------
// QueryOracles – list all registered oracle nodes
// ---------------------------------------------------------------------------

type QueryOraclesRequest struct{}

type QueryOraclesResponse struct {
	Oracles []types.OracleInfo `json:"oracles"`
}

func (q *QueryServer) QueryOracles(goCtx context.Context, req *QueryOraclesRequest) (*QueryOraclesResponse, error) {
	ctx := sdk.UnwrapSDKContext(goCtx)
	oracles := q.keeper.GetAllOracles(ctx)
	if oracles == nil {
		oracles = []types.OracleInfo{}
	}
	return &QueryOraclesResponse{Oracles: oracles}, nil
}
