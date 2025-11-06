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
  const [all, setAll] = useState(false);
  const [roles, setRoles] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  const availableRoles = useMemo(() => Array.from(new Set((users || []).map(u => (u.role || '').toLowerCase()).filter(Boolean))), [users]);

  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/messages", { subject, body, all, roles, recipients: selectedUsers });
      if (!res.ok) throw new Error("Failed to send");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Message sent", description: `Sent to ${data.recipients} recipient(s)` });
      setSubject(""); setBody(""); setAll(false); setRoles([]); setSelectedUsers([]);
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
        <div className="space-y-2">
          <label className="text-sm font-medium">Recipients</label>
          <div className="flex flex-wrap gap-2 items-center">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />
              All users
            </label>
            <div className="flex items-center gap-2 text-sm">
              <span>By roles:</span>
              {availableRoles.map(r => (
                <label key={r} className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={roles.includes(r)}
                    onChange={(e) => setRoles(prev => e.target.checked ? [...prev, r] : prev.filter(x => x !== r))}
                  />
                  {r.replace('_', ' ')}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Or pick users:</div>
            <div className="max-h-40 overflow-auto border rounded p-2">
              {(users || []).map(u => {
                const id = u.id;
                const label = u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : (u.email || id);
                const checked = selectedUsers.includes(id);
                return (
                  <label key={id} className="flex items-center gap-2 text-sm py-1">
                    <input type="checkbox" checked={checked} onChange={(e) => {
                      setSelectedUsers(prev => e.target.checked ? [...prev, id] : prev.filter(x => x !== id));
                    }} />
                    <span>{label}</span>
                    <span className="text-xs text-muted-foreground">({u.role})</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={() => sendMutation.mutate()} disabled={!subject || !body || sendMutation.isPending}>
            {sendMutation.isPending ? "Sending..." : "Send"}
          </Button>
        </div>
      </Card>
    </div>
  );
}


