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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertCircle,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  FileType,
  TableProperties,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ExternalBlob, type SectionType } from "../../backend";
import type { FileRef } from "../../backend";
import { useActor } from "../../hooks/useActor";
import {
  type SpreadsheetData,
  computeColumnTotals,
  findPrimaryAmountColumnIndex,
  parseXlsxFile,
  parseXlsxFromUrl,
} from "../../utils/xlsxLoader";

const FILE_SKELETON_KEYS = ["fsk1", "fsk2", "fsk3"];
const PREVIEW_SKELETON_KEYS = ["psk1", "psk2", "psk3", "psk4", "psk5", "psk6"];

interface SectionMeta {
  type: SectionType;
  label: string;
  description: string;
  icon: React.ReactNode;
  accentClass: string;
  borderHoverClass?: string;
  indicatorClass?: string;
  isExpense: boolean;
}

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

export { computeColumnTotals, findPrimaryAmountColumnIndex };

export default function SectionDrawer({ contractId, section, onClose }: Props) {
  const { actor } = useActor();

  const [files, setFiles] = useState<FileRef[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<FileRef | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [spreadsheetData, setSpreadsheetData] =
    useState<SpreadsheetData | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileRef | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const acceptedTypes = ".xlsx,.pdf,.doc,.docx";

  const fetchFiles = useCallback(async () => {
    if (!actor || !section) return;
    try {
      setIsLoadingFiles(true);
      const result = await actor.getSectionFiles(contractId, section.type);
      setFiles(result.sort((a, b) => Number(b.uploadedAt - a.uploadedAt)));
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
      setPreviewFile(null);
    }
  }, [section, actor, fetchFiles]);

  // Load spreadsheet preview for most recent xlsx
  useEffect(() => {
    if (files.length === 0) {
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
  }, [files]);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !actor || !section) return;

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const allowed = ["xlsx", "xls", "pdf", "doc", "docx"];

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
      // Parse xlsx preview immediately for all sections
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
        section.type,
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
        section.type,
        deleteTarget.fileId,
      );
      toast.success(`"${deleteTarget.filename}" removed`);
      setFiles((prev) => prev.filter((f) => f.fileId !== deleteTarget.fileId));
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
      a.download = fileRef.filename;
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
                className="shrink-0 h-9 w-9 hover:bg-secondary text-muted-foreground hover:text-primary transition-colors"
                aria-label="Upload file"
                title="Upload file"
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
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Upload Progress Bar */}
            {isUploading && (
              <div className="px-6 py-2 border-b border-border shrink-0 bg-secondary/30">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-muted-foreground font-body">
                    Uploading…
                  </span>
                  <span className="text-primary font-body font-semibold">
                    {uploadProgress}%
                  </span>
                </div>
                <Progress value={uploadProgress} className="h-1.5" />
              </div>
            )}

            {/* Scrollable Content */}
            <ScrollArea className="flex-1">
              <div className="px-6 py-4 space-y-5">
                {/* File List */}
                <div>
                  <h3 className="font-display font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-3">
                    Uploaded Files
                  </h3>

                  {isLoadingFiles ? (
                    <div className="space-y-3">
                      {FILE_SKELETON_KEYS.map((k) => (
                        <Skeleton key={k} className="h-16 rounded-lg bg-card" />
                      ))}
                    </div>
                  ) : files.length === 0 ? (
                    <div className="flex flex-col items-center py-10 text-center text-muted-foreground">
                      <AlertCircle className="w-8 h-8 mb-2 opacity-40" />
                      <p className="text-sm font-body">No files uploaded yet</p>
                      <p className="text-xs font-body mt-1 opacity-70">
                        Use the upload button in the top-right corner
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <AnimatePresence>
                        {files.map((fileRef) => (
                          <motion.div
                            key={fileRef.fileId}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ duration: 0.2 }}
                            className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-3 group hover:border-border/80 transition-colors"
                          >
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
                              {fileRef.fileType.toLowerCase() === "pdf" && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 hover:bg-secondary opacity-60 hover:opacity-100 text-muted-foreground hover:text-primary"
                                  onClick={() => setPreviewFile(fileRef)}
                                  aria-label={`Preview ${fileRef.filename}`}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                              )}
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-secondary opacity-60 hover:opacity-100"
                                onClick={() => handleDownload(fileRef)}
                                aria-label={`Download ${fileRef.filename}`}
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
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </div>

                {/* PDF Preview */}
                {previewFile && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-display font-semibold text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                        <FileType className="w-4 h-4 text-red-400" />
                        PDF Preview — {previewFile.filename}
                      </h3>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 hover:bg-secondary"
                        onClick={() => setPreviewFile(null)}
                        aria-label="Close PDF preview"
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <div
                      className="rounded-xl border border-border overflow-hidden bg-card"
                      style={{ height: "500px" }}
                    >
                      <iframe
                        src={previewFile.blob.getDirectURL()}
                        className="w-full h-full"
                        title={previewFile.filename}
                      />
                    </div>
                  </div>
                )}

                {/* Spreadsheet Preview */}
                <div>
                  <h3 className="font-display font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                    <TableProperties className="w-4 h-4" />
                    Spreadsheet Preview
                  </h3>

                  {isLoadingPreview ? (
                    <div className="space-y-2">
                      <Skeleton className="h-16 w-full rounded-xl bg-card mb-3" />
                      <Skeleton className="h-8 w-full rounded bg-card" />
                      {PREVIEW_SKELETON_KEYS.map((k) => (
                        <Skeleton
                          key={k}
                          className="h-6 w-full rounded bg-card"
                        />
                      ))}
                    </div>
                  ) : spreadsheetData ? (
                    <>
                      <div className="rounded-xl border border-border overflow-hidden bg-card">
                        <div className="bg-secondary/50 px-4 py-2.5 border-b border-border flex items-center gap-2">
                          <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span className="text-xs font-body font-medium text-muted-foreground">
                            Sheet 1 — {spreadsheetData.rows.length} rows
                          </span>
                        </div>
                        <div className="overflow-x-auto max-h-[400px] overflow-y-auto spreadsheet-preview">
                          {spreadsheetData.headers.length === 0 ? (
                            <div className="py-8 text-center text-sm text-muted-foreground font-body">
                              Spreadsheet appears to be empty
                            </div>
                          ) : (
                            (() => {
                              const colTotals =
                                computeColumnTotals(spreadsheetData);
                              return (
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
                                          {spreadsheetData.headers.map(
                                            (_, ci) => (
                                              // biome-ignore lint/suspicious/noArrayIndexKey: spreadsheet cells have no stable key
                                              <td key={ci}>
                                                {row[ci] != null
                                                  ? String(row[ci])
                                                  : ""}
                                              </td>
                                            ),
                                          )}
                                        </tr>
                                      ))}
                                    {spreadsheetData.rows.length > 100 && (
                                      <tr>
                                        <td
                                          colSpan={
                                            spreadsheetData.headers.length + 1
                                          }
                                          className="text-center text-xs text-muted-foreground py-3 font-body"
                                        >
                                          … and{" "}
                                          {spreadsheetData.rows.length - 100}{" "}
                                          more rows
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                  <tfoot>
                                    <tr className="spreadsheet-tfoot">
                                      <td className="text-center font-bold text-xs text-muted-foreground w-10">
                                        Σ
                                      </td>
                                      {colTotals.map((total, ci) => (
                                        // biome-ignore lint/suspicious/noArrayIndexKey: spreadsheet columns have no stable key
                                        <td key={ci} className="font-bold">
                                          {total !== null
                                            ? total.toLocaleString("en-IN", {
                                                maximumFractionDigits: 2,
                                              })
                                            : ""}
                                        </td>
                                      ))}
                                    </tr>
                                  </tfoot>
                                </table>
                              );
                            })()
                          )}
                        </div>
                      </div>
                    </>
                  ) : files.filter(
                      (f) =>
                        f.fileType.toLowerCase() === "xlsx" ||
                        f.fileType.toLowerCase() === "xls",
                    ).length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border py-10 text-center">
                      <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
                      <p className="text-sm font-body text-muted-foreground">
                        Upload an Excel file to see a live preview
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent className="bg-popover border-border z-[60]">
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
            <AlertDialogCancel className="font-body">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-body"
            >
              {isDeleting ? "Removing…" : "Remove File"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
