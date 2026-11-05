# InternBoard 校园实习招聘平台

面向高校学生的实习招聘平台：企业发布实习岗位，学生投递简历、收藏岗位，企业与学生在线沟通、安排面试、推进投递状态，含数据看板与管理页。

## 功能清单
- 企业：列表（行业/地点/认证筛选）、详情、新建、编辑、删除
- 实习岗位：列表（公司/类型/地点/状态筛选、关键词搜索、按薪资/截止/浏览量排序、分页）、详情、新建、编辑、删除
- 投递：列表（岗位/申请人/状态筛选）、详情、新建、编辑、删除；快捷投递 `POST /api/jobs/:id/apply`
- 投递状态流转：`POST /api/applications/:id/transition`，仅允许 投递→初筛/拒绝、初筛→面试/拒绝、面试→offer/拒绝、offer→拒绝，非法流转返回 400
- 简历库：列表（学号/专业/可见性筛选）、详情、新建、编辑、删除；可见性仅 公开/私密
- 面试：列表（投递/面试官/结果筛选）、详情、新建、编辑、删除；结果仅 待定/通过/未通过
- 收藏：列表（用户/岗位筛选）、详情、新建、编辑、删除；同一用户重复收藏同一岗位返回 409
- 消息：列表（投递/发送方/接收方筛选）、详情、新建、编辑、删除；按投递聚合的会话查询
- 数据看板：企业/岗位/投递/简历/面试/收藏/消息数、开放岗位数、岗位按状态与类型统计、投递按状态统计、岗位总浏览量、offer 数
- 前端：原生 HTML/CSS/JS，多视图（看板/岗位/企业/投递/简历库/面试消息）+ 独立管理页 `admin.html`（投递与面试删除）
- 校验（与 teamspace 同款加固）：新建时客户端传来的 id 会被忽略（统一由服务端生成）；PUT 不可改 id/createdAt；岗位薪资必须为 >= 0 的有效数字且下限 <= 上限，否则 400；岗位状态仅 open/closed、投递状态仅 投递/初筛/面试/offer/拒绝，否则 400；同一学生重复投递同一岗位返回 409；向已关闭岗位投递返回 409

## 技术
- 后端：Node.js + Express，数据持久化在 `server/data.json`，无数据库
- 前端：原生 HTML/CSS/JS，多视图 + 独立管理页 `admin.html`
- 示例数据：企业 12 条、岗位 12 条、投递 12 条、简历 12 条、面试 12 条、收藏 12 条、消息 12 条

## 本地运行
```bash
npm install
npm start
```
默认端口 **3033**（可用 `PORT` 环境变量覆盖），打开 http://localhost:3033/ ，管理页 http://localhost:3033/admin.html

## API 端点（41 个）
- 企业/岗位/投递/简历/面试/收藏/消息：各 5 个（GET 列表、GET 详情、POST、PUT、DELETE），共 35 个
- POST /api/jobs/:id/apply（快捷投递）、POST /api/jobs/:id/favorite（快捷收藏）
- POST /api/applications/:id/transition（状态流转）
- GET /api/jobs/:id/applications、GET /api/applications/:id/interviews、GET /api/applications/:id/messages
- GET /api/stats
- 合计 41 个端点

## 说明
- 本项目沿用 teamspace 的结构与加固模式（通用 CRUD 辅助函数 + JSON 文件持久化），但服务端入口为 `server/index.js`（teamspace 为 `server/server.js`），以符合本项目 `package.json` 的 start 脚本。
