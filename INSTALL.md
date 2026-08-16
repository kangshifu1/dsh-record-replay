# 导入 / 安装

dsh-record-replay 是 DSH 的双面插件（宿主 node + 浏览器 React），通过 profile 的 patch 层挂载，**不改 DSH 源码**。

## 前置条件

- Node.js ≥ 22.19（或 ≥ 24）
- 一个能启动 `dsh web` 的 DSH 环境
- pnpm（`dsh plugin` 是 pnpm 转发器）

## 方式一：从 GitHub 安装（推荐）

~~~bash
git clone https://github.com/kangshifu1/dsh-record-replay.git
dsh plugin --profile web add link:/path/to/dsh-record-replay
~~~

## 方式二：本地开发（改源码自用）

~~~bash
cd dsh-record-replay
pnpm install
pnpm build        # tsc 编译宿主半区 → lib/；tsdown 打包浏览器半区 → lib/client.js
cd /path/to/deepseek-harness
dsh plugin --profile web add link:/path/to/dsh-record-replay
~~~

## 方式三：npm 安装（发布到 registry 后）

~~~bash
dsh plugin --profile web add dsh-record-replay
~~~

## 生效

安装后**重启 dsh web GUI**（插件集会变更需要重启）。重启后侧边栏出现「录制回放」入口即成功。

~~~bash
corepack pnpm dsh web
~~~

> 原理：`dsh plugin` 把包装进 profile 的 node_modules，检测到 `dsh.bundle`
> 声明后把 `cordis.patch.yml` 并入 bundle 层；浏览器半区按 `dsh.client` 声明
> 以 /plugins/dsh-record-replay/client.js 加载。
