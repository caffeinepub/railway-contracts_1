import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertCircle,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileSpreadsheet,
  FileText,
  FileType,
  Loader2,
  PencilLine,
  Plus,
  RotateCcw,
  Save,
  TableProperties,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ExternalBlob } from "../../backend";
import type { FileRef, backendInterface } from "../../backend";
import { useIsMobile } from "../../hooks/use-mobile";
import { useActor } from "../../hooks/useActor";
import type { SectionMeta } from "../../pages/ContractDetailPage";
import {
  type SpreadsheetData,
  parseXlsxFile,
  parseXlsxFromUrl,
} from "../../utils/xlsxParser";

const FILE_SKELETON_KEYS = ["fsk1", "fsk2", "fsk3"];
const PREVIEW_SKELETON_KEYS = ["psk1", "psk2", "psk3", "psk4", "psk5", "psk6"];

interface Props {
  contractId: bigint;
  section: SectionMeta | null;
  onClose: () => void;
}

function formatDate(nanoseconds: bigint): string {
  const ms = Number(nanoseconds / BigInt(1_000_000));
  return new Date(ms).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getFileIcon(fileType: string) {
  const ext = fileType.toLowerCase();
  if (ext === "xlsx" || ext === "xls" || ext === "csv") {
    return <FileSpreadsheet className="w-4 h-4 text-emerald-400" />;
  }
  if (ext === "pdf") {
    return <FileType className="w-4 h-4 text-red-400" />;
  }
  return <FileText className="w-4 h-4 text-blue-400" />;
}

function getFileTypeBadgeClass(fileType: string): string {
  const ext = fileType.toLowerCase();
  if (ext === "xlsx" || ext === "xls") {
    return "bg-emerald-500/15 text-emerald-400 border-emerald-500/25";
  }
  if (ext === "pdf") {
    return "bg-red-500/15 text-red-400 border-red-500/25";
  }
  if (ext === "doc" || ext === "docx") {
    return "bg-blue-500/15 text-blue-400 border-blue-500/25";
  }
  return "bg-muted text-muted-foreground border-border";
}

// ─── Manual Entry Table ───────────────────────────────────────────────────────

const DEFAULT_HEADERS = [
  "Description",
  "Quantity",
  "Unit Price",
  "Amount",
  "Notes",
];
const DEFAULT_ROW_COUNT = 10;

function createEmptyRow(colCount: number): string[] {
  return Array.from({ length: colCount }, () => "");
}

interface ManualEntryTableProps {
  initialHeaders?: string[];
  initialRows?: string[][];
  isSaving: boolean;
  onSave: (headers: string[], rows: string[][]) => Promise<void>;
}

function ManualEntryTable({
  initialHeaders,
  initialRows,
  isSaving,
  onSave,
}: ManualEntryTableProps) {
  const [headers, setHeaders] = useState<string[]>(
    () => initialHeaders ?? [...DEFAULT_HEADERS],
  );
  const [rows, setRows] = useState<string[][]>(
    () =>
      initialRows ??
      Array.from({ length: DEFAULT_ROW_COUNT }, () =>
        createEmptyRow(DEFAULT_HEADERS.length),
      ),
  );

  function updateHeader(colIdx: number, value: string) {
    setHeaders((prev) => {
      const next = [...prev];
      next[colIdx] = value;
      return next;
    });
  }

  function updateCell(rowIdx: number, colIdx: number, value: string) {
    setRows((prev) => {
      const next = prev.map((r) => [...r]);
      next[rowIdx][colIdx] = value;
      return next;
    });
  }

  function addRow() {
    setRows((prev) => [...prev, createEmptyRow(headers.length)]);
  }

  function insertRowAfter(rowIdx: number) {
    setRows((prev) => {
      const next = [...prev];
      next.splice(rowIdx + 1, 0, createEmptyRow(headers.length));
      return next;
    });
  }

  function addColumn() {
    const newColName = `Col ${headers.length + 1}`;
    setHeaders((prev) => [...prev, newColName]);
    setRows((prev) => prev.map((row) => [...row, ""]));
  }

  function insertColumnAfter(colIdx: number) {
    const newColName = `Col ${headers.length + 1}`;
    setHeaders((prev) => {
      const next = [...prev];
      next.splice(colIdx + 1, 0, newColName);
      return next;
    });
    setRows((prev) =>
      prev.map((row) => {
        const next = [...row];
        next.splice(colIdx + 1, 0, "");
        return next;
      }),
    );
  }

  function clearAll() {
    setHeaders([...DEFAULT_HEADERS]);
    setRows(
      Array.from({ length: DEFAULT_ROW_COUNT }, () =>
        createEmptyRow(DEFAULT_HEADERS.length),
      ),
    );
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden bg-card">
      {/* Section header bar */}
      <div className="bg-secondary/50 px-4 py-2.5 border-b border-border flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <PencilLine className="w-4 h-4 text-primary shrink-0" />
          <span className="text-xs font-body font-semibold text-foreground">
            Manual Entry
          </span>
          <span className="text-xs text-muted-foreground font-body">
            — editable scratch pad
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onSave(headers, rows)}
            disabled={isSaving}
            className="h-7 px-2 text-xs gap-1.5 text-primary hover:bg-primary/10"
            data-ocid="manual-entry.save_button"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save className="w-3 h-3" />
                Save
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-1.5"
            data-ocid="manual-entry.delete_button"
          >
            <RotateCcw className="w-3 h-3" />
            Clear All
          </Button>
        </div>
      </div>

      {/* Table */}
      <div
        className="spreadsheet-preview"
        style={{ overflowX: "auto", overflowY: "auto", maxHeight: "400px" }}
      >
        <table className="manual-entry-table">
          <thead>
            <tr>
              {/* Empty corner cell for the row-# column */}
              <th className="text-muted-foreground w-10 text-center text-xs">
                #
              </th>
              {headers.map((h, ci) => (
                <th // biome-ignore lint/suspicious/noArrayIndexKey: header columns have no stable key
                  key={ci}
                  className="min-w-[130px] group/col relative"
                  style={{ position: "relative" }}
                >
                  <input
                    type="text"
                    value={h}
                    onChange={(e) => updateHeader(ci, e.target.value)}
                    className="w-full bg-transparent border-none outline-none text-xs font-semibold text-secondary-foreground placeholder:text-muted-foreground/60 focus:text-foreground transition-colors pr-6"
                    placeholder={`Col ${ci + 1}`}
                    aria-label={`Column ${ci + 1} header`}
                  />
                  {/* Insert column after this column — visible on header hover */}
                  <button
                    type="button"
                    onClick={() => insertColumnAfter(ci)}
                    aria-label={`Insert column after column ${ci + 1}`}
                    data-ocid="manual-entry.secondary_button"
                    title="Insert column after"
                    className="absolute right-0 top-1/2 -translate-y-1/2 h-5 w-5 rounded flex items-center justify-center opacity-0 group-hover/col:opacity-100 transition-opacity bg-primary/10 hover:bg-primary/20 text-primary z-10"
                    style={{ padding: 0 }}
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: rows have no stable key
              <tr key={ri} className="group/row">
                {/* Row number cell with insert-row-after affordance */}
                <td className="text-muted-foreground text-center text-xs w-10 select-none relative">
                  <span className="group-hover/row:opacity-0 transition-opacity">
                    {ri + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => insertRowAfter(ri)}
                    aria-label={`Insert row after row ${ri + 1}`}
                    data-ocid="manual-entry.toggle"
                    title="Insert row after"
                    className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity text-primary hover:bg-primary/10 rounded"
                    style={{ padding: 0 }}
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </td>
                {headers.map((_, ci) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: cells have no stable key
                  <td key={ci} className="p-0">
                    <input
                      type="text"
                      value={row[ci] ?? ""}
                      onChange={(e) => updateCell(ri, ci, e.target.value)}
                      className="w-full h-full bg-transparent border-none outline-none text-xs text-foreground placeholder:text-muted-foreground/30 px-[10px] py-[5px] focus:bg-primary/5 transition-colors"
                      placeholder="—"
                      aria-label={`Row ${ri + 1}, ${headers[ci] || `Col ${ci + 1}`}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer: Add Row + Add Column */}
      <div className="border-t border-border px-3 py-2 flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={addRow}
          className="h-7 px-2 text-xs text-muted-foreground hover:text-primary hover:bg-primary/10 gap-1.5"
          data-ocid="manual-entry.primary_button"
        >
          <Plus className="w-3 h-3" />
          Add Row
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={addColumn}
          className="h-7 px-2 text-xs text-muted-foreground hover:text-primary hover:bg-primary/10 gap-1.5"
          data-ocid="manual-entry.edit_button"
        >
          <Plus className="w-3 h-3" />
          Add Column
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function SectionDrawer({ contractId, section, onClose }: Props) {
  const { actor: rawActor } = useActor();
  const actor = rawActor as backendInterface | null;
  const isMobile = useIsMobile();

  const [files, setFiles] = useState<FileRef[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<FileRef | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [spreadsheetData, setSpreadsheetData] =
    useState<SpreadsheetData | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Notes
  const [notes, setNotes] = useState("");
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const notesAutoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // PDF preview
  const [pdfPreviewFileId, setPdfPreviewFileId] = useState<string | null>(null);
  const [pdfObjectUrls, setPdfObjectUrls] = useState<Record<string, string>>(
    {},
  );
  const pdfObjectUrlsRef = useRef<Record<string, string>>({});

  // Manual entry persistence
  const [manualEntryData, setManualEntryData] = useState<{
    headers: string[];
    rows: string[][];
  } | null>(null);
  const [isLoadingManualEntry, setIsLoadingManualEntry] = useState(false);
  const [isSavingManualEntry, setIsSavingManualEntry] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // All sections now accept all file types for upload
  const acceptedTypes = ".xlsx,.pdf,.doc,.docx";

  const fetchFiles = useCallback(async () => {
    if (!actor || !section) return;
    try {
      setIsLoadingFiles(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await actor.getSectionFiles(
        contractId,
        section.type as any,
      );
      const { files: fetchedFiles, notes: fetchedNotes } = result;
      setFiles(
        fetchedFiles.sort((a, b) => Number(b.uploadedAt - a.uploadedAt)),
      );
      setNotes(fetchedNotes ?? "");
    } catch (err) {
      toast.error("Failed to load files");
      console.error(err);
    } finally {
      setIsLoadingFiles(false);
    }
  }, [actor, contractId, section]);

  useEffect(() => {
    if (section && actor) {
      fetchFiles();
      setSpreadsheetData(null);
      setPdfPreviewFileId(null);
      setManualEntryData(null);

      if (section.isExpense) {
        setIsLoadingManualEntry(true);
        actor
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .getManualEntry(contractId, section.type as any)
          .then((data) => setManualEntryData(data ?? null))
          .catch(() => {})
          .finally(() => setIsLoadingManualEntry(false));
      }
    }
  }, [section, actor, fetchFiles, contractId]);

  // Load spreadsheet preview for most recent xlsx (all sections)
  useEffect(() => {
    if (!section || files.length === 0) {
      setSpreadsheetData(null);
      return;
    }

    const xlsxFiles = files.filter(
      (f) =>
        f.fileType.toLowerCase() === "xlsx" ||
        f.fileType.toLowerCase() === "xls",
    );
    if (xlsxFiles.length === 0) {
      setSpreadsheetData(null);
      return;
    }

    const mostRecent = xlsxFiles[0]; // Already sorted by uploadedAt desc
    setIsLoadingPreview(true);

    const url = mostRecent.blob.getDirectURL();
    parseXlsxFromUrl(url)
      .then((data) => setSpreadsheetData(data))
      .catch((err) => {
        console.error("Failed to parse spreadsheet:", err);
        toast.error("Could not load spreadsheet preview");
        setSpreadsheetData(null);
      })
      .finally(() => setIsLoadingPreview(false));
  }, [files, section]);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !actor || !section) return;

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const allowed = ["xlsx", "pdf", "doc", "docx"];

    if (!allowed.includes(ext)) {
      toast.error(`Invalid file type. Allowed: ${allowed.join(", ")}`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast.error("File too large. Maximum size is 50 MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Parse xlsx preview immediately
      if (ext === "xlsx" || ext === "xls") {
        setIsLoadingPreview(true);
        try {
          const preview = await parseXlsxFile(file);
          setSpreadsheetData(preview);
        } catch {
          // Preview will be loaded from URL after upload
        } finally {
          setIsLoadingPreview(false);
        }
      }

      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      const blob = ExternalBlob.fromBytes(bytes).withUploadProgress((pct) => {
        setUploadProgress(pct);
      });

      const fileId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      await actor.addFileToSection(
        contractId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        section.type as any,
        fileId,
        blob,
        file.name,
        ext,
      );

      toast.success(`"${file.name}" uploaded successfully`);
      await fetchFiles();
    } catch (err) {
      toast.error("Failed to upload file");
      console.error(err);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete() {
    if (!actor || !deleteTarget || !section) return;
    setIsDeleting(true);
    try {
      await actor.removeFileFromSection(
        contractId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        section.type as any,
        deleteTarget.fileId,
      );
      toast.success(`"${deleteTarget.filename}" removed`);
      setFiles((prev) => prev.filter((f) => f.fileId !== deleteTarget.fileId));
      if (pdfPreviewFileId === deleteTarget.fileId) {
        setPdfPreviewFileId(null);
      }
      setDeleteTarget(null);
    } catch (err) {
      toast.error("Failed to delete file");
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  }

  function handleDownload(fileRef: FileRef) {
    try {
      const url = fileRef.blob.getDirectURL();
      const a = document.createElement("a");
      a.href = url;

      // For Excel files, always force .xlsx extension
      const ext = fileRef.fileType.toLowerCase();
      if (ext === "xlsx" || ext === "xls") {
        const baseName = fileRef.filename.replace(/\.[^/.]+$/, "");
        a.download = `${baseName}.xlsx`;
      } else {
        a.download = fileRef.filename;
      }

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      toast.error("Failed to download file");
    }
  }

  function triggerFileInput() {
    fileInputRef.current?.click();
  }

  async function saveNotes() {
    if (!actor || !section) return;
    setIsSavingNotes(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await actor.updateSectionNotes(contractId, section.type as any, notes);
      toast.success("Notes saved");
    } catch (err) {
      toast.error("Failed to save notes");
      console.error(err);
    } finally {
      setIsSavingNotes(false);
    }
  }

  function handleNotesBlur() {
    // Auto-save on blur with debounce
    if (notesAutoSaveTimer.current) {
      clearTimeout(notesAutoSaveTimer.current);
    }
    notesAutoSaveTimer.current = setTimeout(() => {
      saveNotes();
    }, 800);
  }

  async function handleSaveManualEntry(headers: string[], rows: string[][]) {
    if (!actor || !section) return;
    setIsSavingManualEntry(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await actor.saveManualEntry(
        contractId,
        section.type as any,
        headers,
        rows,
      );
      toast.success("Manual entry saved");
    } catch (err) {
      toast.error("Failed to save manual entry");
      console.error(err);
    } finally {
      setIsSavingManualEntry(false);
    }
  }

  // Cleanup object URLs when drawer closes or section changes
  useEffect(() => {
    return () => {
      for (const url of Object.values(pdfObjectUrlsRef.current)) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  async function togglePdfPreview(fileRef: FileRef) {
    const fileId = fileRef.fileId;
    if (pdfPreviewFileId === fileId) {
      setPdfPreviewFileId(null);
      return;
    }
    // If we already have an object URL for this file, just show it
    if (pdfObjectUrls[fileId]) {
      setPdfPreviewFileId(fileId);
      return;
    }
    // Fetch the PDF bytes and create a local object URL
    try {
      const rawUrl = fileRef.blob.getDirectURL();
      const response = await fetch(rawUrl);
      const arrayBuffer = await response.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: "application/pdf" });
      const objectUrl = URL.createObjectURL(blob);
      pdfObjectUrlsRef.current[fileId] = objectUrl;
      setPdfObjectUrls((prev) => ({ ...prev, [fileId]: objectUrl }));
      setPdfPreviewFileId(fileId);
    } catch {
      toast.error("Failed to load PDF preview");
    }
  }

  const isOpen = !!section;

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      {/* Drawer */}
      <AnimatePresence>
        {isOpen && section && (
          <motion.div
            key="drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 35 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-2xl bg-popover border-l border-border flex flex-col shadow-2xl"
            data-ocid="section.sheet"
          >
            {/* Drawer Header */}
            <div className="flex items-center gap-3 px-6 py-5 border-b border-border shrink-0">
              <div
                className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 ${section.accentClass}`}
              >
                {section.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-display font-bold text-lg text-foreground leading-tight">
                  {section.label}
                </h2>
                <p className="text-xs text-muted-foreground font-body mt-0.5 truncate">
                  {section.description}
                </p>
              </div>

              {/* Upload button (small, in header) */}
              <input
                ref={fileInputRef}
                type="file"
                accept={acceptedTypes}
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={triggerFileInput}
                disabled={isUploading}
                className="shrink-0 h-9 w-9 hover:bg-primary/15 hover:text-primary"
                aria-label="Upload file"
                title="Upload file"
                data-ocid="section.upload_button"
              >
                <Upload className="w-4 h-4" />
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="shrink-0 h-9 w-9 hover:bg-secondary"
                aria-label="Close panel"
                data-ocid="section.close_button"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Upload Progress Bar (shown when uploading) */}
            {isUploading && (
              <div className="px-6 py-3 border-b border-border shrink-0 bg-secondary/30">
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="text-muted-foreground font-body text-xs">
                    Uploading…
                  </span>
                  <span className="text-primary font-body font-semibold text-xs">
                    {uploadProgress}%
                  </span>
                </div>
                <Progress value={uploadProgress} className="h-1.5" />
              </div>
            )}

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto">
              <div className="px-6 py-4 space-y-5">
                {/* ── Notes Section ───────────────────────────────────── */}
                <div>
                  <h3 className="font-display font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                    <PencilLine className="w-4 h-4" />
                    Notes
                  </h3>
                  <div className="space-y-2">
                    <Textarea
                      placeholder="Add notes for this section…"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      onBlur={handleNotesBlur}
                      className="bg-card border-border text-foreground placeholder:text-muted-foreground font-body text-sm min-h-[80px] resize-none focus:ring-1 focus:ring-primary/40"
                      data-ocid="section.notes.textarea"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={saveNotes}
                      disabled={isSavingNotes}
                      className="h-8 px-3 text-xs font-body border-border hover:border-primary/40 hover:bg-primary/10 hover:text-primary gap-1.5"
                      data-ocid="section.notes.save_button"
                    >
                      {isSavingNotes ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Saving…
                        </>
                      ) : (
                        <>
                          <Save className="w-3 h-3" />
                          Save Notes
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* ── File List ───────────────────────────────────────── */}
                <div>
                  <h3 className="font-display font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-3">
                    Uploaded Files
                  </h3>

                  {isLoadingFiles ? (
                    <div
                      className="space-y-3"
                      data-ocid="section.loading_state"
                    >
                      {FILE_SKELETON_KEYS.map((k) => (
                        <Skeleton key={k} className="h-16 rounded-lg bg-card" />
                      ))}
                    </div>
                  ) : files.length === 0 ? (
                    <div
                      className="flex flex-col items-center py-10 text-center text-muted-foreground"
                      data-ocid="section.empty_state"
                    >
                      <AlertCircle className="w-8 h-8 mb-2 opacity-40" />
                      <p className="text-sm font-body">No files uploaded yet</p>
                      <p className="text-xs font-body mt-1 opacity-70">
                        Click the upload icon in the header to add files
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <AnimatePresence>
                        {files.map((fileRef, fileIdx) => {
                          const isPdf =
                            fileRef.fileType.toLowerCase() === "pdf";
                          const isPdfPreviewOpen =
                            pdfPreviewFileId === fileRef.fileId;

                          return (
                            <motion.div
                              key={fileRef.fileId}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, x: 20 }}
                              transition={{ duration: 0.2 }}
                              data-ocid={`section.files.item.${fileIdx + 1}`}
                            >
                              <div className="rounded-lg border border-border overflow-hidden">
                                <div className="flex items-center gap-3 bg-card px-4 py-3 group hover:border-border/80 transition-colors">
                                  <div className="shrink-0">
                                    {getFileIcon(fileRef.fileType)}
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-body font-medium text-foreground truncate">
                                      {fileRef.filename}
                                    </p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span
                                        className={`text-[10px] font-cabinet font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${getFileTypeBadgeClass(fileRef.fileType)}`}
                                      >
                                        {fileRef.fileType.toUpperCase()}
                                      </span>
                                      <span className="text-xs text-muted-foreground font-body">
                                        {formatDate(fileRef.uploadedAt)}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0">
                                    {/* PDF eye toggle */}
                                    {isPdf && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className={`h-8 w-8 transition-opacity ${isPdfPreviewOpen ? "opacity-100 text-primary" : "opacity-60 hover:opacity-100"} hover:bg-secondary`}
                                        onClick={() =>
                                          togglePdfPreview(fileRef)
                                        }
                                        aria-label={
                                          isPdfPreviewOpen
                                            ? "Hide PDF preview"
                                            : "Preview PDF"
                                        }
                                        data-ocid={`section.files.toggle.${fileIdx + 1}`}
                                      >
                                        {isPdfPreviewOpen ? (
                                          <EyeOff className="w-4 h-4" />
                                        ) : (
                                          <Eye className="w-4 h-4" />
                                        )}
                                      </Button>
                                    )}

                                    {/* Open in Excel button for xlsx/xls */}
                                    {(fileRef.fileType.toLowerCase() ===
                                      "xlsx" ||
                                      fileRef.fileType.toLowerCase() ===
                                        "xls") && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 px-2 text-xs gap-1 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 opacity-70 hover:opacity-100"
                                        onClick={() => {
                                          const url =
                                            fileRef.blob.getDirectURL();
                                          window.open(url, "_blank");
                                        }}
                                        aria-label="Open in Excel"
                                        title="Open in Excel"
                                        data-ocid={`section.files.open_modal_button.${fileIdx + 1}`}
                                      >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                        <span className="hidden sm:inline">
                                          Excel
                                        </span>
                                      </Button>
                                    )}

                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 hover:bg-secondary opacity-60 hover:opacity-100"
                                      onClick={() => handleDownload(fileRef)}
                                      aria-label={`Download ${fileRef.filename}`}
                                      data-ocid={`section.files.button.${fileIdx + 1}`}
                                    >
                                      <Download className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 hover:bg-destructive/15 text-muted-foreground hover:text-destructive opacity-60 hover:opacity-100"
                                      onClick={() => setDeleteTarget(fileRef)}
                                      aria-label={`Delete ${fileRef.filename}`}
                                      data-ocid={`section.files.delete_button.${fileIdx + 1}`}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </div>

                                {/* PDF Inline Preview */}
                                <AnimatePresence>
                                  {isPdf && isPdfPreviewOpen && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{
                                        height: isMobile ? "auto" : "620px",
                                        opacity: 1,
                                      }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={{
                                        duration: 0.3,
                                        ease: "easeInOut",
                                      }}
                                      className="overflow-hidden border-t border-border"
                                      data-ocid={`section.pdf.panel.${fileIdx + 1}`}
                                    >
                                      {/* Open in new tab button — always visible */}
                                      <div className="flex items-center justify-between px-4 py-2 bg-secondary/40 border-b border-border">
                                        <span className="text-xs text-muted-foreground font-body">
                                          {isMobile
                                            ? "PDF preview — tap to open full screen"
                                            : "PDF preview — scroll to read"}
                                        </span>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          className="h-7 px-2 text-xs gap-1.5 text-primary hover:bg-primary/10"
                                          onClick={() => {
                                            const url =
                                              pdfObjectUrls[fileRef.fileId];
                                            if (url) window.open(url, "_blank");
                                          }}
                                          aria-label="Open PDF in new tab"
                                          data-ocid={`section.pdf.button.${fileIdx + 1}`}
                                        >
                                          <ExternalLink className="w-3.5 h-3.5" />
                                          Open full screen
                                        </Button>
                                      </div>

                                      {isMobile ? (
                                        /* Mobile: tap-to-open card — iframes don't work on iOS/Android */
                                        <div className="px-4 py-6 flex flex-col items-center gap-4 bg-secondary/20">
                                          <div className="w-16 h-16 rounded-2xl bg-red-500/15 border border-red-500/25 flex items-center justify-center">
                                            <FileType className="w-8 h-8 text-red-400" />
                                          </div>
                                          <div className="text-center">
                                            <p className="text-sm font-body font-semibold text-foreground">
                                              {fileRef.filename}
                                            </p>
                                            <p className="text-xs text-muted-foreground font-body mt-1">
                                              PDF documents open in your
                                              browser's built-in viewer
                                            </p>
                                          </div>
                                          <Button
                                            type="button"
                                            className="gap-2 bg-red-500 hover:bg-red-600 text-white font-body"
                                            onClick={() => {
                                              const url =
                                                pdfObjectUrls[fileRef.fileId];
                                              if (url)
                                                window.open(url, "_blank");
                                            }}
                                            data-ocid={`section.pdf.primary_button.${fileIdx + 1}`}
                                          >
                                            <Eye className="w-4 h-4" />
                                            Tap to View PDF
                                          </Button>
                                        </div>
                                      ) : (
                                        /* Desktop: full iframe embed */
                                        <iframe
                                          src={
                                            pdfObjectUrls[fileRef.fileId] ?? ""
                                          }
                                          className="w-full bg-secondary/20"
                                          style={{
                                            height: "580px",
                                            border: "none",
                                            display: "block",
                                          }}
                                          title={fileRef.filename}
                                        />
                                      )}
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </div>
                  )}
                </div>

                {/* ── Spreadsheet Preview (all sections with xlsx) ───── */}
                <div>
                  <h3 className="font-display font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                    <TableProperties className="w-4 h-4" />
                    Spreadsheet Preview
                  </h3>

                  {isLoadingPreview ? (
                    <div
                      className="space-y-2"
                      data-ocid="section.spreadsheet.loading_state"
                    >
                      <Skeleton className="h-8 w-full rounded bg-card" />
                      {PREVIEW_SKELETON_KEYS.map((k) => (
                        <Skeleton
                          key={k}
                          className="h-6 w-full rounded bg-card"
                        />
                      ))}
                    </div>
                  ) : spreadsheetData ? (
                    <div className="rounded-xl border border-border overflow-hidden bg-card">
                      <div className="bg-secondary/50 px-4 py-2.5 border-b border-border flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="text-xs font-body font-medium text-muted-foreground">
                          Sheet 1 — {spreadsheetData.rows.length} rows
                        </span>
                      </div>
                      <div
                        className="spreadsheet-preview"
                        style={{
                          overflowX: "auto",
                          overflowY: "auto",
                          maxHeight: "400px",
                        }}
                      >
                        {spreadsheetData.headers.length === 0 ? (
                          <div className="py-8 text-center text-sm text-muted-foreground font-body">
                            Spreadsheet appears to be empty
                          </div>
                        ) : (
                          <table>
                            <thead>
                              <tr>
                                <th className="text-muted-foreground w-10 text-center">
                                  #
                                </th>
                                {spreadsheetData.headers.map((h, i) => (
                                  // biome-ignore lint/suspicious/noArrayIndexKey: spreadsheet columns have no stable key
                                  <th key={i}>{h || `Col ${i + 1}`}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {spreadsheetData.rows
                                .slice(0, 100)
                                .map((row, ri) => (
                                  // biome-ignore lint/suspicious/noArrayIndexKey: spreadsheet rows have no stable key
                                  <tr key={ri}>
                                    <td className="text-muted-foreground text-center text-xs w-10">
                                      {ri + 1}
                                    </td>
                                    {spreadsheetData.headers.map((_, ci) => (
                                      // biome-ignore lint/suspicious/noArrayIndexKey: spreadsheet cells have no stable key
                                      <td key={ci}>
                                        {row[ci] != null ? String(row[ci]) : ""}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              {spreadsheetData.rows.length > 100 && (
                                <tr>
                                  <td
                                    colSpan={spreadsheetData.headers.length + 1}
                                    className="text-center text-xs text-muted-foreground py-3 font-body"
                                  >
                                    … and {spreadsheetData.rows.length - 100}{" "}
                                    more rows
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border py-10 text-center">
                      <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
                      <p className="text-sm font-body text-muted-foreground">
                        Upload an Excel file to see a live preview
                      </p>
                    </div>
                  )}
                </div>

                {/* ── Manual Entry Table (expense sections only) ──────── */}
                {section.isExpense && (
                  <div>
                    <h3 className="font-display font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                      <PencilLine className="w-4 h-4" />
                      Quick Entry Table
                    </h3>
                    {isLoadingManualEntry ? (
                      <div
                        className="space-y-2"
                        data-ocid="manual-entry.loading_state"
                      >
                        <Skeleton className="h-10 w-full rounded bg-card" />
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Skeleton
                            key={i}
                            className="h-7 w-full rounded bg-card"
                          />
                        ))}
                      </div>
                    ) : (
                      <ManualEntryTable
                        key={section.key}
                        initialHeaders={manualEntryData?.headers}
                        initialRows={manualEntryData?.rows}
                        isSaving={isSavingManualEntry}
                        onSave={handleSaveManualEntry}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent
          className="bg-popover border-border z-[60]"
          data-ocid="section.delete.dialog"
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display font-bold text-foreground">
              Remove File
            </AlertDialogTitle>
            <AlertDialogDescription className="font-body text-muted-foreground">
              Remove{" "}
              <span className="font-semibold text-foreground">
                "{deleteTarget?.filename}"
              </span>{" "}
              from this section? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="font-body"
              data-ocid="section.delete.cancel_button"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-body"
              data-ocid="section.delete.confirm_button"
            >
              {isDeleting ? "Removing…" : "Remove File"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
