import test from "node:test";
import assert from "node:assert/strict";
import {
  WEEKDAYS,
  dateKey,
  dayDiff,
  minutesBetween,
  planAutoSchedule,
} from "../app/planner-utils.ts";

test("minutesBetween 计算两个时间点的分钟差", () => {
  assert.equal(minutesBetween("19:00", "20:00"), 60);
  assert.equal(minutesBetween("09:15", "10:05"), 50);
  assert.equal(minutesBetween("08:00", "08:00"), 0);
  // 结束早于开始视为 0，而不是负数
  assert.equal(minutesBetween("23:30", "00:30"), 0);
});

test("dateKey 生成 YYYY-MM-DD", () => {
  assert.equal(dateKey(new Date(2026, 7, 10)), "2026-08-10");
  assert.equal(dateKey(new Date(2026, 0, 3)), "2026-01-03");
});

test("dayDiff 计算相对今天的偏移（可注入 now）", () => {
  const now = new Date(2026, 7, 10);
  assert.equal(dayDiff("2026-08-10", now), 0);
  assert.equal(dayDiff("2026-08-12", now), 2);
  assert.equal(dayDiff("2026-08-08", now), -2);
});

test("WEEKDAYS 是七个中文星期字符", () => {
  assert.equal(WEEKDAYS.length, 7);
  assert.equal(WEEKDAYS[0], "一");
  assert.equal(WEEKDAYS[6], "日");
});

test("自动排程：扣除已排时段后按 best-fit 分配", () => {
  const result = planAutoSchedule(
    [{ startTime: "19:00", endTime: "21:00" }],
    [{ startTime: "19:30", endTime: "20:20" }],
    [
      { id: "big", estimateMinutes: 45 }, // 两段容量 30/40 都放不下
      { id: "mid", estimateMinutes: 35 }, // 放进 40 分钟段
      { id: "small", estimateMinutes: 30 }, // 放进 30 分钟段
    ],
  );
  assert.equal(result.skipped, 1);
  assert.equal(result.placements.length, 2);
  const byTask = Object.fromEntries(result.placements.map((p) => [p.taskId, p]));
  assert.deepEqual(byTask.small, { taskId: "small", startTime: "19:00", endTime: "19:30" });
  assert.deepEqual(byTask.mid, { taskId: "mid", startTime: "20:20", endTime: "20:55" });
  // 不越过空余时段边界
  assert.equal(result.placements.some((p) => p.endTime > "21:00"), false);
});

test("自动排程：任务估时小于 5 分钟时按 5 分钟处理", () => {
  const result = planAutoSchedule(
    [{ startTime: "10:00", endTime: "11:00" }],
    [],
    [{ id: "tiny", estimateMinutes: 3 }],
  );
  assert.equal(result.placements.length, 1);
  assert.deepEqual(result.placements[0], { taskId: "tiny", startTime: "10:00", endTime: "10:05" });
});

test("自动排程：无空余时段时全部跳过", () => {
  const result = planAutoSchedule([], [], [{ id: "a", estimateMinutes: 30 }]);
  assert.equal(result.placements.length, 0);
  assert.equal(result.skipped, 1);
});

test("自动排程：已排时段完全覆盖空余时段时全部跳过", () => {
  const result = planAutoSchedule(
    [{ startTime: "19:00", endTime: "21:00" }],
    [{ startTime: "18:00", endTime: "22:00" }],
    [{ id: "a", estimateMinutes: 30 }],
  );
  assert.equal(result.placements.length, 0);
  assert.equal(result.skipped, 1);
});

test("自动排程：多个空余时段跨段分配", () => {
  const result = planAutoSchedule(
    [
      { startTime: "09:00", endTime: "10:00" },
      { startTime: "14:00", endTime: "15:00" },
    ],
    [],
    [
      { id: "a", estimateMinutes: 50 },
      { id: "b", estimateMinutes: 50 },
      { id: "c", estimateMinutes: 10 },
    ],
  );
  // a、b 各占一段 60 分钟；c 的 10 分钟放进 a 留下的剩余容量
  assert.equal(result.placements.length, 3);
  assert.equal(result.skipped, 0);
  const times = result.placements.map((p) => `${p.startTime}-${p.endTime}`).sort();
  assert.deepEqual(times, ["09:00-09:50", "09:50-10:00", "14:00-14:50"].sort());
});
