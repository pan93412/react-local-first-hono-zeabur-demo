// db/schema.ts
import { pgTable, text } from "drizzle-orm/pg-core";

export const items = pgTable("items", {
  id: text("id").primaryKey(),
  name: text("name"),
});
