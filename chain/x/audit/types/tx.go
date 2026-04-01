package types

import "context"

// MsgServer defines the gRPC message server interface for the audit module.
type MsgServer interface {
	RecordAudit(context.Context, *MsgRecordAudit) (*MsgRecordAuditResponse, error)
}

type MsgRecordAuditResponse struct{}
