import { ReactNode } from "react";
import { Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "@workspace/replit-auth-web";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

const queryClient = new QueryClient();

function RouteFallback() {
  return <div className="min-h-[100dvh] bg-background text-foreground" />;
}

function BootSkeleton() {
  return (
    <div className="min-h-[100dvh] flex bg-background text-foreground">
      <aside className="hidden md:flex w-60 flex-col border-r border-border/40 bg-card/30 p-3 gap-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-8 w-full mt-4" />
        <Skeleton className="h-8 w-full" />
      </aside>
      <main className="flex-1 px-4 md:px-8 py-8 space-y-6">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-4 w-1/2" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-36 w-full" />
        </div>
      </main>
    </div>
  );
}

export function AppRouteShell({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {children}
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export function LoginRouteShell({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <RouteFallback />;
  return isAuthenticated ? <Redirect to="/app" /> : children;
}

export function AuthenticatedRouteShell({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <BootSkeleton />;
  if (!isAuthenticated) return <Redirect to="/login" />;
  return <AppRouteShell>{children}</AppRouteShell>;
}
