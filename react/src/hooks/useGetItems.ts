import { useQuery } from "@tanstack/react-query";
import { hc } from "hono/client";
import { AppType } from "../../../server/index";

const client = hc<AppType>("/");

export const useGetItems = () => {
  return useQuery({
    queryKey: ["items"],
    queryFn: async () => {
      const res = await client.api.items.$get();
      const items = await res.json();
      return items;
    },
    // Add these options for better data handling
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    staleTime: 1000 * 60, // Consider data stale after 1 minute
  });
};
