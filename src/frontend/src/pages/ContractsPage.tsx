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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  Calendar,
  Folder,
  FolderOpen,
  MoreVertical,
  Plus,
  Train,
  Trash2,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { ContractResponse } from "../backend.d";
import { useActor } from "../hooks/useActor";

const SKELETON_KEYS = ["s1", "s2", "s3", "s4", "s5", "s6"];

function formatDate(nanoseconds: bigint): string {
  const ms = Number(nanoseconds / BigInt(1_000_000));
  return new Date(ms).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function ContractsPage() {
  const navigate = useNavigate();
  const { actor, isFetching } = useActor();

  const [contracts, setContracts] = useState<ContractResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [contractName, setContractName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ContractResponse | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [hoveredId, setHoveredId] = useState<bigint | null>(null);

  const fetchContracts = useCallback(async () => {
    if (!actor) return;
    try {
      setIsLoading(true);
      const result = await actor.getAllContracts();
      setContracts(result.sort((a, b) => Number(b.createdAt - a.createdAt)));
    } catch (err) {
      toast.error("Failed to load contracts");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [actor]);

  useEffect(() => {
    if (actor && !isFetching) {
      fetchContracts();
    }
  }, [actor, isFetching, fetchContracts]);

  async function handleCreate() {
    if (!actor || !contractName.trim()) return;
    setIsCreating(true);
    try {
      await actor.createContract(contractName.trim());
      toast.success(`Contract "${contractName.trim()}" created`);
      setContractName("");
      setCreateOpen(false);
      await fetchContracts();
    } catch (err) {
      toast.error("Failed to create contract");
      console.error(err);
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDelete() {
    if (!actor || !deleteTarget) return;
    setIsDeleting(true);
    try {
      await actor.deleteContract(deleteTarget.id);
      toast.success(`Contract "${deleteTarget.name}" deleted`);
      setDeleteTarget(null);
      setContracts((prev) => prev.filter((c) => c.id !== deleteTarget.id));
    } catch (err) {
      toast.error("Failed to delete contract");
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  }

  const containerVariants = {
    hidden: {},
    visible: {
      transition: { staggerChildren: 0.06 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
  };

  return (
    <div className="min-h-screen bg-background track-pattern">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-primary/20 flex items-center justify-center border border-primary/30">
              <Train className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h1 className="font-display font-bold text-lg leading-none text-foreground">
                Railway Contracts
              </h1>
              <p className="text-[11px] text-muted-foreground font-body mt-0.5">
                Business Expense Tracker
              </p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary/50 px-3 py-1.5 rounded-full border border-border">
              <Folder className="w-3 h-3" />
              {contracts.length} contract{contracts.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Page Title */}
        <div className="mb-8">
          <motion.h2
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
            className="font-display font-extrabold text-3xl sm:text-4xl text-foreground tracking-tight"
          >
            Your Contracts
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="text-muted-foreground font-body mt-1.5 text-sm"
          >
            Manage tender documents, bills, and site expenses for each contract
          </motion.p>
        </div>

        {/* Contract Grid */}
        {isLoading || isFetching ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {SKELETON_KEYS.map((k) => (
              <Skeleton key={k} className="h-[160px] rounded-xl bg-card" />
            ))}
          </div>
        ) : contracts.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center justify-center py-24 text-center"
          >
            <div className="w-20 h-20 rounded-2xl bg-secondary/60 border border-border flex items-center justify-center mb-6">
              <Folder className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="font-display font-bold text-xl text-foreground mb-2">
              No contracts yet
            </h3>
            <p className="text-muted-foreground text-sm max-w-xs font-body">
              Create your first contract to start tracking tender documents,
              bills, and expenses.
            </p>
            <Button
              className="mt-6 bg-primary text-primary-foreground hover:bg-primary/90 font-body font-semibold"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create First Contract
            </Button>
          </motion.div>
        ) : (
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <AnimatePresence>
              {contracts.map((contract) => (
                <motion.div
                  key={contract.id.toString()}
                  variants={itemVariants}
                  layout
                  exit={{
                    opacity: 0,
                    scale: 0.95,
                    transition: { duration: 0.2 },
                  }}
                >
                  <button
                    type="button"
                    className="relative group bg-card border border-border rounded-xl p-5 w-full text-left cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover hover:border-primary/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    style={{ boxShadow: "0 2px 12px -2px rgba(0,0,0,0.3)" }}
                    onClick={() =>
                      navigate({
                        to: "/contract/$id",
                        params: { id: contract.id.toString() },
                      })
                    }
                    onMouseEnter={() => setHoveredId(contract.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    {/* Folder Icon */}
                    <div className="mb-4">
                      <div className="w-12 h-12 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center transition-colors duration-200 group-hover:bg-primary/25 group-hover:border-primary/50">
                        {hoveredId === contract.id ? (
                          <FolderOpen className="w-6 h-6 text-primary" />
                        ) : (
                          <Folder className="w-6 h-6 text-primary" />
                        )}
                      </div>
                    </div>

                    {/* Contract Name */}
                    <h3 className="font-display font-bold text-base text-foreground leading-tight mb-2 pr-6 line-clamp-2">
                      {contract.name}
                    </h3>

                    {/* Date */}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      <span className="font-body">
                        {formatDate(contract.createdAt)}
                      </span>
                    </div>

                    {/* Subtle indicator bar */}
                    <div className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full bg-primary/0 group-hover:bg-primary/50 transition-all duration-300" />

                    {/* Kebab Menu */}
                    <div className="absolute top-3 right-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-secondary"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteTarget(contract)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </main>

      {/* FAB */}
      <motion.button
        type="button"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.3, type: "spring", stiffness: 260, damping: 20 }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setCreateOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-amber-glow flex items-center justify-center transition-shadow hover:shadow-[0_0_32px_oklch(0.62_0.18_44_/_50%)]"
        aria-label="Create new contract"
      >
        <Plus className="w-6 h-6 font-bold" strokeWidth={2.5} />
      </motion.button>

      {/* Create Contract Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md bg-popover border-border">
          <DialogHeader>
            <DialogTitle className="font-display font-bold text-xl text-foreground">
              New Contract
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Label
              htmlFor="contract-name"
              className="text-sm font-body font-medium text-foreground mb-2 block"
            >
              Contract Name
            </Label>
            <Input
              id="contract-name"
              placeholder="e.g. RVNL Station Renovation – Lucknow"
              value={contractName}
              onChange={(e) => setContractName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && contractName.trim()) handleCreate();
              }}
              className="bg-secondary border-border text-foreground placeholder:text-muted-foreground font-body"
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCreateOpen(false);
                setContractName("");
              }}
              className="font-body"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreate}
              disabled={!contractName.trim() || isCreating}
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-body font-semibold"
            >
              {isCreating ? (
                <>
                  <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  Creating…
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Contract
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent className="bg-popover border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display font-bold text-foreground flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Delete Contract
            </AlertDialogTitle>
            <AlertDialogDescription className="font-body text-muted-foreground">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-foreground">
                "{deleteTarget?.name}"
              </span>
              ? This will permanently remove all associated files and data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-body">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-body"
            >
              {isDeleting ? "Deleting…" : "Delete Contract"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-4 sm:px-6 py-6 mt-8 border-t border-border">
        <p className="text-xs text-muted-foreground text-center font-body">
          © {new Date().getFullYear()}. Built with ❤️ using{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground transition-colors"
          >
            caffeine.ai
          </a>
        </p>
      </footer>
    </div>
  );
}
