import { Request, Response } from 'express';
import { asyncHandler } from '@middleware/asyncHandler';
import { sendSuccess } from '@utils/response';
import { AppError } from '@utils/errors';

const REQUIRED_IDS = ['comp-001', 'comp-002', 'comp-003'];

// GET /api/dispatch — list dispatch documents (demo data)
export const listDispatchDocs = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, [
    {
      doc_id: 'doc-001',
      request_number: 'REQ-2026-002',
      asset_name: 'CV-1000-004',
      hospital: 'Northside Medical Centre',
      document_type: 'First_Request',
      status: 'Sent_to_Print',
      generated_at: '2026-05-17T08:00:00Z',
      pdf_blob_url: null,
    },
    {
      doc_id: 'doc-002',
      request_number: 'REQ-2026-007',
      asset_name: 'MAJ-971-007',
      hospital: 'Sunrise Health Center',
      document_type: 'First_Request',
      status: 'Signed',
      generated_at: '2026-05-16T14:30:00Z',
      pdf_blob_url: null,
    },
    {
      doc_id: 'doc-003',
      request_number: 'REQ-2026-005',
      asset_name: 'ME-411-003',
      hospital: 'Westgate Medical',
      document_type: 'Return_Receipt',
      status: 'Archived',
      generated_at: '2026-05-14T09:15:00Z',
      pdf_blob_url: null,
    },
  ]);
});

// POST /api/dispatch/documents
// Validates packing first; if incomplete returns 409 DISPATCH_BLOCKED.
// On success returns docId, pdfUrl, qrPayload and transitions deployment → In_Transit.
export const generateDispatchDocument = asyncHandler(async (req: Request, res: Response) => {
  const { deploymentId, packedItemIds } = req.body as {
    deploymentId?: string;
    packedItemIds?: string[];
  };
  if (!deploymentId) {
    throw AppError.badRequest('MISSING_FIELDS', 'deploymentId is required');
  }

  const packed = packedItemIds ?? [];
  const missingIds = REQUIRED_IDS.filter(id => !packed.includes(id));
  if (missingIds.length > 0) {
    const COMPONENT_NAMES: Record<string, string> = {
      'comp-001': 'Main Scope Unit',
      'comp-002': 'Light Source Cable',
      'comp-003': 'Cleaning Brush Kit',
    };
    res.status(409).json({
      success: false,
      error: {
        code: 'DISPATCH_BLOCKED',
        message: 'Cannot dispatch: required BOM items not packed',
        missingItems: missingIds.map(id => ({ component_id: id, name: COMPONENT_NAMES[id] ?? id })),
      },
    });
    return;
  }

  const docId = `doc-${Date.now()}`;
  sendSuccess(res, {
    docId,
    pdfUrl: `/api/dispatch/${docId}/pdf`,
    qrPayload: `OLYMPUS-${docId}-${deploymentId}`,
    status: 'Generated',
    deployment_status: 'In_Transit',
    asset_status: 'Dispatched',
    generated_at: new Date().toISOString(),
    message: 'Dispatch document generated. Deployment transitioned to In_Transit.',
  }, 201);
});
