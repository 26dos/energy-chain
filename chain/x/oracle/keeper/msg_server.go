package keeper

import (
	"context"
	"fmt"

	sdk "github.com/cosmos/cosmos-sdk/types"

	"energychain/x/oracle/types"
)

type msgServer struct {
	keeper Keeper
}

func NewMsgServerImpl(keeper Keeper) *msgServer {
	return &msgServer{keeper: keeper}
}

func (m *msgServer) SubmitData(goCtx context.Context, msg *types.MsgSubmitData) error {
	ctx := sdk.UnwrapSDKContext(goCtx)

	if !m.keeper.IsAuthorizedOracle(ctx, msg.Submitter, msg.Category) {
		return fmt.Errorf("address %s is not an authorized oracle for category %s",
			msg.Submitter, msg.Category)
	}

	data := types.OracleData{
		Category:    msg.Category,
		Value:       msg.Value,
		Metadata:    msg.Metadata,
		Timestamp:   msg.Timestamp,
		Submitter:   msg.Submitter,
		BlockHeight: ctx.BlockHeight(),
	}

	m.keeper.SetOracleData(ctx, data)

	ctx.EventManager().EmitEvent(sdk.NewEvent(
		"oracle_data_submitted",
		sdk.NewAttribute("submitter", msg.Submitter),
		sdk.NewAttribute("category", msg.Category),
		sdk.NewAttribute("timestamp", fmt.Sprintf("%d", msg.Timestamp)),
	))

	return nil
}

func (m *msgServer) AddOracle(goCtx context.Context, msg *types.MsgAddOracle) error {
	ctx := sdk.UnwrapSDKContext(goCtx)

	if msg.Authority != m.keeper.GetAuthority() {
		return fmt.Errorf("unauthorized: expected %s, got %s", m.keeper.GetAuthority(), msg.Authority)
	}

	oracle := types.OracleInfo{
		Address:              msg.OracleAddress,
		Name:                 msg.Name,
		Active:               true,
		AuthorizedCategories: msg.AuthorizedCategories,
	}

	m.keeper.AddOracle(ctx, oracle)

	ctx.EventManager().EmitEvent(sdk.NewEvent(
		"oracle_added",
		sdk.NewAttribute("address", msg.OracleAddress),
		sdk.NewAttribute("name", msg.Name),
	))

	return nil
}

func (m *msgServer) RemoveOracle(goCtx context.Context, msg *types.MsgRemoveOracle) error {
	ctx := sdk.UnwrapSDKContext(goCtx)

	if msg.Authority != m.keeper.GetAuthority() {
		return fmt.Errorf("unauthorized: expected %s, got %s", m.keeper.GetAuthority(), msg.Authority)
	}

	if _, found := m.keeper.GetOracle(ctx, msg.OracleAddress); !found {
		return fmt.Errorf("oracle not found: %s", msg.OracleAddress)
	}

	m.keeper.RemoveOracle(ctx, msg.OracleAddress)

	ctx.EventManager().EmitEvent(sdk.NewEvent(
		"oracle_removed",
		sdk.NewAttribute("address", msg.OracleAddress),
	))

	return nil
}
