package types

import "context"

type MsgServer interface {
	SubmitData(context.Context, *MsgSubmitData) (*MsgSubmitDataResponse, error)
	AddOracle(context.Context, *MsgAddOracle) (*MsgAddOracleResponse, error)
	RemoveOracle(context.Context, *MsgRemoveOracle) (*MsgRemoveOracleResponse, error)
}

type MsgSubmitDataResponse struct{}
type MsgAddOracleResponse struct{}
type MsgRemoveOracleResponse struct{}
