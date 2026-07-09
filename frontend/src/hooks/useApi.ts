"use client";

/** React Query hooks over the API client. Every hook waits for the session's
 * apiToken; dreams poll while a generation is active (SSE is the fast path,
 * polling is the belt-and-braces). */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

import {
  getBalance,
  getDream,
  getLedger,
  getMe,
  getPaymentHistory,
  listDreams,
} from "@/lib/api";
import { ACTIVE_DREAM_STATUSES } from "@/types/api";

export function useApiToken(): string | undefined {
  const { data } = useSession();
  return data?.apiToken;
}

export function useUser() {
  const token = useApiToken();
  return useQuery({
    queryKey: ["me"],
    queryFn: () => getMe(token!),
    enabled: !!token,
  });
}

export function useBalance() {
  const token = useApiToken();
  return useQuery({
    queryKey: ["balance"],
    queryFn: () => getBalance(token!),
    enabled: !!token,
  });
}

export function useLedger() {
  const token = useApiToken();
  return useQuery({
    queryKey: ["ledger"],
    queryFn: () => getLedger(token!, 200),
    enabled: !!token,
  });
}

export function useDreams() {
  const token = useApiToken();
  return useQuery({
    queryKey: ["dreams"],
    queryFn: () => listDreams(token!),
    enabled: !!token,
  });
}

export function useDream(id: string | null) {
  const token = useApiToken();
  return useQuery({
    queryKey: ["dream", id],
    queryFn: () => getDream(token!, id!),
    enabled: !!token && !!id,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && (ACTIVE_DREAM_STATUSES as string[]).includes(status) ? 4000 : false;
    },
  });
}

export function usePaymentHistory() {
  const token = useApiToken();
  return useQuery({
    queryKey: ["payments"],
    queryFn: () => getPaymentHistory(token!),
    enabled: !!token,
  });
}

export function useInvalidateAfterGeneration() {
  const qc = useQueryClient();
  return (dreamId: string) => {
    qc.invalidateQueries({ queryKey: ["dream", dreamId] });
    qc.invalidateQueries({ queryKey: ["dreams"] });
    qc.invalidateQueries({ queryKey: ["balance"] });
    qc.invalidateQueries({ queryKey: ["ledger"] });
    qc.invalidateQueries({ queryKey: ["me"] });
  };
}
