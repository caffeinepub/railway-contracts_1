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
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  Calendar,
  Edit2,
  Folder,
  FolderOpen,
  IndianRupee,
  MoreVertical,
  Plus,
  Search,
  Train,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { ContractResponse } from "../backend.d";
import { useActor } from "../hooks/useActor";

const SKELETON_KEYS = ["s1", "s2", "s3", "s4", "s5", "s6"];

const STATUS_OPTIONS = ["Active", "On Hold", "Completed"] as const;
type ContractStatus = (typeof STATUS_OPTIONS)[number];

function formatDate(nanoseconds: bigint): string {
  const ms = Number(nanoseconds / BigInt(1_000_000));
  return new Date(ms).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatIndianCurrency(value: bigint): string {
  const num = Number(value);
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(num);
}

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case "Active":
      return "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30";
    case "On Hold":
      return "bg-amber-500/15 text-amber-400 border border-amber-500/30";
    case "Completed":
      return "bg-blue-500/15 text-blue-400 border border-blue-500/30";
    default:
      return "bg-muted text-muted-foreground border border-border";
  }
}

interface EditDialogState {
  open: boolean;
  contract: ContractResponse | null;
}

export default function ContractsPage() {
  const navigate = useNavigate();
  const { actor } = useActor();

  const [contracts, setContracts] = useState<ContractResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [contractName, setContractName] = useState("");
  const [contractStatus, setContractStatus] =
    useState<ContractStatus>("Active");
  const [contractValue, setContractValue] = useState("");
  const [contractExpended, setContractExpended] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Edit dialog
  const [editDialog, setEditDialog] = useState<EditDialogState>({
    open: false,
    contract: null,
  });
  const [editName, setEditName] = useState("");
  const [editStatus, setEditStatus] = useState<ContractStatus>("Active");
  const [editValue, setEditValue] = useState("");
  const [editExpended, setEditExpended] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<ContractResponse | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);

  // Hover
  const [hoveredId, setHoveredId] = useState<bigint | null>(null);

  // Search & filter
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"All" | ContractStatus>(
    "All",
  );

  const [hasFetchedContracts, setHasFetchedContracts] = useState(false);

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
    if (actor && !hasFetchedContracts) {
      setHasFetchedContracts(true);
      fetchContracts();
    }
  }, [actor, hasFetchedContracts, fetchContracts]);

  // Derived stats
  const totalContracts = contracts.length;
  const activeContracts = contracts.filter((c) => c.status === "Active").length;
  const totalValue = contracts.reduce(
    (sum, c) => sum + (c.contractValue ?? BigInt(0)),
    BigInt(0),
  );

  // Filtered contracts
  const filteredContracts = contracts.filter((c) => {
    const matchesSearch = c.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesFilter = activeFilter === "All" || c.status === activeFilter;
    return matchesSearch && matchesFilter;
  });

  async function handleCreate() {
    if (!actor || !contractName.trim()) return;
    setIsCreating(true);
    try {
      const valueNum = contractValue.trim()
        ? BigInt(Math.round(Number(contractValue)))
        : null;
      const expendedNum = contractExpended.trim()
        ? BigInt(Math.round(Number(contractExpended)))
        : null;
      await actor.createContract(
        contractName.trim(),
        contractStatus,
        valueNum,
        expendedNum,
      );
      toast.success(`Contract "${contractName.trim()}" created`);
      setContractName("");
      setContractStatus("Active");
      setContractValue("");
      setContractExpended("");
      setCreateOpen(false);
      await fetchContracts();
    } catch (err) {
      toast.error("Failed to create contract");
      console.error(err);
    } finally {
      setIsCreating(false);
    }
  }

  function openEditDialog(contract: ContractResponse) {
    setEditDialog({ open: true, contract });
    setEditName(contract.name);
    setEditStatus((contract.status as ContractStatus) || "Active");
    setEditValue(
      contract.contractValue ? String(Number(contract.contractValue)) : "",
    );
    setEditExpended(
      contract.alreadyExpended ? String(Number(contract.alreadyExpended)) : "",
    );
  }

  async function handleEdit() {
    if (!actor || !editDialog.contract || !editName.trim()) return;
    setIsSaving(true);
    try {
      const valueNum = editValue.trim()
        ? BigInt(Math.round(Number(editValue)))
        : null;
      const expendedNum = editExpended.trim()
        ? BigInt(Math.round(Number(editExpended)))
        : null;
      await actor.updateContract(
        editDialog.contract.id,
        editName.trim(),
        editStatus,
        valueNum,
        expendedNum,
      );
      toast.success("Contract updated");
      setEditDialog({ open: false, contract: null });
      await fetchContracts();
    } catch (err) {
      toast.error("Failed to update contract");
      console.error(err);
    } finally {
      setIsSaving(false);
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
            <div className="w-10 h-10 rounded-md overflow-hidden flex items-center justify-center">
              <img
                src="/assets/generated/railway-logo-transparent.dim_200x200.png"
                alt="Railway Contracts Logo"
                className="w-10 h-10 object-contain"
              />
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
        <div className="mb-6">
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

        {/* Stat Bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6"
          data-ocid="stats.section"
        >
          {/* Total Contracts */}
          <div className="bg-card border border-border rounded-xl px-5 py-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
              <Folder className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-body uppercase tracking-wider">
                Total Contracts
              </p>
              <p className="font-display font-bold text-2xl text-foreground leading-none mt-0.5">
                {isLoading ? "—" : totalContracts}
              </p>
            </div>
          </div>

          {/* Active */}
          <div className="bg-card border border-border rounded-xl px-5 py-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-body uppercase tracking-wider">
                Active
              </p>
              <p className="font-display font-bold text-2xl text-emerald-400 leading-none mt-0.5">
                {isLoading ? "—" : activeContracts}
              </p>
            </div>
          </div>

          {/* Total Value */}
          <div className="bg-card border border-border rounded-xl px-5 py-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <IndianRupee className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-body uppercase tracking-wider">
                Total Value
              </p>
              <p className="font-display font-bold text-2xl text-primary leading-none mt-0.5">
                {isLoading
                  ? "—"
                  : totalValue > BigInt(0)
                    ? `₹${formatIndianCurrency(totalValue)}`
                    : "—"}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Search + Filter */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.2 }}
          className="flex flex-col sm:flex-row gap-3 mb-6"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search contracts…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-secondary border-border text-foreground placeholder:text-muted-foreground font-body"
              data-ocid="contracts.search_input"
            />
          </div>
          <Tabs
            value={activeFilter}
            onValueChange={(v) => setActiveFilter(v as "All" | ContractStatus)}
          >
            <TabsList className="bg-secondary border border-border h-10">
              {(["All", "Active", "On Hold", "Completed"] as const).map((f) => (
                <TabsTrigger
                  key={f}
                  value={f}
                  className="font-body text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  data-ocid="contracts.filter.tab"
                >
                  {f}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </motion.div>

        {/* Contract Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {SKELETON_KEYS.map((k) => (
              <Skeleton
                key={k}
                className="h-[180px] rounded-xl bg-card"
                data-ocid="contracts.loading_state"
              />
            ))}
          </div>
        ) : filteredContracts.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center justify-center py-24 text-center"
            data-ocid="contracts.empty_state"
          >
            <div className="w-20 h-20 rounded-2xl bg-secondary/60 border border-border flex items-center justify-center mb-6">
              <Folder className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="font-display font-bold text-xl text-foreground mb-2">
              {searchQuery || activeFilter !== "All"
                ? "No matching contracts"
                : "No contracts yet"}
            </h3>
            <p className="text-muted-foreground text-sm max-w-xs font-body">
              {searchQuery || activeFilter !== "All"
                ? "Try adjusting your search or filter."
                : "Create your first contract to start tracking tender documents, bills, and expenses."}
            </p>
            {!searchQuery && activeFilter === "All" && (
              <Button
                className="mt-6 bg-primary text-primary-foreground hover:bg-primary/90 font-body font-semibold"
                onClick={() => setCreateOpen(true)}
                data-ocid="contracts.primary_button"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create First Contract
              </Button>
            )}
          </motion.div>
        ) : (
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            data-ocid="contracts.list"
          >
            <AnimatePresence>
              {filteredContracts.map((contract, idx) => (
                <motion.div
                  key={contract.id.toString()}
                  variants={itemVariants}
                  layout
                  exit={{
                    opacity: 0,
                    scale: 0.95,
                    transition: { duration: 0.2 },
                  }}
                  data-ocid={`contracts.item.${idx + 1}`}
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
                    data-ocid={`contracts.card.${idx + 1}`}
                  >
                    {/* Folder Icon */}
                    <div className="mb-3">
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

                    {/* Status Badge */}
                    <div className="mb-2">
                      <span
                        className={`inline-flex items-center text-[10px] font-cabinet font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${getStatusBadgeClass(contract.status)}`}
                      >
                        {contract.status || "Active"}
                      </span>
                    </div>

                    {/* Date */}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3 shrink-0" />
                      <span className="font-body">
                        {formatDate(contract.createdAt)}
                      </span>
                    </div>

                    {/* Contract Value */}
                    {contract.contractValue !== undefined &&
                      contract.contractValue !== null && (
                        <div className="flex items-center gap-1 mt-1.5 text-xs text-primary font-body font-semibold">
                          <IndianRupee className="w-3 h-3 shrink-0" />
                          <span>
                            {formatIndianCurrency(contract.contractValue)}
                          </span>
                        </div>
                      )}

                    {/* Already Expended */}
                    {(() => {
                      const val = contract.alreadyExpended
                        ? Number(contract.alreadyExpended)
                        : 0;
                      if (val > 0) {
                        return (
                          <div className="flex items-center gap-1 mt-1 text-xs text-amber-400 font-body font-semibold">
                            <TrendingDown className="w-3 h-3 shrink-0" />
                            <span>
                              Expended: ₹
                              {formatIndianCurrency(BigInt(Math.round(val)))}
                            </span>
                          </div>
                        );
                      }
                      return null;
                    })()}

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
                            data-ocid={`contracts.dropdown_menu.${idx + 1}`}
                          >
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditDialog(contract);
                            }}
                            data-ocid={`contracts.edit_button.${idx + 1}`}
                          >
                            <Edit2 className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(contract);
                            }}
                            data-ocid={`contracts.delete_button.${idx + 1}`}
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
        data-ocid="contracts.open_modal_button"
      >
        <Plus className="w-6 h-6 font-bold" strokeWidth={2.5} />
      </motion.button>

      {/* Create Contract Dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(o) => {
          setCreateOpen(o);
          if (!o) {
            setContractName("");
            setContractStatus("Active");
            setContractValue("");
            setContractExpended("");
          }
        }}
      >
        <DialogContent
          className="sm:max-w-md bg-popover border-border"
          data-ocid="contracts.dialog"
        >
          <DialogHeader>
            <DialogTitle className="font-display font-bold text-xl text-foreground">
              New Contract
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-4">
            <div>
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
                data-ocid="contracts.input"
              />
            </div>

            <div>
              <Label
                htmlFor="contract-status"
                className="text-sm font-body font-medium text-foreground mb-2 block"
              >
                Status
              </Label>
              <Select
                value={contractStatus}
                onValueChange={(v) => setContractStatus(v as ContractStatus)}
              >
                <SelectTrigger
                  id="contract-status"
                  className="bg-secondary border-border text-foreground font-body"
                  data-ocid="contracts.select"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s} className="font-body">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label
                htmlFor="contract-value"
                className="text-sm font-body font-medium text-foreground mb-2 block"
              >
                Contract Value (₹){" "}
                <span className="text-muted-foreground font-normal">
                  — optional
                </span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-body">
                  ₹
                </span>
                <Input
                  id="contract-value"
                  type="number"
                  placeholder="e.g. 1250000"
                  value={contractValue}
                  onChange={(e) => setContractValue(e.target.value)}
                  className="pl-7 bg-secondary border-border text-foreground placeholder:text-muted-foreground font-body"
                  data-ocid="contracts.input"
                />
              </div>
            </div>

            <div>
              <Label
                htmlFor="contract-expended"
                className="text-sm font-body font-medium text-foreground mb-2 block"
              >
                Already Expended (₹){" "}
                <span className="text-muted-foreground font-normal">
                  — optional
                </span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-body">
                  ₹
                </span>
                <Input
                  id="contract-expended"
                  type="number"
                  placeholder="e.g. 450000"
                  value={contractExpended}
                  onChange={(e) => setContractExpended(e.target.value)}
                  className="pl-7 bg-secondary border-border text-foreground placeholder:text-muted-foreground font-body"
                  data-ocid="contracts.expended_input"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCreateOpen(false);
                setContractName("");
                setContractStatus("Active");
                setContractValue("");
                setContractExpended("");
              }}
              className="font-body"
              data-ocid="contracts.cancel_button"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreate}
              disabled={!contractName.trim() || isCreating}
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-body font-semibold"
              data-ocid="contracts.submit_button"
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

      {/* Edit Contract Dialog */}
      <Dialog
        open={editDialog.open}
        onOpenChange={(o) => {
          if (!o) setEditDialog({ open: false, contract: null });
        }}
      >
        <DialogContent
          className="sm:max-w-md bg-popover border-border"
          data-ocid="contracts.edit.dialog"
        >
          <DialogHeader>
            <DialogTitle className="font-display font-bold text-xl text-foreground">
              Edit Contract
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-4">
            <div>
              <Label
                htmlFor="edit-name"
                className="text-sm font-body font-medium text-foreground mb-2 block"
              >
                Contract Name
              </Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="bg-secondary border-border text-foreground font-body"
                autoFocus
                data-ocid="contracts.edit.input"
              />
            </div>

            <div>
              <Label
                htmlFor="edit-status"
                className="text-sm font-body font-medium text-foreground mb-2 block"
              >
                Status
              </Label>
              <Select
                value={editStatus}
                onValueChange={(v) => setEditStatus(v as ContractStatus)}
              >
                <SelectTrigger
                  id="edit-status"
                  className="bg-secondary border-border text-foreground font-body"
                  data-ocid="contracts.edit.select"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s} className="font-body">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label
                htmlFor="edit-value"
                className="text-sm font-body font-medium text-foreground mb-2 block"
              >
                Contract Value (₹){" "}
                <span className="text-muted-foreground font-normal">
                  — optional
                </span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-body">
                  ₹
                </span>
                <Input
                  id="edit-value"
                  type="number"
                  placeholder="e.g. 1250000"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="pl-7 bg-secondary border-border text-foreground placeholder:text-muted-foreground font-body"
                  data-ocid="contracts.edit.input"
                />
              </div>
            </div>

            <div>
              <Label
                htmlFor="edit-expended"
                className="text-sm font-body font-medium text-foreground mb-2 block"
              >
                Already Expended (₹){" "}
                <span className="text-muted-foreground font-normal">
                  — optional
                </span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-body">
                  ₹
                </span>
                <Input
                  id="edit-expended"
                  type="number"
                  placeholder="e.g. 450000"
                  value={editExpended}
                  onChange={(e) => setEditExpended(e.target.value)}
                  className="pl-7 bg-secondary border-border text-foreground placeholder:text-muted-foreground font-body"
                  data-ocid="contracts.edit.expended_input"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditDialog({ open: false, contract: null })}
              className="font-body"
              data-ocid="contracts.edit.cancel_button"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleEdit}
              disabled={!editName.trim() || isSaving}
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-body font-semibold"
              data-ocid="contracts.edit.save_button"
            >
              {isSaving ? (
                <>
                  <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  Saving…
                </>
              ) : (
                "Save Changes"
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
        <AlertDialogContent
          className="bg-popover border-border"
          data-ocid="contracts.delete.dialog"
        >
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
            <AlertDialogCancel
              className="font-body"
              data-ocid="contracts.delete.cancel_button"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-body"
              data-ocid="contracts.delete.confirm_button"
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
