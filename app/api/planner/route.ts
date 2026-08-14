import { ensureSchema } from "../../../db";

type TaskRow = {
  id: string;
  parent_id: string | null;
  title: string;
  notes: string;
  estimate_minutes: number;
  priority: number;
  due_date: string | null;
  completed: number;
  sort_order: number;
};

type BlockRow = {
  id: string;
  task_id: string | null;
  kind: "available" | "scheduled";
  date: string;
  start_time: string;
  end_time: string;
  label: string;
};

const ownerFrom = (request: Request) => request.headers.get("oai-authenticated-user-id") || "local-demo";

const mapTask = (row: TaskRow) => ({
  id: row.id,
  parentId: row.parent_id,
  title: row.title,
  notes: row.notes,
  estimateMinutes: row.estimate_minutes,
  priority: row.priority,
  dueDate: row.due_date,
  completed: row.completed,
  sortOrder: row.sort_order,
});

const mapBlock = (row: BlockRow) => ({
  id: row.id,
  taskId: row.task_id,
  kind: row.kind,
  date: row.date,
  startTime: row.start_time,
  endTime: row.end_time,
  label: row.label,
});

async function seed(owner: string) {
  const db = await ensureSchema();
  const root = crypto.randomUUID();
  const research = crypto.randomUUID();
  const copy = crypto.randomUUID();
  const layout = crypto.randomUUID();
  const polish = crypto.randomUUID();
  const today = new Date();
  const day = (offset: number) => {
    const date = new Date(today);
    date.setDate(today.getDate() + offset);
    const parts = new Intl.DateTimeFormat("en", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const part = (type: string) => parts.find((item) => item.type === type)?.value;
    return `${part("year")}-${part("month")}-${part("day")}`;
  };
  await db.batch([
    db.prepare("INSERT INTO tasks (id, owner_id, parent_id, title, notes, estimate_minutes, priority, due_date, completed, sort_order) VALUES (?, ?, NULL, ?, ?, 240, 1, ?, 0, 0)").bind(root, owner, "完成个人作品集网站", "整理内容、完成页面设计并发布一个可以分享的个人作品集。", day(12)),
    db.prepare("INSERT INTO tasks (id, owner_id, parent_id, title, notes, estimate_minutes, priority, due_date, completed, sort_order) VALUES (?, ?, ?, ?, '', 35, 1, ?, 1, 1)").bind(research, owner, root, "整理要展示的项目素材", day(2)),
    db.prepare("INSERT INTO tasks (id, owner_id, parent_id, title, notes, estimate_minutes, priority, due_date, completed, sort_order) VALUES (?, ?, ?, ?, '', 50, 1, ?, 0, 2)").bind(copy, owner, root, "撰写首页自我介绍", day(4)),
    db.prepare("INSERT INTO tasks (id, owner_id, parent_id, title, notes, estimate_minutes, priority, due_date, completed, sort_order) VALUES (?, ?, ?, ?, '', 80, 2, ?, 0, 3)").bind(layout, owner, root, "完成项目展示页布局", day(7)),
    db.prepare("INSERT INTO tasks (id, owner_id, parent_id, title, notes, estimate_minutes, priority, due_date, completed, sort_order) VALUES (?, ?, ?, ?, '', 30, 2, ?, 0, 4)").bind(polish, owner, layout, "检查手机端排版", day(9)),
    db.prepare("INSERT INTO time_blocks (id, owner_id, task_id, kind, date, start_time, end_time, label) VALUES (?, ?, NULL, 'available', ?, '19:00', '21:00', '晚间空余时间')").bind(crypto.randomUUID(), owner, day(0)),
    db.prepare("INSERT INTO time_blocks (id, owner_id, task_id, kind, date, start_time, end_time, label) VALUES (?, ?, ?, 'scheduled', ?, '19:30', '20:20', '')").bind(crypto.randomUUID(), owner, copy, day(0)),
  ]);
}

export async function GET(request: Request) {
  try {
    const owner = ownerFrom(request);
    const db = await ensureSchema();
    let taskResult = await db.prepare("SELECT id, parent_id, title, notes, estimate_minutes, priority, due_date, completed, sort_order FROM tasks WHERE owner_id = ? ORDER BY sort_order, created_at").bind(owner).all<TaskRow>();
    if (!taskResult.results.length) {
      await seed(owner);
      taskResult = await db.prepare("SELECT id, parent_id, title, notes, estimate_minutes, priority, due_date, completed, sort_order FROM tasks WHERE owner_id = ? ORDER BY sort_order, created_at").bind(owner).all<TaskRow>();
    }
    const blockResult = await db.prepare("SELECT id, task_id, kind, date, start_time, end_time, label FROM time_blocks WHERE owner_id = ? ORDER BY date, start_time").bind(owner).all<BlockRow>();
    return Response.json({ tasks: taskResult.results.map(mapTask), blocks: blockResult.results.map(mapBlock) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "读取失败" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const owner = ownerFrom(request);
    const payload = await request.json() as Record<string, unknown>;
    const db = await ensureSchema();
    if (payload.action === "task") {
      const title = String(payload.title || "").trim();
      if (!title) return Response.json({ error: "请填写任务名称" }, { status: 400 });
      const id = crypto.randomUUID();
      const parentId = payload.parentId ? String(payload.parentId) : null;
      const notes = String(payload.notes || "").trim();
      const estimateMinutes = Math.max(5, Number(payload.estimateMinutes) || 30);
      const priority = Math.min(3, Math.max(1, Number(payload.priority) || 2));
      const dueDate = payload.dueDate ? String(payload.dueDate) : null;
      const orderRow = await db.prepare("SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM tasks WHERE owner_id = ? AND parent_id IS ?").bind(owner, parentId).first<{ next_order: number }>();
      await db.prepare("INSERT INTO tasks (id, owner_id, parent_id, title, notes, estimate_minutes, priority, due_date, completed, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)").bind(id, owner, parentId, title, notes, estimateMinutes, priority, dueDate, orderRow?.next_order || 1).run();
      return Response.json({ task: { id, parentId, title, notes, estimateMinutes, priority, dueDate, completed: 0, sortOrder: orderRow?.next_order || 1 } }, { status: 201 });
    }
    if (payload.action === "block") {
      const kind = payload.kind === "scheduled" ? "scheduled" : "available";
      const date = String(payload.date || "");
      const startTime = String(payload.startTime || "");
      const endTime = String(payload.endTime || "");
      if (!date || !startTime || !endTime || endTime <= startTime) return Response.json({ error: "请填写有效的开始和结束时间" }, { status: 400 });
      const taskId = kind === "scheduled" && payload.taskId ? String(payload.taskId) : null;
      if (kind === "scheduled" && !taskId) return Response.json({ error: "请选择要安排的任务" }, { status: 400 });
      if (kind === "scheduled") {
        const clash = await db.prepare("SELECT start_time, end_time FROM time_blocks WHERE owner_id = ? AND date = ? AND kind = 'scheduled' AND start_time < ? AND end_time > ?").bind(owner, date, endTime, startTime).first<{ start_time: string; end_time: string }>();
        if (clash) return Response.json({ error: `该时段与已有安排冲突：${clash.start_time}—${clash.end_time}` }, { status: 409 });
      }
      const id = crypto.randomUUID();
      const label = String(payload.label || "").trim();
      await db.prepare("INSERT INTO time_blocks (id, owner_id, task_id, kind, date, start_time, end_time, label) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(id, owner, taskId, kind, date, startTime, endTime, label).run();
      return Response.json({ block: { id, taskId, kind, date, startTime, endTime, label } }, { status: 201 });
    }
    if (payload.action === "autoSchedule") {
      const date = String(payload.date || "");
      if (!date) return Response.json({ error: "请选择日期" }, { status: 400 });
      const blockRows = await db.prepare("SELECT id, task_id, kind, start_time, end_time FROM time_blocks WHERE owner_id = ? AND date = ?").bind(owner, date).all<BlockRow>();
      const availableRows = blockRows.results.filter((row) => row.kind === "available");
      if (!availableRows.length) return Response.json({ error: "这一天没有空余时段，请先记录空余时间" }, { status: 400 });
      const scheduledRows = blockRows.results.filter((row) => row.kind === "scheduled");
      const taskRows = await db.prepare("SELECT id, estimate_minutes, priority, due_date FROM tasks WHERE owner_id = ? AND completed = 0 AND id NOT IN (SELECT task_id FROM time_blocks WHERE owner_id = ? AND kind = 'scheduled' AND task_id IS NOT NULL) ORDER BY priority ASC, (due_date IS NULL) ASC, due_date ASC, estimate_minutes DESC").bind(owner, owner).all<TaskRow>();
      if (!taskRows.results.length) return Response.json({ blocks: [], scheduled: 0, skipped: 0 });
      const toMinutes = (time: string) => { const [h, m] = time.split(":").map(Number); return h * 60 + m; };
      const toTime = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
      const segments: { start: number; end: number }[] = [];
      for (const slot of availableRows) {
        let cursor = toMinutes(slot.start_time);
        const end = toMinutes(slot.end_time);
        const overlaps = scheduledRows
          .filter((row) => toMinutes(row.start_time) < end && toMinutes(row.end_time) > cursor)
          .sort((a, b) => toMinutes(a.start_time) - toMinutes(b.start_time));
        for (const row of overlaps) {
          const overlapStart = Math.max(cursor, toMinutes(row.start_time));
          const overlapEnd = Math.min(end, toMinutes(row.end_time));
          if (overlapStart > cursor) segments.push({ start: cursor, end: overlapStart });
          cursor = Math.max(cursor, overlapEnd);
        }
        if (cursor < end) segments.push({ start: cursor, end });
      }
      segments.sort((a, b) => a.start - b.start);
      const created: { id: string; taskId: string; kind: "scheduled"; date: string; startTime: string; endTime: string; label: string }[] = [];
      const inserts: ReturnType<typeof db.prepare>[] = [];
      for (const task of taskRows.results) {
        const estimate = Math.max(5, task.estimate_minutes);
        let bestIndex = -1;
        let bestCapacity = Infinity;
        for (let index = 0; index < segments.length; index++) {
          const capacity = segments[index].end - segments[index].start;
          if (capacity >= estimate && capacity < bestCapacity) { bestIndex = index; bestCapacity = capacity; }
        }
        if (bestIndex < 0) continue;
        const id = crypto.randomUUID();
        const startTime = toTime(segments[bestIndex].start);
        const endTime = toTime(segments[bestIndex].start + estimate);
        inserts.push(db.prepare("INSERT INTO time_blocks (id, owner_id, task_id, kind, date, start_time, end_time, label) VALUES (?, ?, ?, 'scheduled', ?, ?, ?, '')").bind(id, owner, task.id, date, startTime, endTime));
        created.push({ id, taskId: task.id, kind: "scheduled", date, startTime, endTime, label: "" });
        segments[bestIndex].start += estimate;
      }
      if (inserts.length) await db.batch(inserts);
      return Response.json({ blocks: created, scheduled: created.length, skipped: taskRows.results.length - created.length }, { status: 201 });
    }
    return Response.json({ error: "未知操作" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "保存失败" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const owner = ownerFrom(request);
    const payload = await request.json() as Record<string, unknown>;
    const db = await ensureSchema();
    if (payload.action === "toggleTask") {
      await db.prepare("UPDATE tasks SET completed = ? WHERE id = ? AND owner_id = ?").bind(payload.completed ? 1 : 0, String(payload.id), owner).run();
      return Response.json({ ok: true });
    }
    if (payload.action === "updateTask") {
      const id = String(payload.id || "");
      const existing = await db.prepare("SELECT id FROM tasks WHERE id = ? AND owner_id = ?").bind(id, owner).first();
      if (!existing) return Response.json({ error: "任务不存在" }, { status: 404 });
      const title = String(payload.title || "").trim();
      if (!title) return Response.json({ error: "请填写任务名称" }, { status: 400 });
      const notes = String(payload.notes || "").trim();
      const estimateMinutes = Math.max(5, Number(payload.estimateMinutes) || 30);
      const priority = Math.min(3, Math.max(1, Number(payload.priority) || 2));
      const dueDate = payload.dueDate ? String(payload.dueDate) : null;
      await db.prepare("UPDATE tasks SET title = ?, notes = ?, estimate_minutes = ?, priority = ?, due_date = ? WHERE id = ? AND owner_id = ?").bind(title, notes, estimateMinutes, priority, dueDate, id, owner).run();
      const row = await db.prepare("SELECT id, parent_id, title, notes, estimate_minutes, priority, due_date, completed, sort_order FROM tasks WHERE id = ? AND owner_id = ?").bind(id, owner).first<TaskRow>();
      return Response.json({ task: row ? mapTask(row) : null });
    }
    if (payload.action === "moveTask") {
      const id = String(payload.id || "");
      const direction = payload.direction === "down" ? "down" : "up";
      const task = await db.prepare("SELECT id, parent_id FROM tasks WHERE id = ? AND owner_id = ?").bind(id, owner).first<{ id: string; parent_id: string | null }>();
      if (!task) return Response.json({ error: "任务不存在" }, { status: 404 });
      const siblings = await db.prepare("SELECT id, sort_order FROM tasks WHERE owner_id = ? AND parent_id IS ? ORDER BY sort_order, created_at").bind(owner, task.parent_id).all<{ id: string; sort_order: number }>();
      const index = siblings.results.findIndex((row) => row.id === id);
      const target = index + (direction === "up" ? -1 : 1);
      if (index >= 0 && target >= 0 && target < siblings.results.length) {
        const reordered = siblings.results.map((row) => row.id);
        [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
        await db.batch(reordered.map((siblingId, position) => db.prepare("UPDATE tasks SET sort_order = ? WHERE id = ? AND owner_id = ?").bind(position + 1, siblingId, owner)));
      }
      const rows = await db.prepare("SELECT id, parent_id, title, notes, estimate_minutes, priority, due_date, completed, sort_order FROM tasks WHERE owner_id = ? ORDER BY sort_order, created_at").bind(owner).all<TaskRow>();
      return Response.json({ tasks: rows.results.map(mapTask) });
    }
    return Response.json({ error: "未知操作" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "更新失败" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const owner = ownerFrom(request);
    const payload = await request.json() as Record<string, unknown>;
    const db = await ensureSchema();
    if (payload.action === "block") {
      await db.prepare("DELETE FROM time_blocks WHERE id = ? AND owner_id = ?").bind(String(payload.id), owner).run();
      return Response.json({ ok: true });
    }
    if (payload.action === "task") {
      const id = String(payload.id || "");
      const ids: string[] = [];
      const queue = [id];
      while (queue.length) {
        const current = queue.shift() as string;
        ids.push(current);
        const children = await db.prepare("SELECT id FROM tasks WHERE parent_id = ? AND owner_id = ?").bind(current, owner).all<{ id: string }>();
        children.results.forEach((child) => queue.push(child.id));
      }
      const placeholders = ids.map(() => "?").join(",");
      const blocks = await db.prepare(`SELECT id FROM time_blocks WHERE task_id IN (${placeholders})`).bind(...ids).all<{ id: string }>();
      await db.batch([
        db.prepare(`DELETE FROM time_blocks WHERE task_id IN (${placeholders})`).bind(...ids),
        db.prepare(`DELETE FROM tasks WHERE id IN (${placeholders})`).bind(...ids),
      ]);
      return Response.json({ taskIds: ids, blockIds: blocks.results.map((row) => row.id) });
    }
    return Response.json({ error: "未知操作" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "删除失败" }, { status: 500 });
  }
}
