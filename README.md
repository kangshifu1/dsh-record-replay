# dsh-record-replay · DSH 录制回放（Record & Replay）

DSH Web GUI 的「录制回放」插件：DSH 本身会**自动录制**每一场会话（`~/.dsh/sessions` 下的 `session.jsonl.zstd` 完整转录），本插件把「录制」变成可用资产——回放时间线、导出可分享的回放包、导入别人分享的回放包、一键复刻到全新会话重新执行。

> 类似 Codex 的 record & replay：录制是自动的，本插件补齐「回放 / 分享 / 复刻」这一半。

## 能力

| 功能 | 说明 |
| --- | --- |
| 会话库 | 侧边栏「录制回放」入口，列出本机全部已录制会话（标题 / 项目 / 时间 / 消息数） |
| 时间线回放 | 以可读时间线查看任意会话：用户消息、助手回复（推理过程可折叠）、工具调用与参数、工具结果（长文可展开），支持搜索过滤 |
| 导出回放包 | 把任意会话导出为单个 `dsh-replay-pack` JSON（`*.replay.json`），git 友好、体积小，可直接放到 GitHub 仓库分享 |
| 导入回放包 | 导入队友 / GitHub 上分享的 `.replay.json`，存到 `~/.dsh/replay-packs`，可查看、删除、复刻 |
| 复刻执行 | 把录制会话的**用户消息**按原顺序逐条发送到全新会话，让 agent 真实重新执行一遍（可用于复现、回归、教学、模板化流程） |

## 安装

```bash
# 本地路径安装（开发 / 自用，推荐）
dsh plugin --profile web add link:/path/to/dsh-record-replay

# 或从 npm 安装（发布后）
dsh plugin --profile web add dsh-record-replay
```

安装后**重启 dsh web GUI**（插件集会变更需要重启生效）。侧边栏出现「录制回放」入口即成功。

> 原理：`dsh plugin` 是 pnpm 转发器——把包装进 profile 的 `node_modules`，检测到 `dsh.bundle` 声明后把 `cordis.patch.yml` 并入 bundle 层，插件行进入 roster；浏览器半区按 `dsh.client` 声明以 `/plugins/dsh-record-replay/client.js` 加载。

## 使用

1. 点侧边栏「录制回放」打开面板。
2. **会话** tab：任一会话可「回放」（时间线）、「导出」（下载回放包）、「复刻」（开新会话重新执行）。
3. **回放包** tab：导入 `.replay.json`，管理已导入的包。

## 回放包格式

```json
{
  "format": "dsh-replay-pack",
  "version": 1,
  "meta": { "title": "...", "cwd": "...", "createdAt": 0, "agentPreset": "code", "exportedAt": 0, "sourceSessionId": "session-..." },
  "items": [
    { "kind": "user", "turn": 1, "step": 1, "text": "...", "time": 0 },
    { "kind": "assistant", "turn": 1, "step": 1, "text": "...", "reasoning": "...", "time": 0 },
    { "kind": "tool", "turn": 1, "step": 1, "name": "run_code", "callId": "...", "argsText": "{...}", "time": 0 },
    { "kind": "result", "turn": 1, "step": 1, "callId": "...", "text": "...", "time": 0 }
  ]
}
```

## 数据与隐私

- **读取**：`~/.dsh/sessions/**/session.jsonl(.zstd)`（DSH 自动录制，本插件只读）。
- **写入**：`~/.dsh/replay-packs/`（导入的回放包）。
- **注意**：回放包含完整对话与工具输出，可能含密钥 / 敏感信息——分享前请自行脱敏。API 路由仅限 loopback（本机浏览器同源），LAN 暴露的 dsh web 部署不会提供服务。

## 开发

```bash
pnpm install
pnpm build        # tsc 编译宿主半区到 lib/，tsdown 打包浏览器半区到 lib/client.js
pnpm smoke        # 对本机真实会话跑一遍 扫描→解析→建包→解析→存库 冒烟测试
```

## 架构

双面插件（dsh-web-ui 家族约定）：

- **宿主半区**（`src/index.ts`，node）：`SessionStore` 扫描解码会话、`timeline.ts` 蒸馏时间线、`replay-pack.ts` / `pack-store.ts` 回放包、`routes.ts` 提供 `/api/dsh-record-replay/*`，并向 agent 宣告插件存在（system-prompt section）。zstd 解码使用 vendored [fzstd](https://github.com/101arrowz/fzstd)（MIT，支持多帧流），无运行时第三方依赖。
- **浏览器半区**（`src/client/`）：侧边栏入口（DOM 级注入、自愈）+ 中央列面板（React，单占用者接管，与 task-board / ssh 面板互斥），复刻执行复用官方 `sessions` / `workspaces` 服务。

## License

Apache-2.0。Vendored fzstd © 101arrowz, MIT（见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)）。
