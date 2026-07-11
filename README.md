# OSS Radar

用 GitHub 真实数据对比两个开源项目的健康度，帮助你做技术选型决策。

评分方法对齐 [CHAOSS](https://chaoss.community/)（Linux Foundation 发起的开源社区健康度分析工作组）定义的指标，而不是简单比较 star 数。

## 评分维度

| 维度 | 权重 | 依据 |
|---|---|---|
| 活跃度 | 30% | 近 30 天提交数、PR 合并速度、PR 关闭率（CHAOSS: Change Request Closure Ratio） |
| 社区健康 | 30% | 贡献者集中度（Bus Factor）× 企业多元性（Elephant Factor） |
| 响应速度 | 20% | Issue 首次获得非作者回复的中位天数（CHAOSS: Time to First Response） |
| 稳定性 | 15% | 发布频率 + 是否有 SECURITY.md 安全策略 |
| 采用度 | 5% | Stars / Forks（对数缩放） |

对比结果附带 AI 生成的简要选型建议（可选，需配置 Anthropic API Key）。

## 本地运行

```bash
npm install
cp .env.example .env.local   # 填入下面的环境变量
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

## 环境变量

| 变量 | 必需 | 说明 |
|---|---|---|
| `GITHUB_TOKEN` | 推荐 | GitHub Personal Access Token，无需任何权限范围（仅读公开数据），用于提高 API 速率限制（未认证 60 次/小时 → 认证后 5000 次/小时） |
| `ANTHROPIC_API_KEY` | 可选 | 配置后对比页会显示 AI 生成的选型建议；不配置时该模块自动隐藏，其余功能不受影响 |
| `ANTHROPIC_BASE_URL` | 可选 | 指向任意 Anthropic 兼容端点。例如 DeepSeek：`https://api.deepseek.com/anthropic/v1`；不设置时使用 Anthropic 官方 API |
| `AI_MODEL` | 可选 | AI 分析使用的模型，默认 `claude-haiku-4-5`；配合 DeepSeek 端点时设为 `deepseek-chat` |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | 可选 | 配置后启用 AI 分析的按 IP 限流、AI 叙述结果缓存（6 小时）和首页热门对比统计；不配置时全部自动降级，不影响核心对比功能 |

## 技术栈

Next.js (App Router) · TypeScript · Tailwind CSS · Vercel AI SDK · Upstash Redis

## License

MIT
