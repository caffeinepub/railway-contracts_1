# Railway Contracts

## Current State
Full-stack app with a Motoko backend (blob-storage, contract CRUD, 5 sections per contract) and a React/TypeScript frontend. The backend is stable and working. The frontend has:
- ContractsPage: list/create/delete contracts with FAB
- ContractDetailPage: 5 section cards + Expense Summary (site, material, grand total from xlsx)
- SectionDrawer: slide-in panel with file list, upload button, PDF preview (iframe), spreadsheet preview (xlsx only for expense sections), delete confirm

Previous issues: contract creation failed, section cards were not appearing inside contracts.

## Requested Changes (Diff)

### Add
- Ensure all 5 section folders are reliably visible on ContractDetailPage
- Ensure contract creation works reliably (actor ready before call)
- For non-expense sections (Tender Details, LOI, Running Bill): allow uploading xlsx, pdf, doc, docx with spreadsheet preview for xlsx files too
- PDF inline preview (iframe) works for all sections

### Modify
- SectionDrawer: show spreadsheet preview for ALL sections (not just expense), when an xlsx file is present
- Upload button stays as a small icon in the drawer header (keep current design)
- Expense Summary: totals calculated only from uploaded xlsx files, no extra buttons
- Contract detail page loads sections as static list (no backend call needed for section list)
- Remove any "summary buttons" that appeared in prior versions

### Remove
- Nothing to remove from the current clean state

## Implementation Plan
1. Fix ContractDetailPage to ensure all 5 sections render correctly as cards
2. Fix SectionDrawer to allow xlsx/pdf/doc/docx for ALL sections (not just expense sections)
3. Fix SectionDrawer spreadsheet preview to show for any section when an xlsx file is uploaded
4. Ensure actor is fully ready before createContract is called (handle isFetching guard correctly)
5. Keep PDF preview, upload icon button, and Expense Summary cards as-is
6. Validate and build
