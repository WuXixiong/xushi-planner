import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  parentId: text("parent_id"),
  title: text("title").notNull(),
  notes: text("notes").notNull().default(""),
  estimateMinutes: integer("estimate_minutes").notNull().default(30),
  priority: integer("priority").notNull().default(2),
  dueDate: text("due_date"),
  completed: integer("completed").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_tasks_owner_parent").on(table.ownerId, table.parentId),
]);

export const timeBlocks = sqliteTable("time_blocks", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  taskId: text("task_id"),
  kind: text("kind").notNull(),
  date: text("date").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  label: text("label").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_time_blocks_owner_date").on(table.ownerId, table.date),
]);
