import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";

export function useAuth() {
  const { data: user, isLoading, refetch, error } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        // Return null instead of throwing to prevent error UI
        return null;
      }
      
      try {
        const response = await fetch('/api/auth/user', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (!response.ok) {
          // Clear invalid token on 401/403
          if (response.status === 401 || response.status === 403) {
            localStorage.removeItem('token');
          }
          // Return null instead of throwing - this prevents error UI
          return null;
        }
        
        return response.json();
      } catch (error) {
        // Clear token on any error - network errors, etc.
        localStorage.removeItem('token');
        // Return null instead of throwing
        return null;
      }
    },
    retry: false,
    staleTime: 0, // Always refetch
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    // Prevent query from being disabled on error
    throwOnError: false,
  });

  // Ensure we always have a valid return value
  const authenticatedUser = user || undefined;

  return {
    user: authenticatedUser,
    isLoading,
    isAuthenticated: !!authenticatedUser,
    refetch,
  };
}
