import { useQuery } from "@tanstack/react-query";

interface CompanySettings {
  id: string;
  companyName: string;
  logo: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  createdAt: string;
  updatedAt: string;
}

export function usePublicCompanySettings() {
  return useQuery<CompanySettings | null>({
    queryKey: ["/api/settings/public"],
    queryFn: async () => {
      try {
        const response = await fetch('/api/settings/public');
        
        if (response.ok) {
          return response.json();
        }
        return null;
      } catch {
        return null;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
