import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";

type SentItem = {
  id: string;
  subject: string;
  body: string;
  createdAt: string;
  recipientsCount: number;
  readCount: number;
};

export default function MessagesSent() {
  const { data, isLoading } = useQuery<SentItem[]>({
    queryKey: ["/api/messages/sent"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/messages/sent");
      return res.json();
    },
  });

  if (isLoading) {
    return <Card className="p-6">Loading sent...</Card>;
  }

  return (
    <div className="space-y-4">
      <div className="bg-muted border border-border rounded px-3 py-2">
        <h3 className="text-xs font-bold tracking-wide">SENT MESSAGES</h3>
      </div>
      <div className="grid gap-3">
        {(data || []).map((m) => (
          <Card key={m.id} className="p-4">
            <div className="font-medium">{m.subject}</div>
            <div className="text-xs text-muted-foreground">
              {new Date(m.createdAt).toLocaleString()} • Recipients: {m.recipientsCount} • Read: {m.readCount}
            </div>
          </Card>
        ))}
        {(!data || data.length === 0) && <Card className="p-6 text-muted-foreground">No sent messages.</Card>}
      </div>
    </div>
  );
}


