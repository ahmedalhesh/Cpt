import { Badge } from "@/components/ui/badge";

type Status = "submitted" | "in_review" | "closed" | "rejected";

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const statusLower = status.toLowerCase() as Status;
  
  const variants: Record<Status, "default" | "secondary" | "destructive" | "outline"> = {
    submitted: "secondary",
    in_review: "default",
    closed: "outline",
    rejected: "destructive",
  };

  const labels: Record<Status, string> = {
    submitted: "Submitted",
    in_review: "In Review",
    closed: "Closed",
    rejected: "Rejected",
  };

  return (
    <Badge 
      variant={variants[statusLower] || "secondary"}
      data-testid={`badge-status-${status}`}
    >
      {labels[statusLower] || status}
    </Badge>
  );
}
