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
      const id = crypto.randomUUID();
      const label = String(payload.label || "").trim();
      await db.prepare("INSERT INTO time_blocks (id, owner_id, task_id, kind, date, start_time, end_time, label) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(id, owner, taskId, kind, date, startTime, endTime, label).run();
      return Response.json({ block: { id, taskId, kind, date, startTime, endTime, label } }, { status: 201 });
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
    if (payload.action !== "toggleTask") return Response.json({ error: "未知操作" }, { status: 400 });
    const db = await ensureSchema();
    await db.prepare("UPDATE tasks SET completed = ? WHERE id = ? AND owner_id = ?").bind(payload.completed ? 1 : 0, String(payload.id), owner).run();
    return Response.json({ ok: true });
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
    return Response.json({ error: "未知操作" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "删除失败" }, { status: 500 });
  }
}
