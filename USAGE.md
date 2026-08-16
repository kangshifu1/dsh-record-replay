# 使用

侧边栏「录制回放」面板分三个 tab：会话 / 回放包 / 录屏。

## 1. 会话回放

1. 打开「录制回放」→「会话」tab，列出本机全部已录制会话（标题 / 项目 / 时间 / 消息数）
2. 点「回放」：以可读时间线查看
   - 用户消息、助手回复（推理过程可折叠）、工具调用与参数、工具结果（长文可展开）
   - 支持搜索过滤

## 2. 导出 / 导入回放包

- 导出：会话上点「导出」，下载单个 `dsh-replay-pack` JSON（`*.replay.json`）
- 导入：「回放包」tab 导入 `.replay.json`，存到 `~/.dsh/replay-packs`，可查看 / 删除 / 复刻

## 3. 复刻执行

会话或回放包上点「复刻」：把录制会话的**用户消息**按原顺序逐条发送到全新会话，
让 agent 真实重新执行一遍。可用于复现、回归、教学、模板化流程。

## 4. 录屏

1. 「录屏」tab 点「开始录屏」，浏览器弹 getDisplayMedia，选屏幕 / 窗口
2. 停止后自动上传 webm 视频 + 每 2s 采样帧，存 `~/.dsh/recordings`
3. 可回放、删除

## 5. 录屏 → 生成技能

对任意录屏点「生成技能」：插件开一个 agent 会话，让它逐帧调用 `describe_image`
提炼工作流，输出 SKILL.md 写入 `~/.dsh/skills/<name>/SKILL.md`。skill 目录被热监听，
新技能立即进入每个会话的技能目录。

## 回放包格式

~~~json
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
~~~
