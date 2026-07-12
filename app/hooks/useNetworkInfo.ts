import { API_BASE } from "../api/config";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

interface NetworkInfo {
  /** Unique reachable nodes: this node + its unique connected peer networks. */
  nodes: number;
  connectedPeers: number;
  /** Peer networks masked to /24 — the count is public, operators stay private. */
  peerNets: string[];
  userAgents: string[];
}

export const useNetworkInfo = () =>
  useQuery({
    queryKey: ["networkInfo"],
    queryFn: async () => {
      const { data } = await axios.get(`${API_BASE}/info/network`);
      return data as NetworkInfo;
    },
    refetchInterval: 30000,
    staleTime: Infinity,
  });
