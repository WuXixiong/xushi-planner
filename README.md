# 序事 · 待办与时间规划

一个"先拆解、再排期"的任务管理工具：把目标逐层拆成可执行的节点，再依据每天的
空余时间安排执行，支持自动排期。基于 [vinext](https://github.com/cloudflare/vinext)
构建，数据存储在 Cloudflare D1（本地开发由 Miniflare 模拟）。

## 功能一览

- **任务拆解**：主任务（根节点）→ 子任务多级树；支持编辑、删除（级联子任务，
  8 秒内可撤销）、上移/下移、拖拽排序
- **完成联动**：勾选父任务会级联完成子树；所有子任务完成后父任务自动完成；
  取消子任务会同步取消祖先链
- **今日待办**：聚合"已逾期 / 今日截止 / 今日已安排"三个区，任务行与项目卡片
  带逾期红色警示
- **时间安排**：记录空余时段、手动安排任务（含时段冲突拦截）、
  `⚡ 自动排期`（按优先级 → 截止日 → 估时排序，best-fit 填入空余时段）、
  日程 / 本周概览双视图与周导航
- **搜索**：按标题 / 说明即时过滤，结果展示完整层级路径
- **体验细节**：`Esc` 关闭弹窗、焦点圈定、`N` 新建主任务、删除撤销、
  跨标签页自动同步、移动端响应式

## 技术栈

- [vinext](https://github.com/cloudflare/vinext)（Next.js 风格 + Cloudflare Workers）
- Cloudflare D1（SQLite，`db/` 中幂等建表，无需迁移即可运行）
- React 19 / TypeScript / Tailwind CSS 4
- 无运行时依赖的纯函数模块 `app/planner-utils.ts`（客户端 / 服务端共享，含自动排程算法）

## 快速开始

前置要求：Node.js `>=22.13.0`

```bash
npm install
npm run dev       # 本地开发 → http://localhost:3000
npm run build     # 构建验证
npm test          # 单测 + SSR 冒烟测试
npm run lint
```

首次打开页面时，若数据库为空会自动播种一组示例数据（个人作品集网站示例）。
示例数据**每个用户只播种一次**：之后即使删光所有任务，也不会再自动出现。
清空本地数据：删除 `.wrangler/state` 后刷新页面即可重新播种。

## 代码结构

```
app/
  planner.tsx            # 主界面（客户端组件）
  planner-utils.ts       # 纯函数：时间计算、自动排程算法（可单测）
  api/planner/route.ts   # 数据 API
db/                      # D1 表结构（schema.ts / index.ts）
tests/                   # node --test 单测 + SSR 冒烟
```

## API 摘要（`/api/planner`）

| 方法 | 操作 |
|---|---|
| `GET` | 读取全部任务与时间块（空库自动播种） |
| `POST` | `{ action: "task" }` 建任务；`{ action: "block" }` 建时间块（排期冲突返回 409）；`{ action: "autoSchedule", date }` 自动排期 |
| `PATCH` | `{ action: "toggleTask" }` 级联完成；`{ action: "updateTask" }` 编辑；`{ action: "moveTask", direction }` 上下移；`{ action: "reorderTasks", orderedIds }` 拖拽排序 |
| `DELETE` | `{ action: "task" }` 级联删除；`{ action: "block" }` 删除时间块 |

身份通过请求头 `oai-authenticated-user-id` 区分（vinext 平台注入），未登录访客
回退到 `local-demo`。

## 局域网 / Tailscale 访问（手机联动）

用 Tailscale 组私有网络，手机和平板无需暴露公网即可访问：

```powershell
# 1. 启动常驻服务（生产模式 + 本地 D1，端口 8420，监听所有网卡）
pwsh scripts/serve.ps1 -Build     # 首次或代码更新后加 -Build 重新构建
# 开机自启：执行一次 scripts/install-startup.cmd（注册到 Windows 启动文件夹）
# 注意：端口用 8420 而非 3000，避免被 VS Code 等开发工具的端口转发抢占

# 2. PC 加入 Tailscale（已安装时直接 up）
tailscale up                       # 浏览器登录一次

# 3. 手机装 Tailscale App 并登录同一账号
# 4. 手机浏览器访问 http://<PC的Tailscale地址>:8420
tailscale ip -4                    # 查 PC 的 Tailscale 地址
```

**可选：HTTPS（启用 PWA 安装体验）**——Tailscale 免费提供 HTTPS 证书：

```powershell
tailscale serve --bg 8420          # 将 https://<机器名>.<tailnet>.ts.net 转发到本机 8420
```

启用 HTTPS 后，手机 Chrome 打开该域名 → 菜单"添加到主屏幕"，序事会以
全屏 App 形态出现（独立图标，PWA 支持已内置：`public/manifest.json` + `sw.js`）。

> 注意：常驻服务依赖这台电脑开机且登录；手机与电脑需在同一 Tailnet。
> 服务是 `wrangler dev` 进程，关闭窗口即停止；数据保存在本地 `.wrangler/state`。

## 发布到 GitHub

```bash
# 方式一：gh CLI（推荐）
winget install GitHub.cli
gh auth login
pwsh scripts/push-github.ps1

# 方式二：Personal Access Token（需 repo 权限）
# 设置环境变量 GITHUB_TOKEN 后运行：
pwsh scripts/push-github.ps1
```

脚本会创建私有仓库 `xushi-planner` 并推送 `main` 分支。

## 部署

本项目面向 vinext / Cloudflare Sites 平台：

- 使用 [Sites](https://developers.cloudflare.com/sites/) 绑定 D1 数据库
  （`.openai/hosting.json` 中声明 binding）
- 本地构建产物通过 `npm run build` 验证
- 详细平台说明见 [vinext 文档](https://github.com/cloudflare/vinext)
