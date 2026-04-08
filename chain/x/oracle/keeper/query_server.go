package keeper

import (
	"context"
	"fmt"

	sdk "github.com/cosmos/cosmos-sdk/types"

	"energychain/x/oracle/types"
)

type queryServer struct {
	keeper Keeper
}

func NewQueryServerImpl(keeper Keeper) types.QueryServer {
	return &queryServer{keeper: keeper}
}

var _ types.QueryServer = &queryServer{}

func (q *queryServer) GetLatestData(goCtx context.Context, req *types.QueryLatestDataRequest) (*types.QueryLatestDataResponse, error) {
	ctx := sdk.UnwrapSDKContext(goCtx)
	data, found := q.keeper.GetLatestData(ctx, req.Category)
	if !found {
		return nil, fmt.Errorf("no data found for category: %s", req.Category)
	}
	return &types.QueryLatestDataResponse{Data: data}, nil
}

func (q *queryServer) GetDataHistory(goCtx context.Context, req *types.QueryDataHistoryRequest) (*types.QueryDataHistoryResponse, error) {
	ctx := sdk.UnwrapSDKContext(goCtx)
	data := q.keeper.GetDataHistory(ctx, req.Category, req.FromTime, req.ToTime)
	return &types.QueryDataHistoryResponse{Data: data}, nil
}

func (q *queryServer) GetOracle(goCtx context.Context, req *types.QueryOracleRequest) (*types.QueryOracleResponse, error) {
	ctx := sdk.UnwrapSDKContext(goCtx)
	oracle, found := q.keeper.GetOracle(ctx, req.Address)
	if !found {
		return nil, fmt.Errorf("oracle not found: %s", req.Address)
	}
	return &types.QueryOracleResponse{Oracle: oracle}, nil
}

func (q *queryServer) GetAllOracles(goCtx context.Context, _ *types.QueryAllOraclesRequest) (*types.QueryAllOraclesResponse, error) {
	ctx := sdk.UnwrapSDKContext(goCtx)
	oracles := q.keeper.GetAllOracles(ctx)
	return &types.QueryAllOraclesResponse{Oracles: oracles}, nil
}

func (q *queryServer) GetParams(goCtx context.Context, _ *types.QueryParamsRequest) (*types.QueryParamsResponse, error) {
	ctx := sdk.UnwrapSDKContext(goCtx)
	params := q.keeper.GetParams(ctx)
	return &types.QueryParamsResponse{Params: params}, nil
}
