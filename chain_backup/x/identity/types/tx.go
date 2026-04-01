package types

import "context"

// MsgServer defines the gRPC message server interface for the identity module.
type MsgServer interface {
	RegisterIdentity(context.Context, *MsgRegisterIdentity) (*MsgRegisterIdentityResponse, error)
	UpdateIdentity(context.Context, *MsgUpdateIdentity) (*MsgUpdateIdentityResponse, error)
	RevokeIdentity(context.Context, *MsgRevokeIdentity) (*MsgRevokeIdentityResponse, error)
}

type MsgRegisterIdentityResponse struct{}
type MsgUpdateIdentityResponse struct{}
type MsgRevokeIdentityResponse struct{}
