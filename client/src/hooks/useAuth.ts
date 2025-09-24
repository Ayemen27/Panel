import { useQuery } from "@tanstack/react-query";
import { users } from "@shared/schema";

type User = typeof users.$inferSelect;

export function useAuth() {
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  };
}
