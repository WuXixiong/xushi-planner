"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { WEEKDAYS, dateKey, dayDiff, minutesBetween } from "./planner-utils";

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
  | { type: "edit"; task: Task }
  | { type: "block"; kind: "available" | "scheduled" }
  | null;

function TaskBranch({
  task,
  depth,
  childrenOf,
  canMoveUp,
  canMoveDown,
  collapsedIds,
  dragId,
  dragParentId,
  dropTargetId,
  onToggle,
  onAdd,
  onSchedule,
  onEdit,
  onDelete,
  onMove,
  onToggleCollapse,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  task: Task;
  depth: number;
  childrenOf: (parentId: string | null) => Task[];
  canMoveUp: boolean;
  canMoveDown: boolean;
  collapsedIds: Set<string>;
  dragId: string | null;
  dragParentId: string | null;
  dropTargetId: string | null;
  onToggle: (task: Task) => void;
  onAdd: (id: string) => void;
  onSchedule: (id: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onMove: (id: string, direction: "up" | "down") => void;
  onToggleCollapse: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragOver: (id: string) => void;
  onDrop: (targetId: string) => void;
}) {
  const children = childrenOf(task.id);
  const collapsed = collapsedIds.has(task.id);
  const canDrop = Boolean(dragId) && dragId !== task.id && dragParentId === task.parentId;
  return (
    <>
      <div
        className={`task-row ${task.completed ? "done" : ""} ${dragId === task.id ? "dragging" : ""} ${dropTargetId === task.id ? "drop-target" : ""}`}
        style={{ marginLeft: Math.min(depth * 20, 60) }}
        draggable
        onDragStart={(event) => { event.stopPropagation(); onDragStart(task.id); }}
        onDragOver={(event) => { if (canDrop) { event.preventDefault(); onDragOver(task.id); } }}
        onDragLeave={() => onDragOver("")}
        onDrop={(event) => { event.preventDefault(); if (canDrop) onDrop(task.id); }}
        onDragEnd={() => onDragStart("")}
      >
        {children.length > 0 ? (
          <button className={`collapse-btn ${collapsed ? "collapsed" : ""}`} onClick={() => onToggleCollapse(task.id)} aria-label={collapsed ? "展开子节点" : "折叠子节点"} title={collapsed ? "展开子节点" : "折叠子节点"}>▾</button>
        ) : <span className="collapse-btn placeholder" aria-hidden="true" />}
        <input
          className="task-check"
          type="checkbox"
          checked={Boolean(task.completed)}
          onChange={() => onToggle(task)}
          aria-label={`完成 ${task.title}`}
        />
        <div>
          <div className="task-name">{task.title}</div>
          {task.notes && <div className="task-notes-inline">{task.notes}</div>}
          <div className="task-tags">
            <span className="tag">{task.estimateMinutes} 分钟</span>
            {task.priority === 1 && <span className="tag priority">优先处理</span>}
            {task.dueDate && (() => {
              const diff = dayDiff(task.dueDate as string);
              if (!task.completed && diff < 0) return <span className="tag overdue-tag">已逾期 {-diff} 天</span>;
              if (!task.completed && diff === 0) return <span className="tag due-tag">今天截止</span>;
              return <span className="tag">截止 {task.dueDate!.slice(5).replace("-", "/")}</span>;
            })()}
            {children.length > 0 && <span className="tag">{children.length} 个子节点</span>}
          </div>
        </div>
        <div className="task-row-actions">
          <button className="row-btn" disabled={!canMoveUp} onClick={() => onMove(task.id, "up")} aria-label="上移" title="上移">↑</button>
          <button className="row-btn" disabled={!canMoveDown} onClick={() => onMove(task.id, "down")} aria-label="下移" title="下移">↓</button>
          <button className="row-btn" onClick={() => onSchedule(task.id)} aria-label="安排时间" title="安排时间">◷</button>
          <button className="row-btn" onClick={() => onEdit(task)} aria-label="编辑任务" title="编辑任务">✎</button>
          <button className="row-btn" onClick={() => onAdd(task.id)} aria-label="添加子节点" title="添加子节点">＋</button>
          <button className="row-btn danger" onClick={() => onDelete(task)} aria-label="删除任务" title="删除任务">✕</button>
        </div>
      </div>
      {!collapsed && children.map((child, index) => (
        <TaskBranch
          key={child.id}
          task={child}
          depth={depth + 1}
          childrenOf={childrenOf}
          canMoveUp={index > 0}
          canMoveDown={index < children.length - 1}
          collapsedIds={collapsedIds}
          dragId={dragId}
          dragParentId={dragParentId}
          dropTargetId={dropTargetId}
          onToggle={onToggle}
          onAdd={onAdd}
          onSchedule={onSchedule}
          onEdit={onEdit}
          onDelete={onDelete}
          onMove={onMove}
          onToggleCollapse={onToggleCollapse}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDrop={onDrop}
        />
      ))}
    </>
  );
}

function TodayRow({
  task,
  path,
  diff,
  onToggle,
  onSchedule,
  onEdit,
}: {
  task: Task;
  path: string[];
  diff: number | null;
  onToggle: (task: Task) => void;
  onSchedule: (id: string) => void;
  onEdit: (task: Task) => void;
}) {
  return (
    <div className="today-row">
      <input className="task-check" type="checkbox" checked={Boolean(task.completed)} onChange={() => onToggle(task)} aria-label={`完成 ${task.title}`} />
      <div>
        <div className="task-name">{task.title}</div>
        <div className="task-tags">
          {path.length > 0 && <span className="tag">{path.join(" › ")}</span>}
          <span className="tag">{task.estimateMinutes} 分钟</span>
          {task.priority === 1 && <span className="tag priority">优先处理</span>}
          {task.dueDate && (diff === null ? <span className="tag">截止 {task.dueDate.slice(5).replace("-", "/")}</span> : diff < 0 ? <span className="tag overdue-tag">已逾期 {-diff} 天</span> : <span className="tag due-tag">今天截止</span>)}
        </div>
      </div>
      <div className="task-row-actions">
        <button className="row-btn" onClick={() => onSchedule(task.id)} aria-label="安排时间" title="安排时间">◷</button>
        <button className="row-btn" onClick={() => onEdit(task)} aria-label="编辑任务" title="编辑任务">✎</button>
      </div>
    </div>
  );
}

export default function Planner() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selectedRootId, setSelectedRootId] = useState("");
  const [view, setView] = useState<"root" | "today">("root");
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [selectedDate, setSelectedDate] = useState(dateKey(new Date()));
  const [scheduleMode, setScheduleMode] = useState<"day" | "week">("day");
  const [weekOffset, setWeekOffset] = useState(0);
  const [modal, setModal] = useState<ModalState>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);
  const [autoScheduling, setAutoScheduling] = useState(false);
  const [query, setQuery] = useState("");
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ label: string; run: () => void } | null>(null);

  const roots = useMemo(() => tasks.filter((task) => !task.parentId), [tasks]);
  const selectedRoot = roots.find((task) => task.id === selectedRootId) ?? roots[0];

  const childrenMap = useMemo(() => {
    const map = new Map<string | null, Task[]>();
    tasks.forEach((task) => {
      const key = task.parentId;
      const list = map.get(key) ?? [];
      list.push(task);
      map.set(key, list);
    });
    return map;
  }, [tasks]);
  const childrenOf = useCallback((parentId: string | null) => childrenMap.get(parentId) ?? [], [childrenMap]);

  const descendants = useMemo(() => {
    if (!selectedRoot) return [];
    const result: Task[] = [];
    const walk = (parentId: string) => {
      childrenOf(parentId).forEach((task) => {
        result.push(task);
        walk(task.id);
      });
    };
    walk(selectedRoot.id);
    return result;
  }, [selectedRoot, childrenOf]);

  const rootChildren = selectedRoot ? childrenOf(selectedRoot.id) : [];
  const completedCount = descendants.filter((task) => task.completed).length;
  const progress = descendants.length ? Math.round((completedCount / descendants.length) * 100) : 0;
  const estimate = descendants.reduce((sum, task) => sum + (task.completed ? 0 : task.estimateMinutes), 0);

  const weekDays = useMemo(() => {
    const today = new Date();
    const mondayOffset = (today.getDay() + 6) % 7;
    const monday = new Date(today);
    monday.setDate(today.getDate() - mondayOffset + weekOffset * 7);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      return date;
    });
  }, [weekOffset]);

  const weekLabel = `${weekDays[0].getMonth() + 1}月${weekDays[0].getDate()}日 – ${weekDays[6].getMonth() + 1}月${weekDays[6].getDate()}日`;
  const todayKey = dateKey(new Date());

  const snapWeekTo = (dateStr: string) => {
    const [year, month, day] = dateStr.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    const offset = (date.getDay() + 6) % 7;
    const monday = new Date(date);
    monday.setDate(date.getDate() - offset);
    const base = new Date();
    const baseMonday = new Date(base);
    baseMonday.setDate(base.getDate() - ((base.getDay() + 6) % 7));
    setWeekOffset(Math.round((monday.getTime() - baseMonday.getTime()) / 86400000 / 7));
  };

  const visibleBlocks = blocks
    .filter((block) => block.date === selectedDate)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const availableMinutes = visibleBlocks.filter((b) => b.kind === "available").reduce((sum, b) => sum + minutesBetween(b.startTime, b.endTime), 0);
  const scheduledMinutes = visibleBlocks.filter((b) => b.kind === "scheduled").reduce((sum, b) => sum + minutesBetween(b.startTime, b.endTime), 0);
  const capacity = availableMinutes ? Math.min(100, Math.round((scheduledMinutes / availableMinutes) * 100)) : 0;

  const schedulableTasks = useMemo(() => {
    const depthOf = new Map<string, number>();
    const walk = (parentId: string | null, depth: number) => {
      childrenOf(parentId).forEach((task) => {
        depthOf.set(task.id, depth);
        walk(task.id, depth + 1);
      });
    };
    walk(null, 0);
    return tasks.filter((task) => !task.completed).map((task) => ({ task, depth: depthOf.get(task.id) ?? 0 }));
  }, [tasks, childrenOf]);

  const flatTasks = useMemo(() => {
    const result: { task: Task; path: string[] }[] = [];
    const walk = (parentId: string | null, path: string[]) => {
      childrenOf(parentId).forEach((task) => {
        result.push({ task, path });
        walk(task.id, [...path, task.title]);
      });
    };
    walk(null, []);
    return result;
  }, [childrenOf]);

  const normalizedQuery = query.trim().toLowerCase();
  const searching = normalizedQuery.length > 0;
  const searchResults = useMemo(() => searching
    ? flatTasks.filter(({ task }) => task.title.toLowerCase().includes(normalizedQuery) || task.notes.toLowerCase().includes(normalizedQuery))
    : [], [flatTasks, searching, normalizedQuery]);

  const isOverdue = (task: Task) => Boolean(task.dueDate) && !task.completed && dayDiff(task.dueDate as string) < 0;
  const isDueToday = (task: Task) => Boolean(task.dueDate) && !task.completed && dayDiff(task.dueDate as string) === 0;
  const overdueTasks = useMemo(() => flatTasks.filter(({ task }) => isOverdue(task)).sort((a, b) => (a.task.dueDate! < b.task.dueDate! ? -1 : 1)), [flatTasks]);
  const dueTodayTasks = useMemo(() => flatTasks.filter(({ task }) => isDueToday(task)), [flatTasks]);
  const todayScheduled = useMemo(() => blocks.filter((block) => block.date === todayKey && block.kind === "scheduled").sort((a, b) => a.startTime.localeCompare(b.startTime)), [blocks, todayKey]);
  const todayScheduledMinutes = todayScheduled.reduce((sum, block) => sum + minutesBetween(block.startTime, block.endTime), 0);
  const todayAvailableMinutes = useMemo(() => blocks.filter((block) => block.date === todayKey && block.kind === "available").reduce((sum, block) => sum + minutesBetween(block.startTime, block.endTime), 0), [blocks, todayKey]);
  const todayCapacity = todayAvailableMinutes ? Math.min(100, Math.round((todayScheduledMinutes / todayAvailableMinutes) * 100)) : 0;

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
    if (!toast && !undo) return;
    const timer = window.setTimeout(() => { setToast(""); setUndo(null); }, undo ? 8000 : 2600);
    return () => window.clearTimeout(timer);
  }, [toast, undo]);

  useEffect(() => {
    if (!modal) return;
    const panel = document.querySelector(".modal") as HTMLElement | null;
    const focusables = panel ? Array.from(panel.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')) : [];
    focusables[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setModal(null); return; }
      if (event.key !== "Tab" || !focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [modal]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "n" || modal || saving) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) return;
      setModal({ type: "root" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal, saving]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      api("GET")
        .then((data) => {
          setTasks((current) => JSON.stringify(current) === JSON.stringify(data.tasks) ? current : data.tasks);
          setBlocks((current) => JSON.stringify(current) === JSON.stringify(data.blocks) ? current : data.blocks);
        })
        .catch(() => {});
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  const toggleTask = async (task: Task) => {
    const next = task.completed ? 0 : 1;
    setTasks((current) => current.map((item) => item.id === task.id ? { ...item, completed: next } : item));
    try {
      const data = await api("PATCH", { action: "toggleTask", id: task.id, completed: next });
      if (Array.isArray(data.tasks)) setTasks(data.tasks);
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
    const current = modal;
    const payload = {
      title: form.get("title"),
      notes: form.get("notes"),
      estimateMinutes: Number(form.get("estimateMinutes")),
      priority: Number(form.get("priority")),
      dueDate: form.get("dueDate") || null,
    };
    setSaving(true);
    try {
      if (current?.type === "edit") {
        const data = await api("PATCH", { action: "updateTask", id: current.task.id, ...payload });
        setTasks((list) => list.map((item) => item.id === data.task.id ? data.task : item));
        setToast("任务已更新");
      } else {
        const parentId = current?.type === "child" ? current.parentId : null;
        const data = await api("POST", { action: "task", parentId, ...payload });
        setTasks((list) => [...list, data.task]);
        if (!parentId) setSelectedRootId(data.task.id);
        setToast(parentId ? "任务节点已添加" : "主任务已创建");
      }
      setModal(null);
    } catch {
      setToast("任务没有保存成功");
    } finally {
      setSaving(false);
    }
  };

  const submitBlock = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const current = modal;
    const kind = current?.type === "block" ? current.kind : "available";
    const date = String(form.get("date"));
    const startTime = String(form.get("startTime"));
    const endTime = String(form.get("endTime"));
    if (kind === "scheduled" && date && startTime && endTime) {
      const clash = blocks.find((block) => block.date === date && block.kind === "scheduled" && block.startTime < endTime && block.endTime > startTime);
      if (clash) {
        setToast(`该时段与已有安排冲突：${clash.startTime}—${clash.endTime}`);
        return;
      }
    }
    setSaving(true);
    try {
      const data = await api("POST", {
        action: "block",
        kind,
        taskId: kind === "scheduled" ? form.get("taskId") : null,
        label: form.get("label"),
        date,
        startTime,
        endTime,
      });
      setBlocks((list) => [...list, data.block]);
      setSelectedDate(data.block.date);
      snapWeekTo(data.block.date);
      setModal(null);
      setToast(kind === "available" ? "空余时间已记录" : "任务已放入日程");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "时间安排没有保存成功");
    } finally {
      setSaving(false);
    }
  };

  const autoSchedule = async () => {
    setAutoScheduling(true);
    try {
      const data = await api("POST", { action: "autoSchedule", date: selectedDate });
      setBlocks((list) => [...list, ...data.blocks]);
      const placed = Number(data.scheduled || 0);
      const skipped = Number(data.skipped || 0);
      setToast(placed ? (skipped ? `已自动安排 ${placed} 个任务，${skipped} 个因时间不足未安排` : `已自动安排 ${placed} 个任务`) : "这一天没有可安排的任务");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "自动排期失败");
    } finally {
      setAutoScheduling(false);
    }
  };

  const deleteBlock = async (id: string) => {
    if (!window.confirm("删除这个时间块？")) return;
    const previous = blocks;
    setBlocks((current) => current.filter((block) => block.id !== id));
    try {
      await api("DELETE", { action: "block", id });
    } catch {
      setBlocks(previous);
      setToast("没有删除成功");
    }
  };

  const deleteTask = async (task: Task) => {
    if (!window.confirm(`删除「${task.title}」以及它的所有子任务？`)) return;
    try {
      const data = await api("DELETE", { action: "task", id: task.id });
      const removed = new Set(data.taskIds as string[]);
      const removedBlocks = new Set(data.blockIds as string[]);
      const snapshotTasks = tasks.filter((item) => removed.has(item.id));
      const snapshotBlocks = blocks.filter((block) => removedBlocks.has(block.id));
      setTasks((list) => list.filter((item) => !removed.has(item.id)));
      setBlocks((list) => list.filter((block) => !removedBlocks.has(block.id)));
      if (removed.has(selectedRootId)) setSelectedRootId("");
      setToast("任务已删除");
      setUndo({ label: task.title, run: () => restoreDeleted(snapshotTasks, snapshotBlocks) });
    } catch {
      setToast("没有删除成功");
    }
  };

  const restoreDeleted = async (snapshotTasks: Task[], snapshotBlocks: Block[]) => {
    setUndo(null);
    setToast("");
    try {
      const byId = new Map(snapshotTasks.map((item) => [item.id, item]));
      const idMap = new Map<string, string>();
      const ordered: Task[] = [];
      const queue = snapshotTasks.filter((item) => !byId.has(item.parentId ?? "")).map((item) => item.id);
      const seen = new Set<string>();
      while (queue.length) {
        const current = queue.shift() as string;
        if (seen.has(current)) continue;
        seen.add(current);
        const item = byId.get(current);
        if (item) {
          ordered.push(item);
          snapshotTasks.filter((child) => child.parentId === current).forEach((child) => queue.push(child.id));
        }
      }
      for (const item of ordered) {
        const data = await api("POST", {
          action: "task",
          parentId: item.parentId ? (idMap.get(item.parentId) ?? item.parentId) : null,
          title: item.title,
          notes: item.notes,
          estimateMinutes: item.estimateMinutes,
          priority: item.priority,
          dueDate: item.dueDate,
          completed: item.completed,
        });
        idMap.set(item.id, data.task.id);
      }
      for (const block of snapshotBlocks) {
        await api("POST", {
          action: "block",
          kind: block.kind,
          taskId: block.taskId ? (idMap.get(block.taskId) ?? null) : null,
          label: block.label,
          date: block.date,
          startTime: block.startTime,
          endTime: block.endTime,
        });
      }
      const fresh = await api("GET");
      setTasks(fresh.tasks);
      setBlocks(fresh.blocks);
      setToast("任务已恢复");
    } catch {
      setToast("恢复失败，请手动重新创建");
    }
  };

  const toggleCollapse = (id: string) => {
    setCollapsedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const draggedTask = dragId ? tasks.find((item) => item.id === dragId) ?? null : null;
  const dragParentId = draggedTask?.parentId ?? null;

  const reorderTasks = async (parentId: string | null, orderedIds: string[]) => {
    try {
      const data = await api("PATCH", { action: "reorderTasks", parentId, orderedIds });
      if (Array.isArray(data.tasks)) setTasks(data.tasks);
    } catch {
      setToast("排序没有保存成功");
    }
  };

  const handleDropOn = (targetId: string) => {
    const dragged = dragId ? tasks.find((item) => item.id === dragId) : undefined;
    const target = tasks.find((item) => item.id === targetId);
    if (!dragged || !target || dragged.parentId !== target.parentId) return;
    const siblings = tasks.filter((item) => item.parentId === dragged.parentId).map((item) => item.id);
    const from = siblings.indexOf(dragged.id);
    const to = siblings.indexOf(targetId);
    if (from < 0 || to < 0) return;
    siblings.splice(from, 1);
    siblings.splice(to, 0, dragged.id);
    setDragId(null);
    setDropTargetId(null);
    reorderTasks(dragged.parentId, siblings);
  };

  const moveTask = async (id: string, direction: "up" | "down") => {
    try {
      const data = await api("PATCH", { action: "moveTask", id, direction });
      if (Array.isArray(data.tasks)) setTasks(data.tasks);
    } catch {
      setToast("排序没有保存成功");
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
          <input className="search-input" type="search" placeholder="搜索任务…" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="搜索任务" />
          <button className={`project-card today-card ${view === "today" && !searching ? "active" : ""}`} onClick={() => { setView("today"); setQuery(""); }}>
            <div className="project-title"><i className="project-dot today-dot" />今日待办</div>
            <div className="project-meta"><span>{overdueTasks.length ? <b className="overdue-count">{overdueTasks.length} 逾期</b> : "无逾期"} · {dueTodayTasks.length} 今日截止</span><span>{todayScheduledMinutes ? `${Math.round(todayScheduledMinutes / 60 * 10) / 10}h 已排` : "未安排"}</span></div>
            {todayAvailableMinutes > 0 && <div className="mini-track"><i style={{ width: `${todayCapacity}%`, background: todayCapacity > 85 ? "#e77942" : "#3e7b66" }} /></div>}
          </button>
          <div className="project-list">
            {roots.map((root, index) => {
              const nested: Task[] = [];
              const walk = (id: string) => childrenOf(id).forEach((t) => { nested.push(t); walk(t.id); });
              walk(root.id);
              const done = nested.filter((t) => t.completed).length;
              const pct = nested.length ? Math.round(done / nested.length * 100) : 0;
              const overdue = nested.filter((t) => isOverdue(t)).length;
              return (
                <button key={root.id} className={`project-card ${selectedRoot?.id === root.id && view === "root" && !searching ? "active" : ""}`} onClick={() => { setSelectedRootId(root.id); setView("root"); setQuery(""); }}>
                  <div className="project-title"><i className="project-dot" style={{ background: index % 2 ? "#4f866f" : "#e77942" }} />{root.title}</div>
                  <div className="project-meta"><span>{nested.length} 个节点{overdue ? <b className="overdue-count"> · {overdue} 逾期</b> : ""}</span><span>{pct}%</span></div>
                  <div className="mini-track"><i style={{ width: `${pct}%` }} /></div>
                </button>
              );
            })}
          </div>
          <div className="sidebar-tip"><strong>先拆，再排</strong>先把任务拆到可以直接执行，再依据当天的空余时间安排，更容易坚持。</div>
        </aside>

        <main className="main-panel">
          {searching ? (
            <>
              <div className="breadcrumb">搜索 / {query.trim()}</div>
              <div className="title-row"><div><h1>搜索结果</h1><p className="task-note">共找到 {searchResults.length} 个匹配任务。</p></div></div>
              {searchResults.length ? (
                <div className="task-tree">{searchResults.map(({ task, path }) => (
                  <TodayRow key={task.id} task={task} path={path} diff={task.dueDate ? dayDiff(task.dueDate) : null} onToggle={toggleTask} onSchedule={openSchedule} onEdit={(task) => setModal({ type: "edit", task })} />
                ))}</div>
              ) : <div className="empty">没有找到与「{query.trim()}」相关的任务。</div>}
            </>
          ) : view === "today" ? (
            <>
              <div className="breadcrumb">我的任务 / 今日待办</div>
              <div className="title-row">
                <div><h1>今天</h1><p className="task-note">先处理逾期的任务，再完成今天截止的，剩下的按空余时间推进。</p></div>
                <span className="status-pill">{new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(new Date())}</span>
              </div>
              {overdueTasks.length > 0 && (
                <section className="section overdue-section">
                  <div className="section-head"><div><h3>已逾期</h3><div className="section-sub">越早处理，越容易挽回节奏</div></div></div>
                  <div className="task-tree">{overdueTasks.map(({ task, path }) => (
                    <TodayRow key={task.id} task={task} path={path} diff={dayDiff(task.dueDate as string)} onToggle={toggleTask} onSchedule={openSchedule} onEdit={(task) => setModal({ type: "edit", task })} />
                  ))}</div>
                </section>
              )}
              {dueTodayTasks.length > 0 && (
                <section className="section">
                  <div className="section-head"><div><h3>今天截止</h3><div className="section-sub">完成它们，今天就清账</div></div></div>
                  <div className="task-tree">{dueTodayTasks.map(({ task, path }) => (
                    <TodayRow key={task.id} task={task} path={path} diff={0} onToggle={toggleTask} onSchedule={openSchedule} onEdit={(task) => setModal({ type: "edit", task })} />
                  ))}</div>
                </section>
              )}
              <section className="section">
                <div className="section-head"><div><h3>今日已安排</h3><div className="section-sub">{todayAvailableMinutes ? `空余 ${Math.round(todayAvailableMinutes / 60 * 10) / 10}h · 已排 ${Math.round(todayScheduledMinutes / 60 * 10) / 10}h` : "今天还没有记录空余时间"}</div></div></div>
                {todayScheduled.length ? (
                  <div className="blocks today-blocks">{todayScheduled.map((block) => {
                    const task = tasks.find((item) => item.id === block.taskId);
                    return <div key={block.id} className="block scheduled">
                      <div className="block-time">{block.startTime} — {block.endTime}</div>
                      <div className="block-title">{task?.title || block.label || "已安排任务"}</div>
                      <div className="block-kind">已安排 · {minutesBetween(block.startTime, block.endTime)} 分钟</div>
                      <button className="row-btn" onClick={() => deleteBlock(block.id)} aria-label="删除时间块">×</button>
                    </div>;
                  })}</div>
                ) : <div className="empty">今天还没有安排任务。到右侧面板点「安排任务」或「⚡ 自动排期」。</div>}
              </section>
              {!overdueTasks.length && !dueTodayTasks.length && (
                <div className="today-clear">今天没有逾期或到期的任务 🎉 可以看看主任务，或安排一下今天的时间。</div>
              )}
            </>
          ) : selectedRoot ? (
            <>
              <div className="breadcrumb">我的任务 / {selectedRoot.title}</div>
              <div className="title-row">
                <div><h1>{selectedRoot.title}</h1><p className="task-note">{selectedRoot.notes || "把目标拆成下一步清晰、用时可估算的行动节点。"}</p></div>
                <button className={`status-pill ${selectedRoot.completed ? "pill-done" : ""}`} onClick={() => toggleTask(selectedRoot)} aria-label={selectedRoot.completed ? "标记为进行中" : "标记为已完成"} title={selectedRoot.completed ? "点击恢复为进行中" : "点击标记主任务已完成"}>
                  {selectedRoot.completed ? "已完成" : progress === 100 ? "待确认" : "进行中"}
                </button>
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
                  {rootChildren.length ? rootChildren.map((task, index) => (
                    <TaskBranch
                      key={task.id}
                      task={task}
                      depth={0}
                      childrenOf={childrenOf}
                      canMoveUp={index > 0}
                      canMoveDown={index < rootChildren.length - 1}
                      collapsedIds={collapsedIds}
                      dragId={dragId}
                      dragParentId={dragParentId}
                      dropTargetId={dropTargetId}
                      onToggle={toggleTask}
                      onAdd={(id) => setModal({ type: "child", parentId: id })}
                      onSchedule={openSchedule}
                      onEdit={(task) => setModal({ type: "edit", task })}
                      onDelete={deleteTask}
                      onMove={moveTask}
                      onToggleCollapse={toggleCollapse}
                      onDragStart={(id) => { setDragId(id); setDropTargetId(null); }}
                      onDragOver={setDropTargetId}
                      onDrop={handleDropOn}
                    />
                  )) : <div className="empty">还没有节点。先添加一个可以直接行动的小任务吧。</div>}
                </div>
              </section>
            </>
          ) : <div className="empty">创建第一个主任务，开始拆解你的目标。</div>}
        </main>

        <aside className="schedule-panel">
          <div className="panel-head"><div><p className="eyebrow">Time plan</p><h2>我的时间安排</h2></div><button className="icon-btn" onClick={() => setModal({ type: "block", kind: "available" })} aria-label="记录空余时间">＋</button></div>
          <div className="switcher"><button className={scheduleMode === "day" ? "active" : ""} onClick={() => setScheduleMode("day")}>日程</button><button className={scheduleMode === "week" ? "active" : ""} onClick={() => setScheduleMode("week")}>本周概览</button></div>
          <div className="week-nav">
            <button className="nav-btn" onClick={() => setWeekOffset((offset) => offset - 1)} aria-label="上一周">‹</button>
            <span>{weekLabel}</span>
            <button className="nav-btn" onClick={() => setWeekOffset((offset) => offset + 1)} aria-label="下一周">›</button>
          </div>
          <div className="week-strip">
            {weekDays.map((day) => {
              const key = dateKey(day);
              return <button key={key} className={`day-btn ${key === selectedDate ? "active" : ""} ${key === todayKey ? "today" : ""}`} onClick={() => setSelectedDate(key)}><span>{WEEKDAYS[weekDays.indexOf(day)]}</span><b>{day.getDate()}</b></button>;
            })}
          </div>
          <div className="timeline-head"><strong>{scheduleMode === "day" ? "当天安排" : "本周概览"}</strong><span>{scheduleMode === "day" ? `${visibleBlocks.length} 个时间块` : "点击任意一天查看详情"}</span></div>
          {scheduleMode === "week" ? (
            <div className="week-grid">
              {weekDays.map((day) => {
                const key = dateKey(day);
                const dayBlocks = blocks.filter((block) => block.date === key).sort((a, b) => a.startTime.localeCompare(b.startTime));
                const avail = dayBlocks.filter((b) => b.kind === "available").reduce((sum, b) => sum + minutesBetween(b.startTime, b.endTime), 0);
                const sched = dayBlocks.filter((b) => b.kind === "scheduled").reduce((sum, b) => sum + minutesBetween(b.startTime, b.endTime), 0);
                const pct = avail ? Math.min(100, Math.round((sched / avail) * 100)) : 0;
                return (
                  <button key={key} className={`week-day ${key === selectedDate ? "active" : ""} ${key === todayKey ? "today" : ""}`} onClick={() => { setSelectedDate(key); setScheduleMode("day"); }}>
                    <div className="week-day-head"><span>{WEEKDAYS[weekDays.indexOf(day)]}</span><b>{day.getDate()}</b></div>
                    {dayBlocks.length ? (
                      <>
                        <div className="week-day-bar"><i style={{ width: `${pct}%` }} /></div>
                        <div className="week-day-blocks">
                          {dayBlocks.slice(0, 3).map((block) => {
                            const task = tasks.find((item) => item.id === block.taskId);
                            return <div key={block.id} className={`week-chip ${block.kind}`}>{block.startTime} {block.kind === "scheduled" ? (task?.title || block.label || "已安排任务") : (block.label || "空余时间")}</div>;
                          })}
                        </div>
                        {dayBlocks.length > 3 && <div className="week-day-more">+{dayBlocks.length - 3} 个时间块</div>}
                      </>
                    ) : <div className="week-day-empty">无安排</div>}
                  </button>
                );
              })}
            </div>
          ) : (
            <>
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
            </>
          )}
          <div className="btn-grid3">
            <button className="soft-btn" onClick={() => setModal({ type: "block", kind: "available" })}>＋ 空余时间</button>
            <button className="soft-btn" onClick={autoSchedule} disabled={autoScheduling}>{autoScheduling ? "排期中…" : "⚡ 自动排期"}</button>
            <button className="primary-btn" onClick={() => setModal({ type: "block", kind: "scheduled" })}>安排任务</button>
          </div>
        </aside>
      </div>

      {modal && (modal.type === "root" || modal.type === "child" || modal.type === "edit") && (
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- 点击遮罩空白处关闭弹窗
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setModal(null)}>
          <form key={modal.type === "edit" ? `edit-${modal.task.id}` : modal.type} className="modal" role="dialog" aria-modal="true" aria-label={modal.type === "edit" ? "编辑任务" : modal.type === "root" ? "新建主任务" : "添加任务节点"} onSubmit={submitTask}>
            <h3>{modal.type === "edit" ? "编辑任务" : modal.type === "root" ? "新建主任务" : "添加任务节点"}</h3>
            <p>{modal.type === "edit" ? "修改任务信息，保存后立即生效。" : modal.type === "root" ? "先定义你想完成的结果，之后再逐层拆解。" : "写成一个具体、可以直接开始的行动。"}</p>
            <div className="form-grid">
              <div className="field full"><label htmlFor="task-title">任务名称</label>{/* eslint-disable-line jsx-a11y/no-autofocus -- 弹窗打开时聚焦标题输入框 */}<input id="task-title" name="title" required autoFocus placeholder={modal.type === "root" ? "例如：完成新产品上线" : "例如：整理首页文案初稿"} defaultValue={modal.type === "edit" ? modal.task.title : undefined} /></div>
              <div className="field full"><label htmlFor="task-notes">补充说明</label><textarea id="task-notes" name="notes" placeholder="完成标准、需要的资料或注意事项…" defaultValue={modal.type === "edit" ? modal.task.notes : undefined} /></div>
              <div className="field"><label htmlFor="task-estimate">预计用时（分钟）</label><input id="task-estimate" name="estimateMinutes" type="number" min="5" step="5" defaultValue={modal.type === "edit" ? modal.task.estimateMinutes : 30} required /></div>
              <div className="field"><label htmlFor="task-priority">优先级</label><select id="task-priority" name="priority" defaultValue={modal.type === "edit" ? modal.task.priority : 2}><option value="1">高</option><option value="2">普通</option><option value="3">低</option></select></div>
              <div className="field full"><label htmlFor="task-due">截止日期（可选）</label><input id="task-due" name="dueDate" type="date" defaultValue={modal.type === "edit" ? modal.task.dueDate ?? "" : undefined} /></div>
            </div>
            <div className="modal-actions"><button type="button" className="soft-btn" onClick={() => setModal(null)} disabled={saving}>取消</button><button className="primary-btn" disabled={saving}>{saving ? "保存中…" : modal.type === "edit" ? "保存修改" : "保存任务"}</button></div>
          </form>
        </div>
      )}

      {modal?.type === "block" && (
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- 点击遮罩空白处关闭弹窗
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setModal(null)}>
          <form className="modal" role="dialog" aria-modal="true" aria-label={modal.kind === "available" ? "记录空余时间" : "手动安排任务"} onSubmit={submitBlock}>
            <h3>{modal.kind === "available" ? "记录空余时间" : "手动安排任务"}</h3>
            <p>{modal.kind === "available" ? "先把真正能支配的时间记下来，之后再决定做什么。" : "由你选择任务和时段，系统会提示时段冲突。"}</p>
            <div className="form-grid">
              {modal.kind === "scheduled" ? (
                <div className="field full"><label htmlFor="block-task">选择任务节点</label><select id="block-task" name="taskId" required value={selectedTaskId} onChange={(e) => setSelectedTaskId(e.target.value)}><option value="">请选择</option>{schedulableTasks.map(({ task, depth }) => <option key={task.id} value={task.id}>{"　".repeat(depth)}{task.title} · {task.estimateMinutes}分钟</option>)}</select></div>
              ) : <div className="field full"><label htmlFor="block-label">时段备注</label><input id="block-label" name="label" placeholder="例如：晚饭后的专注时间" defaultValue="空余时间" /></div>}
              <div className="field full"><label htmlFor="block-date">日期</label><input id="block-date" name="date" type="date" required defaultValue={selectedDate} /></div>
              <div className="field"><label htmlFor="block-start">开始时间</label><input id="block-start" name="startTime" type="time" required defaultValue="19:00" /></div>
              <div className="field"><label htmlFor="block-end">结束时间</label><input id="block-end" name="endTime" type="time" required defaultValue="20:00" /></div>
            </div>
            <div className="modal-actions"><button type="button" className="soft-btn" onClick={() => setModal(null)} disabled={saving}>取消</button><button className="primary-btn" disabled={saving}>{saving ? "保存中…" : modal.kind === "available" ? "记录时段" : "加入日程"}</button></div>
          </form>
        </div>
      )}
      {toast && <div className="toast" role="status">{toast}{undo && <button className="toast-btn" onClick={() => { const run = undo.run; setUndo(null); setToast(""); run(); }}>撤销</button>}</div>}
    </div>
  );
}
