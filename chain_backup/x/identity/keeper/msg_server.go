package keeper

import (
	"context"

	sdk "github.com/cosmos/cosmos-sdk/types"
	sdkerrors "github.com/cosmos/cosmos-sdk/types/errors"

	"energychain/x/identity/types"
)

type msgServer struct {
	Keeper
}

// NewMsgServerImpl returns an implementation of the identity MsgServer interface.
func NewMsgServerImpl(keeper Keeper) types.MsgServer {
	return &msgServer{Keeper: keeper}
}

var _ types.MsgServer = msgServer{}

// RegisterIdentity handles identity registration. Only the admin can register
// new identities.
func (m msgServer) RegisterIdentity(goCtx context.Context, msg *types.MsgRegisterIdentity) (*types.MsgRegisterIdentityResponse, error) {
	ctx := sdk.UnwrapSDKContext(goCtx)

	if msg.Creator != m.GetAuthority() {
		return nil, sdkerrors.ErrUnauthorized.Wrap("only the admin can register identities")
	}

	if m.IsRegistered(ctx, msg.Address) {
		return nil, sdkerrors.ErrInvalidRequest.Wrapf("identity already registered: %s", msg.Address)
	}

	identity := types.Identity{
		Address:      msg.Address,
		Name:         msg.Name,
		Role:         msg.Role,
		Status:       types.StatusActive,
		Metadata:     msg.Metadata,
		RegisteredAt: ctx.BlockTime().Unix(),
		UpdatedAt:    ctx.BlockTime().Unix(),
	}

	m.SetIdentity(ctx, identity)

	ctx.EventManager().EmitEvent(sdk.NewEvent(
		"identity_registered",
		sdk.NewAttribute("address", msg.Address),
		sdk.NewAttribute("role", msg.Role.String()),
		sdk.NewAttribute("name", msg.Name),
	))

	return &types.MsgRegisterIdentityResponse{}, nil
}

// UpdateIdentity handles identity updates. The admin or the identity owner
// can update name and metadata.
func (m msgServer) UpdateIdentity(goCtx context.Context, msg *types.MsgUpdateIdentity) (*types.MsgUpdateIdentityResponse, error) {
	ctx := sdk.UnwrapSDKContext(goCtx)

	identity, found := m.GetIdentity(ctx, msg.Address)
	if !found {
		return nil, sdkerrors.ErrNotFound.Wrapf("identity not found: %s", msg.Address)
	}

	isAdmin := msg.Creator == m.GetAuthority()
	isOwner := msg.Creator == msg.Address
	if !isAdmin && !isOwner {
		return nil, sdkerrors.ErrUnauthorized.Wrap("only admin or identity owner can update")
	}

	if msg.Name != "" {
		identity.Name = msg.Name
	}
	if msg.Metadata != "" {
		identity.Metadata = msg.Metadata
	}
	identity.UpdatedAt = ctx.BlockTime().Unix()

	m.SetIdentity(ctx, identity)

	ctx.EventManager().EmitEvent(sdk.NewEvent(
		"identity_updated",
		sdk.NewAttribute("address", msg.Address),
		sdk.NewAttribute("updated_by", msg.Creator),
	))

	return &types.MsgUpdateIdentityResponse{}, nil
}

// RevokeIdentity handles identity revocation. Only the admin can revoke.
func (m msgServer) RevokeIdentity(goCtx context.Context, msg *types.MsgRevokeIdentity) (*types.MsgRevokeIdentityResponse, error) {
	ctx := sdk.UnwrapSDKContext(goCtx)

	if msg.Creator != m.GetAuthority() {
		return nil, sdkerrors.ErrUnauthorized.Wrap("only the admin can revoke identities")
	}

	identity, found := m.GetIdentity(ctx, msg.Address)
	if !found {
		return nil, sdkerrors.ErrNotFound.Wrapf("identity not found: %s", msg.Address)
	}

	if identity.Status == types.StatusRevoked {
		return nil, sdkerrors.ErrInvalidRequest.Wrap("identity is already revoked")
	}

	identity.Status = types.StatusRevoked
	identity.UpdatedAt = ctx.BlockTime().Unix()

	m.SetIdentity(ctx, identity)

	ctx.EventManager().EmitEvent(sdk.NewEvent(
		"identity_revoked",
		sdk.NewAttribute("address", msg.Address),
		sdk.NewAttribute("reason", msg.Reason),
		sdk.NewAttribute("revoked_by", msg.Creator),
	))

	return &types.MsgRevokeIdentityResponse{}, nil
}
