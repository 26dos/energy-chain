package keeper

import (
	"context"
	"fmt"

	sdk "github.com/cosmos/cosmos-sdk/types"

	"energychain/x/energy/types"
)

// QueryServer exposes read-only query handlers for the energy module.
type QueryServer struct {
	keeper Keeper
}

func NewQueryServerImpl(keeper Keeper) *QueryServer {
	return &QueryServer{keeper: keeper}
}

// ---------------------------------------------------------------------------
// QueryEnergyData – look up a single record by ID
// ---------------------------------------------------------------------------

type QueryEnergyDataRequest struct {
	ID string `json:"id"`
}

type QueryEnergyDataResponse struct {
	Data  types.EnergyData `json:"data"`
	Found bool             `json:"found"`
}

func (q *QueryServer) QueryEnergyData(goCtx context.Context, req *QueryEnergyDataRequest) (*QueryEnergyDataResponse, error) {
	if req == nil {
		return nil, fmt.Errorf("empty request")
	}
	ctx := sdk.UnwrapSDKContext(goCtx)
	data, found := q.keeper.GetEnergyData(ctx, req.ID)
	return &QueryEnergyDataResponse{Data: data, Found: found}, nil
}

// ---------------------------------------------------------------------------
// QueryEnergyDataByType – list records by data type with optional time range
// ---------------------------------------------------------------------------

type QueryEnergyDataByTypeRequest struct {
	DataType types.EnergyDataType `json:"data_type"`
	FromTime int64                `json:"from_time,omitempty"`
	ToTime   int64                `json:"to_time,omitempty"`
}

type QueryEnergyDataByTypeResponse struct {
	Records []types.EnergyData `json:"records"`
}

func (q *QueryServer) QueryEnergyDataByType(goCtx context.Context, req *QueryEnergyDataByTypeRequest) (*QueryEnergyDataByTypeResponse, error) {
	if req == nil {
		return nil, fmt.Errorf("empty request")
	}
	ctx := sdk.UnwrapSDKContext(goCtx)
	records := q.keeper.GetEnergyDataByType(ctx, req.DataType)

	if req.FromTime > 0 || req.ToTime > 0 {
		var filtered []types.EnergyData
		for _, r := range records {
			if req.FromTime > 0 && r.Timestamp < req.FromTime {
				continue
			}
			if req.ToTime > 0 && r.Timestamp > req.ToTime {
				continue
			}
			filtered = append(filtered, r)
		}
		records = filtered
	}

	if records == nil {
		records = []types.EnergyData{}
	}
	return &QueryEnergyDataByTypeResponse{Records: records}, nil
}

// ---------------------------------------------------------------------------
// QueryEnergyDataBySubmitter – list records by submitter address
// ---------------------------------------------------------------------------

type QueryEnergyDataBySubmitterRequest struct {
	Submitter string `json:"submitter"`
}

type QueryEnergyDataBySubmitterResponse struct {
	Records []types.EnergyData `json:"records"`
}

func (q *QueryServer) QueryEnergyDataBySubmitter(goCtx context.Context, req *QueryEnergyDataBySubmitterRequest) (*QueryEnergyDataBySubmitterResponse, error) {
	if req == nil {
		return nil, fmt.Errorf("empty request")
	}
	ctx := sdk.UnwrapSDKContext(goCtx)
	records := q.keeper.GetEnergyDataBySubmitter(ctx, req.Submitter)
	if records == nil {
		records = []types.EnergyData{}
	}
	return &QueryEnergyDataBySubmitterResponse{Records: records}, nil
}

// ---------------------------------------------------------------------------
// QueryBatch – look up a batch submission by ID
// ---------------------------------------------------------------------------

type QueryBatchRequest struct {
	ID string `json:"id"`
}

type QueryBatchResponse struct {
	Batch types.BatchSubmission `json:"batch"`
	Found bool                  `json:"found"`
}

func (q *QueryServer) QueryBatch(goCtx context.Context, req *QueryBatchRequest) (*QueryBatchResponse, error) {
	if req == nil {
		return nil, fmt.Errorf("empty request")
	}
	ctx := sdk.UnwrapSDKContext(goCtx)
	batch, found := q.keeper.GetBatch(ctx, req.ID)
	return &QueryBatchResponse{Batch: batch, Found: found}, nil
}
