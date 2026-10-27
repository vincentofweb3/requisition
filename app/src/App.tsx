import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { WagmiProvider } from "wagmi";
import { Layout } from "./components/Layout";
import { wagmiConfig } from "./lib/wagmi";
import { Desk } from "./routes/Desk";
import { Docs } from "./routes/Docs";
import { Home } from "./routes/Home";
import { Proof } from "./routes/Proof";
import { Receipt } from "./routes/Receipt";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false
    }
  }
});

export function App() {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Layout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/desk" element={<Desk />} />
              <Route path="/r/:requestId" element={<Receipt />} />
              <Route path="/proof" element={<Proof />} />
              <Route path="/docs" element={<Docs />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
