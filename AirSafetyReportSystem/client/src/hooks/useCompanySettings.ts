import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./useAuth";

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

export function useCompanySettings() {
  const { user, isAuthenticated } = useAuth();

  return useQuery<CompanySettings | null>({
    queryKey: ["/api/settings"],
    queryFn: async () => {
      try {
        const response = await fetch('/api/settings', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        });
        
        if (response.ok) {
          return response.json();
        }
        return null;
      } catch {
        return null;
      }
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
