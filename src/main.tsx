// =============================================================================
// src/main.tsx  --  Helsinki Pulse
// PATCH: Lisatty QueryClientProvider TanStack Query v5:lle
// =============================================================================
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.tsx'
import './index.css'

// QueryClient-konfiguraatio: sovitettu taksi-kayttoliittyman tarpeisiin
// - retry: 2 verkkohairioiden varalta
// - staleTime: 0 jottei vanha data nayta tuoreena uudella sessiolla
// - refetchOnWindowFocus: true hakee tuoreen datan kun app palaa etualalle
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
      staleTime: 0,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
})

const container = document.getElementById('root')
if (!container) throw new Error('Root-elementtia ei loydy DOM:sta')

createRoot(container).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>,
)
