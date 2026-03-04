import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate, useParams } from "@tanstack/react-router";
import {
  ArrowLeft,
  ChevronRight,
  FileSignature,
  FileText,
  HardHat,
  IndianRupee,
  Package,
  Receipt,
  Train,
  TrendingUp,
} from "lucide-react";
import { motion } from "motion/react";
import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { SectionType } from "../backend";
import type { ContractResponse, FileRef } from "../backend";
import SectionDrawer from "../components/app/SectionDrawer";
import { useActor } from "../hooks/useActor";
import {
  type SpreadsheetData,
  computeColumnTotals,
  findPrimaryAmountColumnIndex,
  parseXlsxFromUrl,
} from "../utils/xlsxLoader";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            background: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
          }}
        >
          <div style={{ maxWidth: 400, textAlign: "center" }}>
            <p
              style={{
                color: "#ef4444",
                fontSize: "1.125rem",
                fontWeight: 600,
                marginBottom: "0.5rem",
              }}
            >
              Something went wrong
            </p>
            <p
              style={{
                color: "#6b7280",
                fontSize: "0.875rem",
                marginBottom: "1.5rem",
              }}
            >
              {this.state.error?.message}
            </p>
            <button
              type="button"
              style={{
                padding: "0.5rem 1rem",
                background: "#f59e0b",
                color: "#000",
                borderRadius: "0.5rem",
                border: "none",
                cursor: "pointer",
              }}
              onClick={() => window.history.back()}
            >
              Go back
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

interface SectionMeta {
  type: SectionType;
  label: string;
  description: string;
  icon: React.ReactNode;
  accentClass: string;
  borderHoverClass: string;
  indicatorClass: string;
  isExpense: boolean;
}

const SKELETON_KEYS = ["sk1", "sk2", "sk3", "sk4", "sk5"];

function computeSectionTotal(data: SpreadsheetData): number {
  const totals = computeColumnTotals(data);
  const primaryIdx = findPrimaryAmountColumnIndex(data.headers);
  if (primaryIdx !== -1 && totals[primaryIdx] !== null) {
    return totals[primaryIdx] as number;
  }
  return totals.reduce<number>((acc, val) => acc + (val ?? 0), 0);
}

