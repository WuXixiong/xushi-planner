// 纯函数工具：客户端与服务端共享，保持无依赖、可单测。

export type TimeSpan = { startTime: string; endTime: string };
export type PlaceableTask = { id: string; estimateMinutes: number };
export type AutoSchedulePlacement = { taskId: string; startTime: string; endTime: string };
export type AutoScheduleResult = { placements: AutoSchedulePlacement[]; skipped: number };

export const WEEKDAYS = "一二三四五六日";

export const minutesBetween = (start: string, end: string) => {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0, eh * 60 + em - sh * 60 - sm);
};

export const dateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const dayDiff = (dateStr: string, now = new Date()) => {
  const [year, month, day] = dateStr.split("-").map(Number);
  const target = Date.UTC(year, month - 1, day);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86400000);
};

const toMinutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

const toTime = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/**
 * 自动排程：把任务按给定顺序 best-fit 进空余时段。
 * 空余时段中与已排任务重叠的部分会被扣除，任务放入后剩余容量继续参与分配。
 */
export const planAutoSchedule = (available: TimeSpan[], scheduled: TimeSpan[], tasks: PlaceableTask[]): AutoScheduleResult => {
  const segments: { start: number; end: number }[] = [];
  for (const slot of available) {
    let cursor = toMinutes(slot.startTime);
    const end = toMinutes(slot.endTime);
    const overlaps = scheduled
      .filter((row) => toMinutes(row.startTime) < end && toMinutes(row.endTime) > cursor)
      .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
    for (const row of overlaps) {
      const overlapStart = Math.max(cursor, toMinutes(row.startTime));
      const overlapEnd = Math.min(end, toMinutes(row.endTime));
      if (overlapStart > cursor) segments.push({ start: cursor, end: overlapStart });
      cursor = Math.max(cursor, overlapEnd);
    }
    if (cursor < end) segments.push({ start: cursor, end });
  }
  segments.sort((a, b) => a.start - b.start);
  const placements: AutoSchedulePlacement[] = [];
  for (const task of tasks) {
    const estimate = Math.max(5, task.estimateMinutes);
    let bestIndex = -1;
    let bestCapacity = Infinity;
    for (let index = 0; index < segments.length; index++) {
      const capacity = segments[index].end - segments[index].start;
      if (capacity >= estimate && capacity < bestCapacity) {
        bestIndex = index;
        bestCapacity = capacity;
      }
    }
    if (bestIndex < 0) continue;
    placements.push({
      taskId: task.id,
      startTime: toTime(segments[bestIndex].start),
      endTime: toTime(segments[bestIndex].start + estimate),
    });
    segments[bestIndex].start += estimate;
  }
  return { placements, skipped: tasks.length - placements.length };
};
