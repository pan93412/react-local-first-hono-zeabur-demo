import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { Hono } from "hono";
import { items } from "./db/schema";
import { eq } from "drizzle-orm";

const app = new Hono();

const route = app
  .basePath("/api")
  .get("/items", async (c) => {
    try {
      const client = new Pool({ connectionString: process.env.DATABASE_URL });

      const db = drizzle(client);

      const result = await db.select().from(items);

      return c.json({
        result,
      });
    } catch (error) {
      console.log(error);
      return c.json(
        {
          error,
        },
        400
      );
    }
  })
  .post("/items", async (c) => {
    try {
      const client = new Pool({ connectionString: process.env.DATABASE_URL });
      const db = drizzle(client);

      const body = await c.req.json();
      console.log("Received body:", body);

      if (!Array.isArray(body)) {
        console.log("Invalid input: not an array");
        return c.json({ error: "Invalid input: expected array of items" }, 400);
      }

      const itemsToSync = body;
      console.log("Processing items:", itemsToSync);

      // Process items in batch
      const results = await Promise.all(
        itemsToSync.map(async (item) => {
          try {
            if (!item.name) {
              console.log("Invalid item, missing name:", item);
              return { id: item.id, status: "error", error: "Missing name" };
            }

            await db.insert(items).values({
              id: item.id,
              name: item.name,
            });

            console.log("Inserted item:", item.name);
            return { id: item.id, status: "success" };
          } catch (error) {
            console.error("Error inserting item:", error);
            return { id: item.id, status: "error" };
          }
        })
      );

      console.log("Sync results:", results);
      return c.json({
        success: true,
        results,
      });
    } catch (error) {
      console.error("Server error:", error);
      return c.json(
        {
          success: false,
          error: "Failed to sync items",
        },
        500
      );
    }
  })
  .post("/items/delete", async (c) => {
    const client = new Pool({ connectionString: process.env.DATABASE_URL });
    const db = drizzle(client);

    const { id } = await c.req.json();

    const deletedItem = await db
      .delete(items)
      .where(eq(items.id, id))
      .returning();

    console.log("Sync results:", deletedItem);
    return c.json({
      success: true,
      result: deletedItem,
    });
  });

export type AppType = typeof route;

export default app;
