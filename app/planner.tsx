"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Task = {
  id: string;
  parentId: string | null;
  title: string;
  notes: string;
  estimateMinutes: number;
  priority: number;
  dueDate: string | null;
  completed: number;
  sortOrder: number;
};

type Block = {
  id: string;
  taskId: string | null;
  kind: "available" | "scheduled";
  date: string;
  startTime: string;
  endTime: string;
  label: string;
};

type ModalState =
  | { type: "root" }
  | { type: "child"; parentId: string }
  | { type: "block"; kind: "available" | "scheduled" }
  | null;

const minutesBetween = (start: string, end: string) => {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0, eh * 60 + em - sh * 60 - sm);
};

const dateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

function TaskBranch({
  task,
  depth,
  tasks,
  onToggle,
  onAdd,
  onSchedule,
}: {
  task: Task;
  depth: number;
  tasks: Task[];
  onToggle: (task: Task) => void;
  onAdd: (id: string) => void;
  onSchedule: (id: string) => void;
}) {
  const children = tasks.filter((item) => item.parentId === task.id);
  return (
    <>
      <div className={`task-row ${task.completed ? "done" : ""}`} style={{ marginLeft: Math.min(depth * 20, 60) }}>
        <input
          className="task-check"
          type="checkbox"
          checked={Boolean(task.completed)}
          onChange={() => onToggle(task)}
          aria-label={`完成 ${task.title}`}
        />
        <div>
          <div className="task-name">{task.title}</div>
          <div className="task-tags">
            <span className="tag">{task.estimateMinutes} 分钟</span>
            {task.priority === 1 && <span className="tag priority">优先处理</span>}
            {task.dueDate && <span className="tag">截止 {task.dueDate.slice(5).replace("-", "/")}</span>}
            {children.length > 0 && <span className="tag">{children.length} 个子节点</span>}
          </div>
        </div>
        <div className="task-row-actions">
          <button className="row-btn" onClick={() => onSchedule(task.id)} aria-label="安排时间" title="安排时间">◷</button>
          <button className="row-btn" onClick={() => onAdd(task.id)} aria-label="添加子节点" title="添加子节点">＋</button>
        </div>
      </div>
      {children.map((child) => (
        <TaskBranch
          key={child.id}
          task={child}
          depth={depth + 1}
          tasks={tasks}
          onToggle={onToggle}
          onAdd={onAdd}
          onSchedule={onSchedule}
        />
      ))}
    </>
  );
}

