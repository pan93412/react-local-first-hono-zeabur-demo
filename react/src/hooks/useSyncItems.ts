import { useMutation, useQueryClient } from "@tanstack/react-query";
import { hc } from "hono/client";
import { AppType } from "../../../server";
import db from "@/local/db";

const client = hc<AppType>("/");

export const useSyncItems = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (items: any[]) => {
      const itemsToSync = items.filter((item) => item.syncStatus === "pending");

      console.log("Items to sync:", itemsToSync);
      if (itemsToSync.length === 0) return;

      console.log("Sending items to sync:", itemsToSync);

      // Prepare items for sync by only including necessary fields
      const cleanItems = itemsToSync.map((item) => ({
        id: item.id,
        name: item.name,
      }));

      const response = await client.api.items.$post({
        json: cleanItems,
      });

      const { success, results } = (await response.json()) as any;
      console.log("Response data:", { success, results });

      if (success) {
        // Update local items with sync status and server-generated IDs
        const updates = await Promise.all(
          results.map(
            async (result: { id: number; status: string }, index: number) => {
              if (result.status === "success") {
                const localItem = itemsToSync[index];
                // Update the local item with the server-generated ID
                await db.items.where("name").equals(localItem.name).modify({
                  syncStatus: "synced",
                  serverId: result.id,
                  lastModified: Date.now(),
                });
                return { id: result.id, status: "synced" };
              } else {
                const localItem = itemsToSync[index];
                await db.items.where("name").equals(localItem.name).modify({
                  syncStatus: "error",
                  lastModified: Date.now(),
                });
                return { id: localItem.id, status: "error" };
              }
            }
          )
        );
        console.log("Updated items:", updates);

        // Trigger a refresh of all items
        const allItems = await db.items.toArray();
        queryClient.setQueryData(["localItems"], allItems);
      } else {
        throw new Error("Failed to sync items");
      }
    },
    onSuccess: () => {
      console.log("Sync completed successfully");
    },
    onError: (error) => {
      console.error("Sync failed:", error);
    },
  });
};