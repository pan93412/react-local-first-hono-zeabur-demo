import { Pool } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import { Hono } from "hono";
import { items } from "./db/schema";

const app = new Hono();

// app.use("*", clerkMiddleware());

const route = app
  .basePath("/api")
  // .get("/protected", (c) => {
  //   try {
  //     const auth = getAuth(c);

  //     console.log("Auth check details:", {
  //       userId: auth?.userId,
  //       sessionId: auth?.sessionId,
  //       orgId: auth?.orgId,
  //       fullAuthObject: auth,
  //     });

  //     if (!auth?.userId) {
  //       console.log("No user ID found, returning 401");
  //       return c.json({ error: "Unauthorized" }, 401);
  //     }

  //     return c.json({
  //       message: "Protected endpoint",
  //       userId: auth?.userId,
  //     });
  //   } catch (error) {
  //     console.error("Unexpected error in protected route:", error);
  //     return c.json({ error: "Internal Server Error" }, 500);
  //   }
  // })
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

      if (!Array.isArray(body)) {
        return c.json({ error: "Invalid input: expected array of items" }, 400);
      }

      const itemsToSync = body;

      // Process items in batch
      const results = await Promise.all(
        itemsToSync.map(async (item) => {
          try {
            if (!item.name) {
              return { id: item.id, status: "error", error: "Missing name" };
            }

            await db.insert(items).values({
              id: item.id,
              name: item.name,
            });

            return { id: item.id, status: "success" };
          } catch (error) {
            console.error("Error inserting item:", error);
            return { id: item.id, status: "error" };
          }
        })
      );

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

    return c.json({
      success: true,
      result: deletedItem,
    });
  });

export type AppType = typeof route;

export default app;
