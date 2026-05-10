import { useCallback, useEffect, useState } from "react";
import type { Dealer } from "@/data/types";
import { getDealers } from "@/api/dealersApi";
import { saveDealers } from "@/lib/dealersStore";

export function useDealers() {
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDealers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDealers();
      setDealers(data);
      saveDealers(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dealers");
      setDealers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDealers();
  }, [loadDealers]);

  return { dealers, loading, error, loadDealers };
}
