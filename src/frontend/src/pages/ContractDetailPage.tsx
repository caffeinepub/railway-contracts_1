import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { SectionType } from "../backend";
import type { ContractResponse } from "../backend.d";
import SectionDrawer from "../components/app/SectionDrawer";
import { useActor } from "../hooks/useActor";

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

export default function ContractDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams({ strict: false }) as { id: string };
  const { actor } = useActor();

  const [contract, setContract] = useState<ContractResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<SectionMeta | null>(null);
  const [fileCounts, setFileCounts] = useState<Map<string, number>>(new Map());

  // Track which actor instance we've already fetched for — prevents re-fetch
  // on every actor invalidation cycle triggered by useActor's internal effect.
  const fetchedForActorRef = useRef<object | null>(null);

  const contractId = id ? BigInt(id) : null;

  const fetchContract = useCallback(async () => {
    if (!actor || !contractId) return;
    try {
      setIsLoading(true);
      const [result, counts] = await Promise.all([
        actor.getContract(contractId),
        actor
          .getContractFileCounts(contractId)
          .catch(() => [] as Array<[string, bigint]>),
      ]);
      setContract(result);
      const countMap = new Map<string, number>();
      for (const [section, count] of counts) {
        countMap.set(section, Number(count));
      }
      setFileCounts(countMap);
    } catch (err) {
      toast.error("Failed to load contract");
      console.error(err);
      navigate({ to: "/" });
    } finally {
      setIsLoading(false);
    }
  }, [actor, contractId, navigate]);

  useEffect(() => {
    // Only fetch once per actor instance + contractId combination.
    // useActor's internal invalidation loop re-provides the same actor object
    // reference each time; we guard against duplicate fetches here.
    if (actor && contractId && fetchedForActorRef.current !== actor) {
      fetchedForActorRef.current = actor;
      fetchContract();
    }
  }, [actor, contractId, fetchContract]);

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

  // Map SectionType enum values to the string keys returned by getContractFileCounts.
  // The backend returns human-readable labels: "Tender Details", "LOI", etc.
  function getSectionFileCount(sectionType: SectionType): number {
    const labelMap: Record<string, string> = {
      TenderDetails: "Tender Details",
      LOI: "LOI",
      RunningBill: "Running Bill",
      SiteExpenses: "Site Expenses",
      MaterialExpenses: "Material Expenses",
    };
    const key = String(sectionType);
    const label = labelMap[key] ?? key;
    return fileCounts.get(label) ?? 0;
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
            data-ocid="contract.back.button"
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
                    data-ocid="contract.breadcrumb.link"
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
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="flex flex-wrap items-center gap-3 mt-2"
              >
                {contract?.status && (
                  <span
                    className={`inline-flex items-center text-[11px] font-cabinet font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${getStatusBadgeClass(contract.status)}`}
                    data-ocid="contract.status.card"
                  >
                    {contract.status}
                  </span>
                )}
                {contract?.contractValue !== undefined &&
                  contract?.contractValue !== null && (
                    <span
                      className="inline-flex items-center gap-1 text-xs font-body font-semibold text-primary bg-primary/10 border border-primary/25 px-2.5 py-1 rounded-full"
                      data-ocid="contract.value.card"
                    >
                      <IndianRupee className="w-3 h-3" />
                      {formatIndianCurrency(contract.contractValue)}
                    </span>
                  )}
                <span className="text-muted-foreground font-body text-sm">
                  Manage documents and expenses for this contract
                </span>
              </motion.div>
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
            data-ocid="contract.sections.list"
          >
            {SECTIONS.map((section, idx) => {
              const fileCount = getSectionFileCount(section.type);
              return (
                <motion.div
                  key={section.type}
                  variants={itemVariants}
                  data-ocid={`contract.section.item.${idx + 1}`}
                >
                  <button
                    type="button"
                    className={`w-full text-left group relative bg-card border border-border rounded-xl p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${section.borderHoverClass}`}
                    style={{ boxShadow: "0 2px 12px -2px rgba(0,0,0,0.3)" }}
                    onClick={() => setActiveSection(section)}
                    data-ocid={`contract.section.button.${idx + 1}`}
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

                    {/* File count badge */}
                    {fileCount > 0 && (
                      <div className="absolute bottom-3 right-3">
                        <span className="text-[10px] font-body font-semibold text-muted-foreground bg-secondary border border-border px-2 py-0.5 rounded-full">
                          {fileCount} file{fileCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                    )}

                    {/* Arrow indicator */}
                    {fileCount === 0 && (
                      <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}

                    {/* Bottom indicator line */}
                    <div
                      className={`absolute bottom-0 left-4 right-4 h-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 ${section.indicatorClass}`}
                    />
                  </button>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </main>

      {/* Section Drawer */}
      {contractId && (
        <SectionDrawer
          contractId={contractId}
          section={activeSection}
          onClose={() => {
            setActiveSection(null);
            // Refresh file counts after drawer closes
            if (actor && contractId) {
              actor
                .getContractFileCounts(contractId)
                .then((counts) => {
                  const countMap = new Map<string, number>();
                  for (const [section, count] of counts) {
                    countMap.set(section, Number(count));
                  }
                  setFileCounts(countMap);
                })
                .catch(() => {});
            }
          }}
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
