# 序事 · 待办与时间规划

一个"先拆解、再排期"的任务管理工具：把目标逐层拆成可执行的节点，再依据每天的
空余时间安排执行，支持自动排期。运行在 [vinext](https://github.com/cloudflare/vinext)
之上，数据存储在 Cloudflare D1（本地开发由 Miniflare 模拟）。

## 功能一览

- **任务拆解**：主任务（根节点）→ 子任务多级树；支持编辑、删除（级联子任务，
  可撤销）、上移/下移、拖拽排序
- **完成联动**：勾选父任务会级联完成子树；所有子任务完成后父任务自动完成；
  取消子任务会同步取消祖先链
- **今日待办**：侧栏入口聚合"已逾期 / 今日截止 / 今日已安排"，任务行与项目卡片
  有逾期红色警示
- **时间安排**：记录空余时段、手动安排任务（含时段冲突拦截）、
  `⚡ 自动排期`（按优先级 → 截止日 → 估时排序，best-fit 填入空余时段）、
  日程/本周概览双视图与周导航
- **搜索**：按标题/说明即时过滤，展示完整层级路径
- **体验细节**：Esc 关闭弹窗、焦点圈定、`N` 新建主任务、删除撤销（8 秒内）、
  跨标签页自动同步、移动端响应式

## 代码结构

- `app/planner.tsx` — 主界面（客户端组件）
- `app/api/planner/route.ts` — 数据 API（tasks / time_blocks 的增删改查与自动排期）
- `app/planner-utils.ts` — 无依赖纯函数（时间计算、自动排程算法），客户端/服务端共享
- `db/` — D1 表结构与建表逻辑（`ensureSchema` 幂等建表，无需迁移即可运行）
- `tests/` — `node --test` 单测（工具函数 + SSR 冒烟）

## API 摘要（`/api/planner`）

- `GET` — 读取全部任务与时间块（空库自动播种示例数据）
- `POST` — `{ action: "task" }` 建任务；`{ action: "block" }` 建时间块（排期冲突返回 409）；
  `{ action: "autoSchedule", date }` 自动排期
- `PATCH` — `{ action: "toggleTask" }`（级联完成）；`{ action: "updateTask" }` 编辑；
  `{ action: "moveTask", direction }` 上下移；`{ action: "reorderTasks", orderedIds }` 拖拽排序
- `DELETE` — `{ action: "task" }` 级联删除；`{ action: "block" }` 删除时间块

身份通过请求头 `oai-authenticated-user-id` 区分，未登录访客回退到 `local-demo`。

## 开发命令

```bash
npm install
npm run dev       # 本地开发（http://localhost:3000）
npm run build     # 构建验证
npm test          # 单测 + SSR 冒烟
npm run lint
```

---

# vinext-starter

A clean full-stack starter running on
[vinext](https://github.com/cloudflare/vinext), with optional Cloudflare D1 and
Drizzle support.

## Prerequisites

- Node.js `>=22.13.0`

## Quick Start

```bash
npm install
npm run dev
npm run build
```

This starter does not use `wrangler.jsonc`.

## Included Shape

- edit site code under `app/`
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `db/schema.ts` starts intentionally empty
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Workspace Auth Headers

Signed-in visitors receive both `oai-authenticated-user-id` and `oai-authenticated-user-email`. Private Sites require every visitor to sign in; public Sites may also have anonymous visitors, for whom neither header is present.

The user ID is stable for the same user on the same Site and different across Sites. Email and name are intended for display or contact purposes.

SIWC-authenticated workspace sites may also receive
`oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty
`name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by
`oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const userId = requestHeaders.get("oai-authenticated-user-id");
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs
optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send
  anonymous visitors through Sign in with ChatGPT.
- Use `chatGPTSignInPath(returnTo)` and `chatGPTSignOutPath(returnTo)` for
  browser links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in
  or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because
  they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the
OAuth cookies, and identity header injection. Do not implement app routes for
those reserved paths. Routes that do not import and call the helper remain
anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the
Sites hosting platform's access policy controls for workspace-wide restrictions,
or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write
actions tied to the current ChatGPT user. Leave public content anonymous.

## Useful Commands

- `npm run dev`: start local development
- `npm run build`: verify the vinext build output
- `npm test`: build the starter and verify its rendered loading skeleton
- `npm run db:generate`: generate Drizzle migrations after schema changes

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
