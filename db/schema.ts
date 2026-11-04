import { pgTable, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";

/* Uno stato per tabellone (id = parametro ?board=, default "main") */
export const boards = pgTable("boards", {
  id: text().primaryKey(),
  state: jsonb().notNull(),
  version: integer().notNull().default(1),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
