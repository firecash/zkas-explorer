import { API_BASE } from "../api/config";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

// Confirmations must compare like-for-like. A transaction reports its
// accepting_block_blue_score (a BLUE score), so the chain-tip reference has to be a
// blue score too — NOT virtualDaaScore. DAA score counts red blocks as well, so it
// sits a constant few-thousand ABOVE the blue score; subtracting one from the other
// yields that gap on every tx (the bogus "~4500 confirmations" that never moved).
//
// The tip's blue score is the highest blue score in the recent-block window.
export const useVirtualChainBlueScore = () => {
  const { data } = useQuery({
    queryKey: ["virtualChainBlueScore"],
    queryFn: async () => {
      const { data } = await axios.get<{ blueScore: string }[]>(`${API_BASE}/blocks/recent`);
      return data.reduce((max, b) => Math.max(max, parseInt(b.blueScore, 10) || 0), 0);
    },
    refetchInterval: 3000,
    retry: false,
  });

  return { virtualChainBlueScore: data };
};