export default function Planner() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selectedRootId, setSelectedRootId] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [selectedDate, setSelectedDate] = useState(dateKey(new Date()));
  const [scheduleMode, setScheduleMode] = useState<"day" | "week">("day");
  const [modal, setModal] = useState<ModalState>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");

  const roots = useMemo(() => tasks.filter((task) => !task.parentId), [tasks]);
  const selectedRoot = roots.find((task) => task.id === selectedRootId) ?? roots[0];

  const descendants = useMemo(() => {
    if (!selectedRoot) return [];
    const result: Task[] = [];
    const walk = (parentId: string) => {
      tasks.filter((task) => task.parentId === parentId).forEach((task) => {
        result.push(task);
        walk(task.id);
      });
    };
    walk(selectedRoot.id);
    return result;
  }, [selectedRoot, tasks]);

  const rootChildren = selectedRoot ? tasks.filter((task) => task.parentId === selectedRoot.id) : [];
  const completedCount = descendants.filter((task) => task.completed).length;
  const progress = descendants.length ? Math.round((completedCount / descendants.length) * 100) : 0;
  const estimate = descendants.reduce((sum, task) => sum + (task.completed ? 0 : task.estimateMinutes), 0);

  const weekDays = useMemo(() => {
    const today = new Date();
    const mondayOffset = (today.getDay() + 6) % 7;
    const monday = new Date(today);
    monday.setDate(today.getDate() - mondayOffset);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      return date;
    });
  }, []);

  const visibleBlocks = blocks
    .filter((block) => block.date === selectedDate)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const availableMinutes = visibleBlocks.filter((b) => b.kind === "available").reduce((sum, b) => sum + minutesBetween(b.startTime, b.endTime), 0);
  const scheduledMinutes = visibleBlocks.filter((b) => b.kind === "scheduled").reduce((sum, b) => sum + minutesBetween(b.startTime, b.endTime), 0);
  const capacity = availableMinutes ? Math.min(100, Math.round((scheduledMinutes / availableMinutes) * 100)) : 0;

  const api = async (method: string, body?: object) => {
    const response = await fetch("/api/planner", {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "操作失败");
    return data;
  };

  useEffect(() => {
    api("GET")
      .then((data) => {
        setTasks(data.tasks);
        setBlocks(data.blocks);
        const firstRoot = data.tasks.find((task: Task) => !task.parentId);
        if (firstRoot) setSelectedRootId(firstRoot.id);
      })
      .catch(() => setToast("暂时无法读取任务，请稍后刷新"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const toggleTask = async (task: Task) => {
    const next = task.completed ? 0 : 1;
    setTasks((current) => current.map((item) => item.id === task.id ? { ...item, completed: next } : item));
    try {
      await api("PATCH", { action: "toggleTask", id: task.id, completed: next });
    } catch {
      setTasks((current) => current.map((item) => item.id === task.id ? task : item));
      setToast("状态没有保存成功");
    }
  };

  const openSchedule = (taskId: string) => {
    setSelectedTaskId(taskId);
    setModal({ type: "block", kind: "scheduled" });
  };

  const submitTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parentId = modal?.type === "child" ? modal.parentId : null;
    try {
      const data = await api("POST", {
        action: "task",
        parentId,
        title: form.get("title"),
        notes: form.get("notes"),
        estimateMinutes: Number(form.get("estimateMinutes")),
        priority: Number(form.get("priority")),
        dueDate: form.get("dueDate") || null,
      });
      setTasks((current) => [...current, data.task]);
      if (!parentId) setSelectedRootId(data.task.id);
      setModal(null);
      setToast(parentId ? "任务节点已添加" : "主任务已创建");
    } catch {
      setToast("任务没有保存成功");
    }
  };

  const submitBlock = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const kind = modal?.type === "block" ? modal.kind : "available";
    try {
      const data = await api("POST", {
        action: "block",
        kind,
        taskId: kind === "scheduled" ? form.get("taskId") : null,
        label: form.get("label"),
        date: form.get("date"),
        startTime: form.get("startTime"),
        endTime: form.get("endTime"),
      });
      setBlocks((current) => [...current, data.block]);
      setSelectedDate(data.block.date);
      setModal(null);
      setToast(kind === "available" ? "空余时间已记录" : "任务已放入日程");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "时间安排没有保存成功");
    }
  };

  const deleteBlock = async (id: string) => {
    const previous = blocks;
    setBlocks((current) => current.filter((block) => block.id !== id));
    try {
      await api("DELETE", { action: "block", id });
    } catch {
      setBlocks(previous);
      setToast("没有删除成功");
    }
  };

  if (loading) {
    return <div className="loading-screen"><div><div className="loader" />正在整理你的任务空间…</div></div>;
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">序</div>
          <div><div className="brand-name">序事</div><div className="brand-tag">把复杂的事，一步步做完</div></div>
        </div>
        <div className="top-actions">
          <div className="today-chip">今天 · {new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(new Date())}</div>
          <div className="avatar">我</div>
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <div className="sidebar-head">
            <div><p className="eyebrow">My work</p><h2>我的主任务</h2></div>
            <button className="icon-btn" onClick={() => setModal({ type: "root" })} aria-label="新建主任务">＋</button>
          </div>
          <div className="project-list">
            {roots.map((root, index) => {
              const nested: Task[] = [];
              const walk = (id: string) => tasks.filter((t) => t.parentId === id).forEach((t) => { nested.push(t); walk(t.id); });
              walk(root.id);
              const done = nested.filter((t) => t.completed).length;
              const pct = nested.length ? Math.round(done / nested.length * 100) : 0;
              return (
                <button key={root.id} className={`project-card ${selectedRoot?.id === root.id ? "active" : ""}`} onClick={() => setSelectedRootId(root.id)}>
                  <div className="project-title"><i className="project-dot" style={{ background: index % 2 ? "#4f866f" : "#e77942" }} />{root.title}</div>
                  <div className="project-meta"><span>{nested.length} 个节点</span><span>{pct}%</span></div>
                  <div className="mini-track"><i style={{ width: `${pct}%` }} /></div>
                </button>
              );
            })}
          </div>
          <div className="sidebar-tip"><strong>先拆，再排</strong>先把任务拆到可以直接执行，再依据当天的空余时间安排，更容易坚持。</div>
        </aside>

        <main className="main-panel">
          {selectedRoot ? (
            <>
              <div className="breadcrumb">我的任务 / {selectedRoot.title}</div>
              <div className="title-row">
                <div><h1>{selectedRoot.title}</h1><p className="task-note">{selectedRoot.notes || "把目标拆成下一步清晰、用时可估算的行动节点。"}</p></div>
                <span className="status-pill">{progress === 100 ? "已完成" : "进行中"}</span>
              </div>
              <div className="summary-card">
                <div className="summary-progress"><small>整体进度</small><div className="progress-track"><i style={{ width: `${progress}%` }} /></div><p>{completedCount} / {descendants.length} 个节点完成</p></div>
                <div className="metric"><b>{Math.floor(estimate / 60)}h {estimate % 60 ? `${estimate % 60}m` : ""}</b><span>剩余预计用时</span></div>
                <div className="metric"><b>{descendants.length - completedCount}</b><span>待完成节点</span></div>
              </div>
              <section className="section">
                <div className="section-head">
                  <div><h3>任务拆解</h3><div className="section-sub">节点还可以继续细分，直到足够具体</div></div>
                  <button className="soft-btn" onClick={() => setModal({ type: "child", parentId: selectedRoot.id })}>＋ 添加节点</button>
                </div>
                <div className="task-tree">
                  {rootChildren.length ? rootChildren.map((task) => (
                    <TaskBranch key={task.id} task={task} depth={0} tasks={tasks} onToggle={toggleTask} onAdd={(id) => setModal({ type: "child", parentId: id })} onSchedule={openSchedule} />
                  )) : <div className="empty">还没有节点。先添加一个可以直接行动的小任务吧。</div>}
                </div>
              </section>
            </>
          ) : <div className="empty">创建第一个主任务，开始拆解你的目标。</div>}
        </main>

        <aside className="schedule-panel">
          <div className="panel-head"><div><p className="eyebrow">Time plan</p><h2>我的时间安排</h2></div><button className="icon-btn" onClick={() => setModal({ type: "block", kind: "available" })} aria-label="记录空余时间">＋</button></div>
          <div className="switcher"><button className={scheduleMode === "day" ? "active" : ""} onClick={() => setScheduleMode("day")}>日程</button><button className={scheduleMode === "week" ? "active" : ""} onClick={() => setScheduleMode("week")}>本周概览</button></div>
          <div className="week-strip">
            {weekDays.map((day) => {
              const key = dateKey(day);
              return <button key={key} className={`day-btn ${key === selectedDate ? "active" : ""} ${key === dateKey(new Date()) ? "today" : ""}`} onClick={() => setSelectedDate(key)}><span>{"一二三四五六日"[weekDays.indexOf(day)]}</span><b>{day.getDate()}</b></button>;
            })}
          </div>
          <div className="timeline-head"><strong>{scheduleMode === "day" ? "当天安排" : "选择日期查看详情"}</strong><span>{visibleBlocks.length} 个时间块</span></div>
          <div className="blocks">
            {visibleBlocks.length ? visibleBlocks.map((block) => {
              const task = tasks.find((item) => item.id === block.taskId);
              return <div key={block.id} className={`block ${block.kind}`}>
                <div className="block-time">{block.startTime} — {block.endTime}</div>
                <div className="block-title">{block.kind === "available" ? (block.label || "空余时间") : (task?.title || block.label || "已安排任务")}</div>
                <div className="block-kind">{block.kind === "available" ? "可用于安排任务" : `已安排 · ${minutesBetween(block.startTime, block.endTime)} 分钟`}</div>
                <button className="row-btn" onClick={() => deleteBlock(block.id)} aria-label="删除时间块">×</button>
              </div>;
            }) : <div className="empty">这一天还没有时间记录。先添加空余时段，再把任务放进去。</div>}
          </div>
          <div className="capacity">
            <div className="capacity-row"><span>已安排 / 可用时间</span><span>{Math.round(scheduledMinutes / 60 * 10) / 10}h / {Math.round(availableMinutes / 60 * 10) / 10}h</span></div>
            <div className="progress-track"><i style={{ width: `${capacity}%`, background: capacity > 85 ? "#e77942" : "#3e7b66" }} /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginTop: 14 }}>
            <button className="soft-btn" onClick={() => setModal({ type: "block", kind: "available" })}>＋ 空余时间</button>
            <button className="primary-btn" onClick={() => setModal({ type: "block", kind: "scheduled" })}>安排任务</button>
          </div>
        </aside>
      </div>

      {modal && (modal.type === "root" || modal.type === "child") && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setModal(null)}>
          <form className="modal" onSubmit={submitTask}>
            <h3>{modal.type === "root" ? "新建主任务" : "添加任务节点"}</h3>
            <p>{modal.type === "root" ? "先定义你想完成的结果，之后再逐层拆解。" : "写成一个具体、可以直接开始的行动。"}</p>
            <div className="form-grid">
              <div className="field full"><label>任务名称</label><input name="title" required autoFocus placeholder={modal.type === "root" ? "例如：完成新产品上线" : "例如：整理首页文案初稿"} /></div>
              <div className="field full"><label>补充说明</label><textarea name="notes" placeholder="完成标准、需要的资料或注意事项…" /></div>
              <div className="field"><label>预计用时（分钟）</label><input name="estimateMinutes" type="number" min="5" step="5" defaultValue="30" required /></div>
              <div className="field"><label>优先级</label><select name="priority" defaultValue="2"><option value="1">高</option><option value="2">普通</option><option value="3">低</option></select></div>
              <div className="field full"><label>截止日期（可选）</label><input name="dueDate" type="date" /></div>
            </div>
            <div className="modal-actions"><button type="button" className="soft-btn" onClick={() => setModal(null)}>取消</button><button className="primary-btn">保存任务</button></div>
          </form>
        </div>
      )}

      {modal?.type === "block" && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setModal(null)}>
          <form className="modal" onSubmit={submitBlock}>
            <h3>{modal.kind === "available" ? "记录空余时间" : "手动安排任务"}</h3>
            <p>{modal.kind === "available" ? "先把真正能支配的时间记下来，之后再决定做什么。" : "由你选择任务和时段，系统只负责清楚地呈现。"}</p>
            <div className="form-grid">
              {modal.kind === "scheduled" ? (
                <div className="field full"><label>选择任务节点</label><select name="taskId" required value={selectedTaskId} onChange={(e) => setSelectedTaskId(e.target.value)}><option value="">请选择</option>{tasks.filter((t) => t.parentId && !t.completed).map((task) => <option key={task.id} value={task.id}>{task.title} · {task.estimateMinutes}分钟</option>)}</select></div>
              ) : <div className="field full"><label>时段备注</label><input name="label" placeholder="例如：晚饭后的专注时间" defaultValue="空余时间" /></div>}
              <div className="field full"><label>日期</label><input name="date" type="date" required defaultValue={selectedDate} /></div>
              <div className="field"><label>开始时间</label><input name="startTime" type="time" required defaultValue="19:00" /></div>
              <div className="field"><label>结束时间</label><input name="endTime" type="time" required defaultValue="20:00" /></div>
            </div>
            <div className="modal-actions"><button type="button" className="soft-btn" onClick={() => setModal(null)}>取消</button><button className="primary-btn">{modal.kind === "available" ? "记录时段" : "加入日程"}</button></div>
          </form>
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
