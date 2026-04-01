package keeper

import (
	"context"
	"fmt"

	sdk "github.com/cosmos/cosmos-sdk/types"

	"energychain/x/energy/types"
)

type msgServer struct {
	keeper Keeper
}

func NewMsgServerImpl(keeper Keeper) *msgServer {
	return &msgServer{keeper: keeper}
}

// SubmitEnergyData handles a single energy data attestation submission.
func (m *msgServer) SubmitEnergyData(goCtx context.Context, msg *types.MsgSubmitEnergyData) error {
	ctx := sdk.UnwrapSDKContext(goCtx)

	if !m.keeper.IsAllowedSubmitter(ctx, msg.Submitter) {
		return fmt.Errorf("address %s is not an allowed submitter", msg.Submitter)
	}

	id := m.keeper.GenerateID(ctx)
	data := types.EnergyData{
		ID:          id,
		DataType:    msg.DataType,
		Submitter:   msg.Submitter,
		DataHash:    msg.DataHash,
		Summary:     msg.Summary,
		SourceID:    msg.SourceID,
		Period:      msg.Period,
		BlockHeight: ctx.BlockHeight(),
		Timestamp:   ctx.BlockTime().Unix(),
	}

	m.keeper.SubmitEnergyData(ctx, data)

	ctx.EventManager().EmitEvent(sdk.NewEvent(
		"energy_data_submitted",
		sdk.NewAttribute("id", id),
		sdk.NewAttribute("submitter", msg.Submitter),
		sdk.NewAttribute("data_type", msg.DataType.String()),
		sdk.NewAttribute("data_hash", msg.DataHash),
		sdk.NewAttribute("source_id", msg.SourceID),
	))

	return nil
}

// BatchSubmit handles a batch of energy data submissions with a merkle root.
func (m *msgServer) BatchSubmit(goCtx context.Context, msg *types.MsgBatchSubmit) error {
	ctx := sdk.UnwrapSDKContext(goCtx)

	if !m.keeper.IsAllowedSubmitter(ctx, msg.Submitter) {
		return fmt.Errorf("address %s is not an allowed submitter", msg.Submitter)
	}

	params := m.keeper.GetParams(ctx)
	if uint32(len(msg.Items)) > params.MaxBatchSize {
		return fmt.Errorf("batch size %d exceeds maximum %d", len(msg.Items), params.MaxBatchSize)
	}

	batchID := m.keeper.GenerateID(ctx)
	now := ctx.BlockTime().Unix()
	height := ctx.BlockHeight()

	for _, item := range msg.Items {
		id := m.keeper.GenerateID(ctx)
		data := types.EnergyData{
			ID:          id,
			DataType:    msg.DataType,
			Submitter:   msg.Submitter,
			DataHash:    item.DataHash,
			SourceID:    item.SourceID,
			Period:      item.Period,
			BlockHeight: height,
			Timestamp:   now,
		}
		m.keeper.SubmitEnergyData(ctx, data)
	}

	batch := types.BatchSubmission{
		ID:         batchID,
		Submitter:  msg.Submitter,
		DataCount:  uint32(len(msg.Items)),
		MerkleRoot: msg.MerkleRoot,
		Timestamp:  now,
	}
	m.keeper.SubmitBatch(ctx, batch)

	ctx.EventManager().EmitEvent(sdk.NewEvent(
		"energy_batch_submitted",
		sdk.NewAttribute("batch_id", batchID),
		sdk.NewAttribute("submitter", msg.Submitter),
		sdk.NewAttribute("data_type", msg.DataType.String()),
		sdk.NewAttribute("data_count", fmt.Sprintf("%d", len(msg.Items))),
		sdk.NewAttribute("merkle_root", msg.MerkleRoot),
	))

	return nil
}
