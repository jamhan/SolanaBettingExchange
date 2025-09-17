import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WalletConnectionProvider } from "@/components/wallet-connection";
import Overview from "@/pages/overview";
import Markets from "@/pages/markets";
import MarketDetail from "@/pages/market-detail";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Overview} />
      <Route path="/markets" component={Markets} />
      <Route path="/market/:id" component={MarketDetail} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WalletConnectionProvider>
          <Toaster />
          <Router />
        </WalletConnectionProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
