# 发生 / Eupra

基于用户提供的 Eupra MVP 1.0 设计交付包开发的独立工程。前端为 React + TypeScript + Vite，后端为 Rust + Axum，开发环境数据持久化到 SQLite。

**当前定位：可运行的开发版本与核心界面，不是已完成的生产版 MVP。**

默认没有配置真实生成服务，创作接口会明确返回 `PROVIDER_UNAVAILABLE`，不会拿设计包里的猫图冒充你的生成结果。显式开启演示模式后，可以验证文本概念、任务、作品与版本关系；演示结果有明确标识，生产安全状态仍为 HOLD。真实图片、视频、公开分享和社区上线仍需要供应商、安全审核和部署接入。

## 本地启动

要求：Rust stable、Node.js 20.19+ 或 22.12+、npm。首次构建需从官方包仓库下载依赖。

```bash
./scripts/dev.sh
```

打开 http://localhost:5173 。API 仅监听本机 http://127.0.0.1:8787 。首次使用在页面内注册本地测试账户。此版本没有邮件验证或找回密码功能，请勿使用真实重要账户密码。

要验证隔离的开发演示链路：

```bash
EUPRA_PROVIDER=demo ./scripts/dev.sh
```

演示模式不是 AI 生成服务，不具备生产审核能力。未接真实提供商时默认不开放视频、公开社区、付款或提现。

## 本机分享预览与单一服务

可用 `EUPRA_PROVIDER=demo EUPRA_LOCAL_REVIEW=1 ./scripts/dev.sh` 验证本机示例文本的分享与接力。必须由所有者显式确认，令牌可撤销/过期，且不包含原图、原文或世界私有记忆；此开关拒绝非回环监听，不构成生产内容审核。图片和真实供应商输出不能通过此开发例外。

`./scripts/serve.sh` 构建前端并用 Rust 服务托管，默认仍仅本机访问，不是上线部署。

## 单独运行

```bash
cd backend
cargo run
```

另一个终端：

```bash
cd frontend
npm ci
npm run dev -- --host 127.0.0.1
```

环境变量：

- `EUPRA_BIND`：API 监听地址，默认 `127.0.0.1:8787`。
- `EUPRA_DATABASE`：SQLite 数据库路径，默认后端工作目录下 `eupra.sqlite3`。
- `EUPRA_PROVIDER=demo`：显式启用开发文本模板演示。未设时不伪造生成成功。
- `EUPRA_PROVIDER=http`、`EUPRA_ENGINE_URL`、`EUPRA_ENGINE_KEY`：接入实现后端契约的受信任生成引擎。尚未连接真实供应商；仅本地模拟服务验证协议。详见后端提供商文档。
- `EUPRA_ENGINE_MODE=staged`：可选逐阶段 HTTP 编排；默认使用完整引擎接口。阶段协议已由本地模拟服务检验，尚未进行真实模型质量验证。
- `EUPRA_SECURE_COOKIE=1`：HTTPS 环境下开启 Secure 会话 cookie。开发 HTTP 环境不要设置此值。

生产部署前必须使用 HTTPS、完成安全检查并替换本地开发基础设施。不得直接将本地测试服务暴露到公网。

## 工程目录

- `frontend/`：统一界面、路由、国际化与 API 客户端。
- `backend/`：Rust API、持久化、认证、上传、任务和版本管理。
- `backend/API.md`：当前实现接口与已知边界。
- `docs/DESIGN-INVENTORY.md`：原设计包逐页清单和需求优先级。
- `docs/ENGINE-CONTRACT.md`：V2 反转引擎与安全网关契约。
- `docs/RELEASE-GATES.md`：生产上线前必须完成的事项。
- `docs/SOURCE-REFERENCE.md`：原始设计归档校验信息。
- `qa/`：独立黑盒测试；检查结果见后续 QA 报告。
- `scripts/package-source.py`：生成不含密钥、数据库、构建缓存的源码检查点。

## 验证

```bash
cd backend && cargo test
cd ../frontend && npm ci && npm run build
```

运行 API 后：

```bash
python3 qa/api_smoke.py
```

此脚本会注册隔离测试账户并验证当前服务模式。应只对本地测试数据库运行，不要对真实用户数据库运行。

## 尚未完成的完整 MVP 能力

真实图像/视频模型、V2 引擎真实模型质量与盲评、安全提供商、外部分享接力、生产队列与对象存储、管理审核后台、GLOBAL 社区、评论二创、真实视频额度结算、创作者经济账本和支付尚不能因此工程界面存在而视为完成。详细差异及验证结果随源码检查点交付。

原设计要求先打通中国版核心创作闭环；未冻结的套餐价格、分成比例、模型和支付供应商不写死为真实商业承诺。源码在用户指定仓库的工作分支开发，未合并默认分支、未发布或部署。
