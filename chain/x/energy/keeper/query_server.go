package keeper

import (
	"context"
	"fmt"

	sdk "github.com/cosmos/cosmos-sdk/types"

	"energychain/x/energy/types"
)

type queryServer struct {
	keeper Keeper
}

func NewQueryServerImpl(keeper Keeper) types.QueryServer {
	return &queryServer{keeper: keeper}
}

var _ types.QueryServer = &queryServer{}

func (q *queryServer) GetEnergyData(goCtx context.Context, req *types.QueryEnergyDataRequest) (*types.QueryEnergyDataResponse, error) {
	ctx := sdk.UnwrapSDKContext(goCtx)
	data, found := q.keeper.GetEnergyData(ctx, req.ID)
	if !found {
		return nil, fmt.Errorf("energy data not found: %s", req.ID)
	}
	return &types.QueryEnergyDataResponse{Data: data}, nil
}

func (q *queryServer) GetEnergyDataByCategory(goCtx context.Context, req *types.QueryEnergyDataByCategoryRequest) (*types.QueryEnergyDataByCategoryResponse, error) {
	ctx := sdk.UnwrapSDKContext(goCtx)
	data := q.keeper.GetEnergyDataByCategory(ctx, req.Category)
	return &types.QueryEnergyDataByCategoryResponse{Data: data}, nil
}

func (q *queryServer) GetEnergyDataBySubmitter(goCtx context.Context, req *types.QueryEnergyDataBySubmitterRequest) (*types.QueryEnergyDataBySubmitterResponse, error) {
	ctx := sdk.UnwrapSDKContext(goCtx)
	data := q.keeper.GetEnergyDataBySubmitter(ctx, req.Submitter)
	return &types.QueryEnergyDataBySubmitterResponse{Data: data}, nil
}

func (q *queryServer) GetBatch(goCtx context.Context, req *types.QueryBatchRequest) (*types.QueryBatchResponse, error) {
	ctx := sdk.UnwrapSDKContext(goCtx)
	batch, found := q.keeper.GetBatch(ctx, req.ID)
	if !found {
		return nil, fmt.Errorf("batch not found: %s", req.ID)
	}
	return &types.QueryBatchResponse{Batch: batch}, nil
}

func (q *queryServer) GetParams(goCtx context.Context, _ *types.QueryParamsRequest) (*types.QueryParamsResponse, error) {
	ctx := sdk.UnwrapSDKContext(goCtx)
	params := q.keeper.GetParams(ctx)
	return &types.QueryParamsResponse{Params: params}, nil
}
