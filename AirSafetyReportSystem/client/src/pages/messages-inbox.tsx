import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";

type InboxItem = {
  id: string;
  messageId: string;
  status: string;
  createdAt: string;
  message: { id: string; subject: string; body: string; createdAt: string };
  sender: { id: string; firstName?: string | null; lastName?: string | null; email?: string | null };
};

export default function MessagesInbox() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<InboxItem[]>({
    queryKey: ["/api/messages/inbox"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/messages/inbox");
      return res.json();
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const res = await apiRequest("PATCH", `/api/messages/${messageId}/read`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages/inbox"] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/unread-count"] });
      toast({ title: "Marked as read" });
    },
  });

  if (isLoading) {
    return <Card className="p-6">Loading inbox...</Card>;
  }

  return (
    <div className="space-y-4">
      <div className="bg-muted border border-border rounded px-3 py-2">
        <h3 className="text-xs font-bold tracking-wide">INBOX</h3>
      </div>
      <div className="grid gap-3">
        {(data || []).map((item) => (
          <Card key={item.id} className="p-4 flex items-center justify-between">
            <div className="min-w-0">
              <Link href={`/messages/${item.message.id}`}>
                <a className="font-medium hover:underline">{item.message.subject}</a>
              </Link>
              <div className="text-xs text-muted-foreground">
                From: {item.sender?.firstName || item.sender?.email} • {new Date(item.message.createdAt).toLocaleString()}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {item.status === "unread" && (
                <Button size="sm" variant="outline" onClick={() => markReadMutation.mutate(item.message.id)}>
                  Mark read
                </Button>
              )}
              <Link href={`/messages/${item.message.id}`}>
                <Button size="sm">Open</Button>
              </Link>
            </div>
          </Card>
        ))}
        {(!data || data.length === 0) && <Card className="p-6 text-muted-foreground">No messages.</Card>}
      </div>
    </div>
  );
}


