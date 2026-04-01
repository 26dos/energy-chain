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

// SubmitPrice handles a price submission from an authorized oracle node.
func (m *msgServer) SubmitPrice(goCtx context.Context, msg *types.MsgSubmitPrice) error {
	ctx := sdk.UnwrapSDKContext(goCtx)

	if !m.keeper.IsAuthorizedOracle(ctx, msg.Submitter, msg.DataType) {
		return fmt.Errorf("address %s is not an authorized oracle for data type %s",
			msg.Submitter, msg.DataType)
	}

	data := types.PriceData{
		DataType:    msg.DataType,
		Value:       msg.Value,
		Timestamp:   msg.Timestamp,
		Submitter:   msg.Submitter,
		BlockHeight: ctx.BlockHeight(),
	}

	m.keeper.SetPriceData(ctx, data)

	ctx.EventManager().EmitEvent(sdk.NewEvent(
		"oracle_price_submitted",
		sdk.NewAttribute("submitter", msg.Submitter),
		sdk.NewAttribute("data_type", msg.DataType.String()),
		sdk.NewAttribute("value", fmt.Sprintf("%d", msg.Value)),
		sdk.NewAttribute("timestamp", fmt.Sprintf("%d", msg.Timestamp)),
	))

	return nil
}

// AddOracle registers a new oracle node. Only callable by the governance authority.
func (m *msgServer) AddOracle(goCtx context.Context, msg *types.MsgAddOracle) error {
	ctx := sdk.UnwrapSDKContext(goCtx)

	if msg.Authority != m.keeper.GetAuthority() {
		return fmt.Errorf("unauthorized: expected %s, got %s", m.keeper.GetAuthority(), msg.Authority)
	}

	oracle := types.OracleInfo{
		Address:         msg.OracleAddress,
		Name:            msg.Name,
		Active:          true,
		AuthorizedTypes: msg.AuthorizedTypes,
	}

	m.keeper.AddOracle(ctx, oracle)

	ctx.EventManager().EmitEvent(sdk.NewEvent(
		"oracle_added",
		sdk.NewAttribute("address", msg.OracleAddress),
		sdk.NewAttribute("name", msg.Name),
	))

	return nil
}

// RemoveOracle deregisters an oracle node. Only callable by the governance authority.
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
