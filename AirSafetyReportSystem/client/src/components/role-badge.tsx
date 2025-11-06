import { Badge } from "@/components/ui/badge";

type Role = "captain" | "first_officer" | "under_training_captain" | "under_training_first_officer" | "safety_officer" | "administrator" | "admin";

interface RoleBadgeProps {
  role: string;
}

export function RoleBadge({ role }: RoleBadgeProps) {
  const roleLower = role.toLowerCase() as Role;
  
  const labels: Record<Role, string> = {
    captain: "Captain",
    first_officer: "First Officer",
    under_training_captain: "Under Training Captain",
    under_training_first_officer: "Under Training First Officer",
    safety_officer: "Safety Officer",
    administrator: "Administrator",
    admin: "Administrator",
  };

  return (
    <Badge variant="outline" className="capitalize" data-testid={`badge-role-${role}`}>
      {labels[roleLower] || role.replace('_', ' ')}
    </Badge>
  );
}
