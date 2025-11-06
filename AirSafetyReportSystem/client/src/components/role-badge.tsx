import { Badge } from "@/components/ui/badge";

type Role =
  | "captain"
  | "first_officer"
  | "under_training_captain"
  | "under_training_first_officer"
  | "safety_officer"
  | "administrator"
  | "admin"
  | "flight_operation_manager"
  | "flight_operation_and_crew_affairs_manager"
  | "flight_operations_training_manager"
  | "chief_pilot_a330"
  | "chief_pilot_a320"
  | "technical_pilot_a330"
  | "technical_pilot_a320"
  | "head_of_safety_department"
  | "head_of_compliance";

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
    flight_operation_manager: "Flight Operation Manager",
    flight_operation_and_crew_affairs_manager: "Flight Ops & Crew Affairs Manager",
    flight_operations_training_manager: "Flight Operations Training Manager",
    chief_pilot_a330: "Chief Pilot A330",
    chief_pilot_a320: "Chief Pilot A320",
    technical_pilot_a330: "Technical Pilot A330",
    technical_pilot_a320: "Technical Pilot A320",
    head_of_safety_department: "Head of Safety Department",
    head_of_compliance: "Head of Compliance",
  };

  return (
    <Badge variant="outline" className="capitalize" data-testid={`badge-role-${role}`}>
      {labels[roleLower] || role.replace('_', ' ')}
    </Badge>
  );
}
