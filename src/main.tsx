import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import './index.css'
import App from './App.tsx'

// Créer une instance du QueryClient
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true, // Refetch when window regains focus
      retry: 1,
      staleTime: 0, // Data is immediately stale to ensure fresh data on navigation
      gcTime: 5 * 60 * 1000, // 5 minutes cache retention (reduced for better navigation)
      refetchOnMount: true, // Always refetch when component mounts
      refetchOnReconnect: true, // Refetch when reconnecting
    },
    mutations: {
      retry: false, // Don't retry mutations
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </StrictMode>,
)