function formatIndianCurrency(value: number): string {
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function findMostRecentXlsx(files: FileRef[]): FileRef | null {
  const xlsxFiles = files
    .filter(
      (f) =>
        f.fileType.toLowerCase() === "xlsx" ||
        f.fileType.toLowerCase() === "xls",
    )
    .sort((a, b) => Number(b.uploadedAt - a.uploadedAt));
  return xlsxFiles[0] ?? null;
}

interface ExpenseSummaryState {
  siteTotal: number | null;
  materialTotal: number | null;
  isLoading: boolean;
}

const SECTIONS: SectionMeta[] = [
  {
    type: SectionType.TenderDetails,
    label: "Tender Details",
    description: "Official tender documents, NIT, and specifications",
    icon: <FileText className="w-6 h-6" />,
    accentClass: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    borderHoverClass: "hover:border-blue-500/40",
    indicatorClass: "bg-blue-400",
    isExpense: false,
  },
  {
    type: SectionType.LOI,
    label: "LOI",
    description: "Letter of Intent and acceptance documents",
    icon: <FileSignature className="w-6 h-6" />,
    accentClass: "text-violet-400 bg-violet-500/10 border-violet-500/20",
    borderHoverClass: "hover:border-violet-500/40",
    indicatorClass: "bg-violet-400",
    isExpense: false,
  },
  {
    type: SectionType.RunningBill,
    label: "Running Bill",
    description: "Running account bills and payment certificates",
    icon: <Receipt className="w-6 h-6" />,
    accentClass: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    borderHoverClass: "hover:border-emerald-500/40",
    indicatorClass: "bg-emerald-400",
    isExpense: false,
  },
  {
    type: SectionType.SiteExpenses,
    label: "Site Expenses",
    description: "Labour, equipment, and on-site expenditure records",
    icon: <HardHat className="w-6 h-6" />,
    accentClass: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    borderHoverClass: "hover:border-amber-500/40",
    indicatorClass: "bg-amber-400",
    isExpense: true,
  },
  {
    type: SectionType.MaterialExpenses,
    label: "Material Expenses",
    description: "Material procurement invoices and cost sheets",
    icon: <Package className="w-6 h-6" />,
    accentClass: "text-orange-400 bg-orange-500/10 border-orange-500/20",
    borderHoverClass: "hover:border-orange-500/40",
    indicatorClass: "bg-orange-400",
    isExpense: true,
  },
];

export default function ContractDetailPage() {
  return (
    <ErrorBoundary>
      <ContractDetailPageInner />
    </ErrorBoundary>
  );
}

function ContractDetailPageInner() {
  const navigate = useNavigate();
  const { id } = useParams({ from: "/contract/$id" });
  const { actor, isFetching } = useActor();

  const [contract, setContract] = useState<ContractResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<SectionMeta | null>(null);
  const [expenseSummary, setExpenseSummary] = useState<ExpenseSummaryState>({
    siteTotal: null,
    materialTotal: null,
    isLoading: false,
  });

  let contractId: bigint | null = null;
  try {
    if (id && id !== "undefined") {
      contractId = BigInt(id);
    }
  } catch {
    // will be handled below
  }

  const fetchContract = useCallback(async () => {
    if (!actor || !contractId) return;
    try {
      setIsLoading(true);
      const result = await actor.getContract(contractId);
      setContract(result);
    } catch (err) {
      toast.error("Failed to load contract");
      console.error(err);
      navigate({ to: "/" });
    } finally {
      setIsLoading(false);
    }
  }, [actor, contractId, navigate]);

  useEffect(() => {
    if (actor && !isFetching && contractId) {
      fetchContract();
    }
  }, [actor, isFetching, contractId, fetchContract]);

  // Fetch & parse expense totals
  useEffect(() => {
    if (!actor || isFetching || !contractId) return;

    setExpenseSummary({
      siteTotal: null,
      materialTotal: null,
      isLoading: true,
    });

    Promise.all([
      actor.getSectionFiles(contractId, SectionType.SiteExpenses),
      actor.getSectionFiles(contractId, SectionType.MaterialExpenses),
    ])
      .then(async ([siteFiles, materialFiles]) => {
        const [siteXlsx, materialXlsx] = [
          findMostRecentXlsx(siteFiles),
          findMostRecentXlsx(materialFiles),
        ];

        const [siteData, materialData] = await Promise.all([
          siteXlsx
            ? parseXlsxFromUrl(siteXlsx.blob.getDirectURL()).catch(() => null)
            : Promise.resolve(null),
          materialXlsx
            ? parseXlsxFromUrl(materialXlsx.blob.getDirectURL()).catch(
                () => null,
              )
            : Promise.resolve(null),
        ]);

        setExpenseSummary({
          siteTotal: siteData ? computeSectionTotal(siteData) : null,
          materialTotal: materialData
            ? computeSectionTotal(materialData)
            : null,
          isLoading: false,
        });
      })
      .catch((err) => {
        console.error("Failed to load expense summary:", err);
        setExpenseSummary({
          siteTotal: null,
          materialTotal: null,
          isLoading: false,
        });
      });
  }, [actor, isFetching, contractId]);

  const containerVariants = {
    hidden: {},
    visible: {
      transition: { staggerChildren: 0.07 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 14 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.35 },
    },
  };

  if (!id || id === "undefined" || contractId === null) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "oklch(0.16 0.012 250)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ textAlign: "center", color: "#fff" }}>
          <p style={{ marginBottom: "1rem" }}>Contract not found</p>
          <button
            type="button"
            onClick={() => navigate({ to: "/" })}
            style={{
              padding: "0.5rem 1rem",
              background: "#f59e0b",
              color: "#000",
              borderRadius: "0.5rem",
              border: "none",
              cursor: "pointer",
            }}
          >
            Back to contracts
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background track-pattern">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => navigate({ to: "/" })}
            className="shrink-0 h-9 w-9 hover:bg-secondary"
            aria-label="Back to contracts"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>

          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-md bg-primary/20 flex items-center justify-center border border-primary/30 shrink-0">
              <Train className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="min-w-0">
              {isLoading ? (
                <Skeleton className="h-5 w-48 bg-secondary" />
              ) : (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground font-body">
                  <button
                    type="button"
                    className="hover:text-foreground cursor-pointer transition-colors bg-transparent border-0 p-0 text-sm text-muted-foreground font-body"
                    onClick={() => navigate({ to: "/" })}
                  >
                    Contracts
                  </button>
                  <ChevronRight className="w-3.5 h-3.5" />
                  <span className="text-foreground font-semibold truncate">
                    {contract?.name}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Contract Title */}
        <div className="mb-8">
          {isLoading ? (
            <>
              <Skeleton className="h-9 w-80 mb-2 bg-card" />
              <Skeleton className="h-4 w-56 bg-card" />
            </>
          ) : (
            <>
              <motion.h2
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4 }}
                className="font-display font-extrabold text-3xl sm:text-4xl text-foreground tracking-tight"
              >
                {contract?.name}
              </motion.h2>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="text-muted-foreground font-body mt-1.5 text-sm"
              >
                Manage documents and expenses for this contract
              </motion.p>
            </>
          )}
        </div>

        {/* Section Cards Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {SKELETON_KEYS.map((k) => (
              <Skeleton key={k} className="h-[140px] rounded-xl bg-card" />
            ))}
          </div>
        ) : (
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {SECTIONS.map((section) => (
              <motion.div key={section.type} variants={itemVariants}>
                <button
                  type="button"
                  className={`w-full text-left group relative bg-card border border-border rounded-xl p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${section.borderHoverClass}`}
                  style={{ boxShadow: "0 2px 12px -2px rgba(0,0,0,0.3)" }}
                  onClick={() => setActiveSection(section)}
                >
                  {/* Icon */}
                  <div
                    className={`w-12 h-12 rounded-lg border flex items-center justify-center mb-4 transition-all duration-200 group-hover:scale-105 ${section.accentClass}`}
                  >
                    {section.icon}
                  </div>

                  {/* Label */}
                  <h3 className="font-display font-bold text-base text-foreground mb-1">
                    {section.label}
                  </h3>

                  {/* Description */}
                  <p className="text-xs text-muted-foreground font-body leading-relaxed">
                    {section.description}
                  </p>

                  {/* Expense badge */}
                  {section.isExpense && (
                    <span className="absolute top-3 right-3 text-[10px] font-cabinet font-bold uppercase tracking-wider text-primary bg-primary/15 border border-primary/25 px-2 py-0.5 rounded-full">
                      Expense
                    </span>
                  )}

                  {/* Arrow indicator */}
                  <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>

                  {/* Bottom indicator line */}
                  <div
                    className={`absolute bottom-0 left-4 right-4 h-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 ${section.indicatorClass}`}
                  />
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
        {/* Expense Summary */}
        {!isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
            className="mt-8"
          >
            <div className="flex items-center gap-2.5 mb-4">
              <TrendingUp className="w-5 h-5 text-primary" />
              <h3 className="font-display font-bold text-lg text-foreground">
                Expense Summary
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Site Expenses Total */}
              <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
                    <HardHat className="w-4 h-4 text-amber-400" />
                  </div>
                  <p className="text-xs font-cabinet font-bold uppercase tracking-wider text-muted-foreground">
                    Site Expenses
                  </p>
                </div>
                {expenseSummary.isLoading ? (
                  <Skeleton className="h-8 w-32 bg-secondary" />
                ) : expenseSummary.siteTotal !== null ? (
                  <p className="font-display font-extrabold text-2xl text-amber-400 tracking-tight">
                    {formatIndianCurrency(expenseSummary.siteTotal)}
                  </p>
                ) : (
                  <p className="text-sm font-body text-muted-foreground italic">
                    No data
                  </p>
                )}
              </div>

              {/* Material Expenses Total */}
              <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/15 border border-orange-500/25 flex items-center justify-center">
                    <Package className="w-4 h-4 text-orange-400" />
                  </div>
                  <p className="text-xs font-cabinet font-bold uppercase tracking-wider text-muted-foreground">
                    Material Expenses
                  </p>
                </div>
                {expenseSummary.isLoading ? (
                  <Skeleton className="h-8 w-32 bg-secondary" />
                ) : expenseSummary.materialTotal !== null ? (
                  <p className="font-display font-extrabold text-2xl text-orange-400 tracking-tight">
                    {formatIndianCurrency(expenseSummary.materialTotal)}
                  </p>
                ) : (
                  <p className="text-sm font-body text-muted-foreground italic">
                    No data
                  </p>
                )}
              </div>

              {/* Grand Total */}
              <div className="bg-primary/10 border border-primary/30 rounded-xl p-5 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
                <div className="relative">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/35 flex items-center justify-center">
                      <IndianRupee className="w-4 h-4 text-primary" />
                    </div>
                    <p className="text-xs font-cabinet font-bold uppercase tracking-wider text-primary/80">
                      Grand Total
                    </p>
                  </div>
                  {expenseSummary.isLoading ? (
                    <Skeleton className="h-9 w-36 bg-primary/20" />
                  ) : expenseSummary.siteTotal !== null ||
                    expenseSummary.materialTotal !== null ? (
                    <p className="font-display font-extrabold text-3xl text-primary tracking-tight">
                      {formatIndianCurrency(
                        (expenseSummary.siteTotal ?? 0) +
                          (expenseSummary.materialTotal ?? 0),
                      )}
                    </p>
                  ) : (
                    <p className="text-sm font-body text-muted-foreground italic">
                      Upload expense sheets to see totals
                    </p>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </main>

      {/* Section Drawer */}
      {contractId && (
        <SectionDrawer
          contractId={contractId}
          section={activeSection}
          onClose={() => setActiveSection(null)}
        />
      )}

      {/* Footer */}
      <footer className="max-w-5xl mx-auto px-4 sm:px-6 py-6 mt-8 border-t border-border">
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
