import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";

type User = { id: string; firstName?: string | null; lastName?: string | null; email?: string | null; role?: string | null };

export default function MessageCompose() {
  const { toast } = useToast();
  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users", { headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` } });
      if (!res.ok) return [];
      return res.json();
    },
  });
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  // Audience selection: large scale friendly
  const [audienceType, setAudienceType] = useState<"all" | "roles" | "users">("roles");
  const [roles, setRoles] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [query, setQuery] = useState("");

  const roleOptions = [
    { value: "captain", label: "Captains" },
    { value: "first_officer", label: "First Officers" },
    { value: "under_training_captain", label: "Captains (Under Training)" },
    { value: "under_training_first_officer", label: "First Officers (Under Training)" },
    { value: "safety_officer", label: "Safety Officers" },
    { value: "admin", label: "Admins" },
    { value: "flight_operation_manager", label: "Flight Operation Managers" },
    { value: "flight_operation_and_crew_affairs_manager", label: "Flight Ops & Crew Affairs Managers" },
    { value: "flight_operations_training_manager", label: "Flight Operations Training Managers" },
    { value: "chief_pilot_a330", label: "Chief Pilot A330" },
    { value: "chief_pilot_a320", label: "Chief Pilot A320" },
    { value: "technical_pilot_a330", label: "Technical Pilot A330" },
    { value: "technical_pilot_a320", label: "Technical Pilot A320" },
    { value: "head_of_safety_department", label: "Head of Safety Department" },
    { value: "head_of_compliance", label: "Head of Compliance" },
  ];

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return (users || [])
      .filter(u => {
        const name = `${u.firstName || ""} ${u.lastName || ""}`.toLowerCase();
        const email = (u.email || "").toLowerCase();
        return name.includes(q) || email.includes(q);
      })
      .slice(0, 50);
  }, [users, query]);

  const sendMutation = useMutation({
    mutationFn: async () => {
      const payload =
        audienceType === "all"
          ? { subject, body, all: true }
          : audienceType === "roles"
          ? { subject, body, roles }
          : { subject, body, recipients: selectedUsers };
      const res = await apiRequest("POST", "/api/messages", payload);
      if (!res.ok) throw new Error("Failed to send");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Message sent", description: `Sent to ${data.recipients} recipient(s)` });
      setSubject(""); setBody(""); setAudienceType("roles"); setRoles([]); setSelectedUsers([]); setQuery("");
    },
    onError: () => toast({ title: "Failed to send", variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="bg-muted border border-border rounded px-3 py-2">
        <h3 className="text-xs font-bold tracking-wide">COMPOSE MESSAGE (Admin)</h3>
      </div>
      <Card className="p-4 space-y-3">
        <div>
          <label className="text-sm font-medium">Subject</label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div>
          <label className="text-sm font-medium">Body</label>
          <Textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
        <div className="space-y-3">
          <label className="text-sm font-medium">Recipients</label>
          <div className="flex items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="radio" name="audience" checked={audienceType === "all"} onChange={() => setAudienceType("all")} />
              All users
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="audience" checked={audienceType === "roles"} onChange={() => setAudienceType("roles")} />
              By roles
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="audience" checked={audienceType === "users"} onChange={() => setAudienceType("users")} />
              Specific users
            </label>
          </div>
          {audienceType === "roles" && (
            <div className="flex flex-wrap gap-3 text-sm">
              {roleOptions.map(opt => (
                <label key={opt.value} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={roles.includes(opt.value)}
                    onChange={(e) => setRoles(prev => e.target.checked ? [...prev, opt.value] : prev.filter(x => x !== opt.value))}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          )}
          {audienceType === "users" && (
            <div className="space-y-2">
              <Input placeholder="Search users by name or email..." value={query} onChange={(e) => setQuery(e.target.value)} />
              <div className="text-xs text-muted-foreground">Showing up to 50 results</div>
              <div className="max-h-56 overflow-auto border rounded p-2">
                {filteredUsers.map(u => {
                  const id = u.id;
                  const label = u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : (u.email || id);
                  const checked = selectedUsers.includes(id);
                  return (
                    <label key={id} className="flex items-center gap-2 text-sm py-1">
                      <input type="checkbox" checked={checked} onChange={(e) => {
                        setSelectedUsers(prev => e.target.checked ? [...prev, id] : prev.filter(x => x !== id));
                      }} />
                      <span className="truncate">{label}</span>
                      <span className="text-xs text-muted-foreground">({u.role})</span>
                    </label>
                  );
                })}
                {filteredUsers.length === 0 && <div className="text-sm text-muted-foreground py-2">Type to search users...</div>}
              </div>
              {selectedUsers.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedUsers.map(id => {
                    const u = (users || []).find(x => x.id === id);
                    const label = u ? (u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : (u.email || id)) : id;
                    return (
                      <span key={id} className="px-2 py-1 rounded bg-muted text-xs">
                        {label}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex justify-end">
          <Button
            onClick={() => sendMutation.mutate()}
            disabled={
              !subject ||
              !body ||
              sendMutation.isPending ||
              (audienceType === "roles" && roles.length === 0) ||
              (audienceType === "users" && selectedUsers.length === 0)
            }
          >
            {sendMutation.isPending ? "Sending..." : "Send"}
          </Button>
        </div>
      </Card>
    </div>
  );
}


