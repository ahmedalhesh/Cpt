import { Badge } from "@/components/ui/badge";

type Role = "captain" | "safety_officer" | "administrator";

interface RoleBadgeProps {
  role: string;
}

export function RoleBadge({ role }: RoleBadgeProps) {
  const roleLower = role.toLowerCase() as Role;
  
  const labels: Record<Role, string> = {
    captain: "Captain",
    safety_officer: "Safety Officer",
    administrator: "Administrator",
  };

  return (
    <Badge variant="outline" className="capitalize" data-testid={`badge-role-${role}`}>
      {labels[roleLower] || role.replace('_', ' ')}
    </Badge>
  );
}
