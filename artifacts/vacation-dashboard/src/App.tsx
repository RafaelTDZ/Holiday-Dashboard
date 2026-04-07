import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@workspace/replit-auth-web";

import { Layout } from "./components/layout";
import { RegistrationGate } from "./components/registration-gate";
import Dashboard from "./pages/dashboard";
import EmployeesList from "./pages/employees/index";
import EmployeeDetail from "./pages/employees/detail";
import Login from "./pages/login";
import ForgotPassword from "./pages/forgot-password";
import ResetPassword from "./pages/reset-password";
import NotFound from "./pages/not-found";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    }
  }
});

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    const path = window.location.pathname.replace(import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "", "");
    if (path.startsWith("/forgot-password")) return <ForgotPassword />;
    if (path.startsWith("/reset-password")) return <ResetPassword />;
    return <Login />;
  }

  return (
    <RegistrationGate>
      <Layout>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/employees" component={EmployeesList} />
          <Route path="/employees/:id" component={EmployeeDetail} />
          <Route component={NotFound} />
        </Switch>
      </Layout>
    </RegistrationGate>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
