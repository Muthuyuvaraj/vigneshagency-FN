import type { Dealer } from "@/data/types";

const KEY = "va-dealers";

function withDealerCode(d: Dealer, index: number): Dealer {
  const code = d.dealerCode?.trim();
  if (code) return { ...d, dealerCode: code };
  return { ...d, dealerCode: `${101 + index}` };
}

export function loadDealers(fallback: Dealer[]): Dealer[] {
  const mapList = (list: Dealer[]) => list.map((d, i) => withDealerCode(d, i));
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return mapList(fallback);
    const parsed = JSON.parse(raw) as Dealer[];
    return Array.isArray(parsed) ? mapList(parsed) : mapList(fallback);
  } catch {
    return mapList(fallback);
  }
}

export function saveDealers(dealers: Dealer[]) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(dealers));
  } catch {
    /* ignore */
  }
}
