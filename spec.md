# Railway Contracts

## Current State
- ContractDetailPage shows an Expense Summary section with 3 cards (Site Expenses, Material Expenses, Grand Total). Each card currently has no action buttons.
- SectionDrawer shows a large dashed upload zone (full-width drag-and-drop area) at the top of the drawer.
- Non-expense sections (Tender Details, LOI, Running Bill) support xlsx/pdf/doc/docx uploads but PDFs only show in the file list with no preview.
- Expense sections show a spreadsheet preview for xlsx files.

## Requested Changes (Diff)

### Add
- PDF preview in SectionDrawer: when a file with type "pdf" is selected/clicked in the file list, show an inline `<iframe>` or `<embed>` preview below the file list using the file's direct URL. Should work for non-expense and expense sections alike.
- A small floating upload button (icon-only, positioned in the bottom-right corner of the drawer content area) to trigger the file input. Keep existing hidden `<input>` wired to it.

### Modify
- Replace the large full-width dashed upload zone with a small icon-only upload button placed in the top-right corner of the drawer header (next to the close button), so the header area is compact.
- The upload progress bar should appear inline in the header area or as a slim bar under the header when uploading.
- Remove the "Expense Summary" action buttons if any exist (there are none currently -- confirm no summary-related buttons are in ContractDetailPage and clean up if present).

### Remove
- The large dashed upload area block (`px-6 py-4 border-b border-border shrink-0` div containing the dashed button and progress bar) from SectionDrawer.

## Implementation Plan
1. In `SectionDrawer.tsx`:
   - Remove the large upload zone section (the `px-6 py-4 border-b` div).
   - Add a small Upload icon-button in the drawer header row (right side, before the close button).
   - When uploading, show a slim progress bar just below the header (replacing the old zone).
   - Add state `previewFile: FileRef | null` to track which file is being previewed.
   - In the file list, add a clickable "Preview" icon for PDF files (and xlsx already has spreadsheet preview). On click, set `previewFile`.
   - Below the file list, render a PDF preview panel: `<iframe src={url} />` with a close button when `previewFile` is a PDF.
   - The existing spreadsheet preview for expense sections remains unchanged.
2. In `ContractDetailPage.tsx`:
   - Verify no summary buttons exist (confirmed -- no changes needed there).
