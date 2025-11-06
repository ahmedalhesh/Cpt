import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useRoute } from "wouter";
import { apiRequest } from "@/lib/queryClient";

type Detail = {
  id: string;
  subject: string;
  body: string;
  createdAt: string;
  sender: { id: string; firstName?: string | null; lastName?: string | null; email?: string | null };
  recipients: { id: string; recipientId: string; status: string; user: { firstName?: string | null; lastName?: string | null; email?: string | null } }[];
};

export default function MessageDetail() {
  const [, params] = useRoute("/messages/:id");
  const id = params?.id as string;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<Detail>({
    queryKey: ["/api/messages", id],
    enabled: !!id,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/messages/${id}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
  });

  const markRead = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/messages/${id}/read`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages/inbox"] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/unread-count"] });
      toast({ title: "Marked as read" });
    },
  });

  if (isLoading || !data) {
    return <Card className="p-6">Loading...</Card>;
  }

  const senderName = data.sender?.firstName && data.sender?.lastName ? `${data.sender.firstName} ${data.sender.lastName}` : (data.sender?.email || "Admin");

  return (
    <div className="space-y-4">
      <div className="bg-muted border border-border rounded px-3 py-2">
        <h3 className="text-xs font-bold tracking-wide">MESSAGE</h3>
      </div>
      <Card className="p-4 space-y-3">
        <div className="font-semibold text-lg">{data.subject}</div>
        <div className="text-xs text-muted-foreground">
          From: {senderName} • {new Date(data.createdAt).toLocaleString()}
        </div>
        <div className="whitespace-pre-wrap leading-6">{data.body}</div>
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => markRead.mutate()}>Mark as read</Button>
        </div>
        <div className="pt-3 border-t">
          <div className="text-xs text-muted-foreground mb-1">Recipients</div>
          <div className="flex flex-wrap gap-2 text-xs">
            {data.recipients.map((r) => {
              const n = r.user?.firstName && r.user?.lastName ? `${r.user.firstName} ${r.user.lastName}` : (r.user?.email || r.recipientId);
              return <span key={r.id} className="px-2 py-1 rounded bg-muted">{n} ({r.status})</span>;
            })}
          </div>
        </div>
      </Card>
    </div>
  );
}


