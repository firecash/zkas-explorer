import { API_BASE } from "../api/config";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useMemo } from "react";

export interface Block {
  block_hash: string;
  difficulty: number;
  blueScore: string;
  timestamp: string;
  txCount: number;
  txs: {
    txId: string;
    outputs: [string, string][];
  }[];
}

// The FireCash backend serves the recent-block ring over REST; poll it (the chain
// runs at 1 BPS, so a 1s poll keeps the live feed current without a socket server).
export const useIncomingBlocks = () => {
  const { data } = useQuery({
    queryKey: ["recentBlocks"],
    queryFn: async () => {
      const res = await axios.get<Block[]>(`${API_BASE}/blocks/recent`);
      return res.data;
    },
    refetchInterval: 1000,
    staleTime: 1000,
    retry: false,
  });

  const blocks = useMemo(() => (data ?? []).slice(0, 20), [data]);

  // Average block rate over the recent window. Defensive on two axes: the feed
  // is deduplicated by hash (a backend that repeats blocks must not inflate the
  // rate — the live "9.3 bps" bug), and the span uses min/max timestamps rather
  // than first/last (block timestamps are miner-supplied and not monotonic in
  // acceptance order on a DAG).
  const avgBlockTime = useMemo(() => {
    if (!data || data.length < 2) return 0;
    const uniq = new Map<string, number>();
    for (const b of data) uniq.set(b.block_hash, Number(b.timestamp));
    if (uniq.size < 2) return 0;
    const ts = [...uniq.values()];
    const spanSec = (Math.max(...ts) - Math.min(...ts)) / 1000;
    return spanSec > 0 ? (uniq.size - 1) / spanSec : 0;
  }, [data]);

  const transactions = useMemo(() => {
    const txs: (Block["txs"][number] & { timestamp: string })[] = [];
    for (const block of blocks) {
      for (const tx of block.txs) {
        txs.push({ ...tx, timestamp: block.timestamp });
        if (txs.length > 20) return txs;
      }
    }
    return txs;
  }, [blocks]);

  return { blocks, avgBlockTime, transactions };
};
