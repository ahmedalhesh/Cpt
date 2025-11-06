import { Badge } from "@/components/ui/badge";

type ReportType = "asr" | "or" | "rir" | "ncr" | "cdf" | "chr" | "captain";

const reportTypeLabels: Record<ReportType, string> = {
  asr: "Air Safety Report",
  or: "Occurrence Report",
  rir: "Ramp Incident",
  ncr: "Nonconformity",
  cdf: "Commander's Discretion",
  chr: "Hazard Report",
  captain: "CR",
};

const reportTypeShortLabels: Record<ReportType, string> = {
  asr: "ASR",
  or: "OR",
  rir: "RIR",
  ncr: "NCR",
  cdf: "CDR",
  chr: "CHR",
  captain: "CR",
};

interface ReportTypeBadgeProps {
  type: string;
  short?: boolean;
}

export function ReportTypeBadge({ type, short = false }: ReportTypeBadgeProps) {
  const reportType = type.toLowerCase() as ReportType;
  const label = short 
    ? (reportTypeShortLabels[reportType] || type.toUpperCase())
    : (reportTypeLabels[reportType] || type);

  return (
    <Badge variant="secondary" data-testid={`badge-report-type-${type}`}>
      {label}
    </Badge>
  );
}
