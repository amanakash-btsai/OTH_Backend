# Dispatch Module

**Location:** `src/modules/dispatch/`  
**Base route:** `/api/dispatch`

---

## Overview

The Dispatch module orchestrates the full document generation flow: BOM validation → QR code generation → A4 PDF creation → Azure Blob upload → DB record → deployment status transition → print email queue → Teams notification.

---

## Files

| File | Purpose |
|------|---------|
| `dispatch.routes.ts` | Route registration with RBAC guards |
| `dispatch.controller.ts` | HTTP layer |
| `dispatch.service.ts` | Orchestration of 10-step document generation |
| `pdf.service.ts` | PDFKit A4 document layout and rendering |
| `qr.service.ts` | QR code generation (base64 PNG) |
| `dispatch.schema.ts` | Zod validation schemas |

---

## Routes (`dispatch.routes.ts`)

| Method | Path | Roles | Content-Type | Description |
|--------|------|-------|-------------|-------------|
| `POST` | `/documents` | EQC, MANAGER, ADMIN | JSON | Generate transport document (10-step flow) |
| `GET` | `/documents/:id` | Any authenticated | — | Get document details + SAS download URL |
| `POST` | `/documents/:id/sign` | EQC, MANAGER, ADMIN | `multipart/form-data` | Upload signed physical copy |
| `POST` | `/documents/:id/email` | EQC, MANAGER, ADMIN | JSON | Re-send print email to warehouse |

---

## Dispatch Service (`dispatch.service.ts`)

### `generateDocument(deploymentId, packedItemIds, userId)` — 10-step flow

```
Step 1:  Fetch deployment + BOM snapshot
Step 2:  Call bom.service.validatePacking(snapshotId, packedItemIds)
         → if isComplete = false → throw AppError.dispatchBlocked(missingItems)  [HARD STOP]
Step 3:  Generate document reference number via idGenerator.generateDocumentRef()
Step 4:  Call qr.service.generateQrCode(documentUrl) → base64 PNG
Step 5:  Call pdf.service.generateTransportPdf(deployment, snapshot, docRef, qrBase64) → Buffer
Step 6:  Call blob.service.uploadTransportDoc(buffer, docRef) → blob path
Step 7:  Create DispatchDocument record in DB with status: GENERATED
Step 8:  Call deployment.service.transitionStatus(deploymentId, 'IN_TRANSIT')
         (tandem: asset status → DEMO or LOANER)
Step 9:  Queue email job: emailQueue.add({ to: WAREHOUSE_PRINTER_EMAIL, attachment: pdf })
Step 10: Post Teams Adaptive Card to #eqc-ops-alerts (non-blocking)

Return: { docId, documentRef, pdfUrl (SAS, 1-hour expiry) }
```

**Critical:** Step 2 is the dispatch block. If any REQUIRED BOM item is missing, the entire flow stops and returns HTTP 409. There is no way to proceed without all required items.

### `uploadSignedCopy(docId, fileBuffer, mimeType, userId)`
1. Fetch `DispatchDocument` — validate it exists and is in `GENERATED` or `SENT` status
2. Call `blob.service.uploadSignedCopy(fileBuffer, docId)` → blob path
3. Update `DispatchDocument`: `signed_copy_url = blobPath`, `status = SIGNED`, `signed_at = now()`
4. Return updated document

### `emailToPrinter(docId)`
1. Fetch `DispatchDocument` + linked deployment
2. Generate fresh SAS URL for the PDF (1-hour expiry)
3. Add email job to `emailQueue` with PDF attachment
4. Update document status to `SENT`

---

## PDF Service (`pdf.service.ts`)

Generates an A4 transport document using PDFKit. Returns a `Buffer`.

### Document Layout

```
┌─────────────────────────────────────────────────────┐
│  [OTH Logo]    EQC Transport Document                │
│  Ref: DOC-20260509-A1B2C3D4   [QR Code PNG]         │
├─────────────────────────────────────────────────────┤
│  DEPLOYMENT DETAILS                                  │
│  ┌──────────────┬────────────────────────────────┐  │
│  │ Account      │ Bangkok General Hospital        │  │
│  │ Device       │ CF-HQ290L  SN: OLY-2024-0042   │  │
│  │ Type         │ DEMO                            │  │
│  │ Start Date   │ 9 พฤษภาคม 2569                  │  │
│  │ End Date     │ 16 พฤษภาคม 2569                 │  │
│  │ EQC Operator │ Somchai K.                      │  │
│  └──────────────┴────────────────────────────────┘  │
├─────────────────────────────────────────────────────┤
│  BOM CHECKLIST                                       │
│  ┌────────────────────────────┬───────┬───────────┐  │
│  │ Component                  │  Qty  │  Type     │  │
│  ├────────────────────────────┼───────┼───────────┤  │
│  │ ☐ Insertion Tube           │   1   │ REQUIRED  │  │
│  │ ☐ Control Body             │   1   │ REQUIRED  │  │
│  │ ☐ Biopsy Cap               │   2   │ REQUIRED  │  │
│  │ ☐ Water Bottle             │   1   │ OPTIONAL  │  │
│  └────────────────────────────┴───────┴───────────┘  │
├─────────────────────────────────────────────────────┤
│  SIGNATURE BLOCK                                     │
│                                                      │
│  Dispatched by: ___________________  Date: ________  │
│  Received by:   ___________________  Date: ________  │
└─────────────────────────────────────────────────────┘
```

### Implementation Notes
- Uses PDFKit's `doc.table()` or manual cell drawing for tables
- QR code embedded as base64 PNG: `doc.image(Buffer.from(qrBase64, 'base64'), x, y, { width: 80 })`
- Thai date formatting via `formatDateTH()` from `dateUtils`
- Font: Helvetica (built-in) for Latin; may need custom Thai font for Thai characters
- Returns `Buffer` — stored in Blob, attached to email, never written to disk

---

## QR Service (`qr.service.ts`)

```typescript
import QRCode from 'qrcode'

export const generateQrCode = async (url: string): Promise<string> => {
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: 'M',
    width: 200,
    margin: 1,
  })
}
```

The QR code URL encodes the document viewer URL: `https://app.eqc.olympus.th/documents/{docId}`. When scanned, it lets the hospital view the transport document and submit the signed copy.

---

## Dispatch Schema (`dispatch.schema.ts`)

```typescript
export const GenerateDocumentSchema = z.object({
  deployment_id: z.string().uuid(),
  packed_item_ids: z.array(z.string().uuid()),
})

export const UploadSignedCopySchema = z.object({
  // validated via multipart — file required in req.file
})
```

For the sign endpoint, use `multer` with `memoryStorage()` — the file is kept in memory as a `Buffer` and uploaded directly to Blob Storage. Accepted MIME types: `image/jpeg`, `image/png`, `application/pdf`.

---

## Azure Blob Storage Paths

| Container | Path Pattern | Notes |
|-----------|-------------|-------|
| `transport-docs` | `{year}/{month}/{docRef}.pdf` | Original generated PDF |
| `signed-copies` | `signed/{docId}/{timestamp}.{ext}` | Uploaded signed physical copy |

**Never store full URLs in the DB.** Store only the blob path. Generate SAS URLs on demand with 1-hour expiry when a user requests a download.

---

*Back to [CLAUDE.md](../CLAUDE.md)*
