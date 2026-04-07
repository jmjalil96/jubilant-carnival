import { QueryClient, type QueryClientConfig } from "@tanstack/react-query";

export const queryClientConfig = {
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
} satisfies QueryClientConfig;

export function createQueryClient() {
  return new QueryClient(queryClientConfig);
}

export const queryClient = createQueryClient();
