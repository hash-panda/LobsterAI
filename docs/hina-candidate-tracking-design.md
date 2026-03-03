# 海纳候选人追踪系统设计方案

> 本文档记录候选人追踪系统的设计思路和实现计划，将随开发进度实时更新。

## 1. 系统概述

### 1.1 目标

为猎头/HR 提供一个完整的候选人面试追踪闭环：
- 通过手机号建立候选人画像，关联所有面试信息
- 实时追踪面试状态（邀请 → 签到 → 面试中 → 完成 → 评估）
- 多渠道通知（飞书 + 应用内）
- 自动获取并展示海纳评估报告（报告已包含 AI 分析）

### 1.2 使用场景

| 场景 | 入口 | 操作 |
|------|------|------|
| 邀请候选人 | 飞书对话 / 应用界面 | AI 调用海纳 API 发起邀请 |
| 查看状态 | 飞书对话 / 应用界面 | 查询候选人当前面试进度 |
| 接收通知 | 飞书 / 应用内 | 状态变更时自动推送 |
| 查看报告 | 应用界面 | 查看海纳评估报告（含 AI 分析） |

### 1.3 设计原则

- **手机号为唯一标识**：通过手机号关联候选人所有信息
- **事件驱动**：Webhook 事件触发状态更新和通知
- **双入口**：飞书聊天 + 应用界面均可操作
- **单用户模式**：所有候选人在同一池子，不区分使用者

---

## 2. 系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        LobsterAI 主进程                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │ Webhook 监听 │→│ 候选人状态管理器 │→│  通知分发器      │   │
│  │ (已实现)     │  │ (新增)           │  │  (飞书+应用内)   │   │
│  └──────────────┘  └──────────────────┘  └──────────────────┘   │
│         ↓                  ↓                      ↓              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    SQLite 数据库                          │   │
│  │  hina_candidates (候选人) + hina_events (事件日志)        │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
         ↓ IPC                              ↓ WebSocket
┌────────────────────┐            ┌────────────────────┐
│   LobsterAI 界面   │            │     飞书机器人     │
│  候选人管理页面    │            │  AI 对话 + 通知    │
└────────────────────┘            └────────────────────┘
```

---

## 3. 数据模型

### 3.1 候选人表 (hina_candidates)

```sql
CREATE TABLE hina_candidates (
  id TEXT PRIMARY KEY,                    -- 候选人三方 ID (outId)
  phone TEXT NOT NULL UNIQUE,             -- 手机号（唯一标识）
  name TEXT NOT NULL,
  email TEXT,
  position TEXT,                          -- 应聘职位
  status TEXT NOT NULL DEFAULT 'pending', -- 状态: pending, invited, check_in, interviewing, completed, cancelled
  interview_code TEXT,                    -- 面试间链接码
  interview_url TEXT,                     -- 候选人面试链接
  report_url TEXT,                        -- 评估报告链接
  invited_at INTEGER,                     -- 邀请时间
  check_in_at INTEGER,                    -- 签到时间
  interview_start_at INTEGER,             -- 面试开始时间
  interview_end_at INTEGER,               -- 面试结束时间
  report_generated_at INTEGER,            -- 报告生成时间
  score_ai REAL,                          -- AI 评分
  audit_desc_ai TEXT,                     -- AI 评价摘要
  report_data TEXT,                       -- 完整报告数据 (JSON)
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_hina_candidates_phone ON hina_candidates(phone);
CREATE INDEX idx_hina_candidates_status ON hina_candidates(status);
```

### 3.2 事件日志表 (hina_candidate_events)

```sql
CREATE TABLE hina_candidate_events (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL,
  event_type TEXT NOT NULL,               -- invited, check_in, interview_start, interview_end, report_generated
  event_data TEXT,                        -- JSON 格式的事件详情
  notified INTEGER DEFAULT 0,             -- 是否已发送通知
  created_at INTEGER NOT NULL,
  FOREIGN KEY (candidate_id) REFERENCES hina_candidates(id) ON DELETE CASCADE
);

CREATE INDEX idx_hina_events_candidate ON hina_candidate_events(candidate_id);
CREATE INDEX idx_hina_events_type ON hina_candidate_events(event_type);
```

### 3.3 状态流转

```
┌─────────┐    邀请成功    ┌─────────┐    签到     ┌──────────────┐
│ pending │ ───────────→ │ invited │ ────────→ │  check_in    │
└─────────┘              └─────────┘            └──────────────┘
                                                    │ 开始面试
                                                    ↓
┌───────────┐   报告生成   ┌────────────┐  面试结束  ┌─────────────┐
│ completed │ ←────────── │ interviewing│ ←─────── │             │
└───────────┘             └────────────┘          └─────────────┘
      │
      └──→ 可重新邀请 (回到 pending)
```

---

## 4. 功能模块

### 4.1 数据存储层

**文件**: `src/main/hinaCandidateStore.ts`

**职责**:
- 候选人 CRUD 操作
- 状态更新与查询
- 事件记录
- 报告数据存储

**核心方法**:
```typescript
class HinaCandidateStore {
  // 候选人管理
  upsertCandidate(candidate: CandidateData): Candidate
  getCandidateById(outId: string): Candidate | null
  getCandidateByPhone(phone: string): Candidate | null
  listCandidates(filter?: CandidateFilter): Candidate[]
  updateCandidateStatus(outId: string, status: string): void

  // 事件管理
  addEvent(candidateId: string, eventType: string, eventData?: object): void
  getEvents(candidateId: string): CandidateEvent[]
  getRecentEvents(limit?: number): CandidateEvent[]

  // 报告管理
  saveReport(outId: string, reportData: object): void
  getReport(outId: string): ReportData | null
}
```

### 4.2 Webhook 事件处理

**文件**: `src/main/im/hinaWebhookHandler.ts` (增强)

**事件处理逻辑**:

| 事件类型 | 状态变更 | 触发动作 |
|---------|---------|---------|
| check_in | invited → check_in | 记录签到时间，发送通知 |
| interview_start | check_in → interviewing | 记录开始时间，发送通知 |
| interview_end | interviewing → waiting_report | 记录结束时间，发送通知 |
| evaluation_result | waiting_report → completed | 保存报告，发送通知 |

**代码增强点**:
```typescript
// 在 parseEvent 后增加状态更新和通知
private async handleEvent(event: HinaWebhookEvent): Promise<void> {
  // 1. 更新候选人状态
  candidateStore.updateCandidateStatus(event.candidateId, newStatus);

  // 2. 记录事件
  candidateStore.addEvent(event.candidateId, event.eventType, event.data);

  // 3. 如果是评估结果，获取并保存报告
  if (event.eventType === 'evaluation_result') {
    const report = await this.fetchReport(event.candidateId);
    candidateStore.saveReport(event.candidateId, report);
  }

  // 4. 发送通知
  await this.sendNotification(event);
}
```

### 4.3 通知系统

**文件**: `src/main/im/imGatewayManager.ts` (增强)

#### 4.3.1 飞书通知

**通知时机与内容**:

| 事件 | 通知内容 |
|------|---------|
| 签到 | 「{姓名}」已签到，等待开始面试 |
| 开始面试 | 「{姓名}」已开始面试 |
| 面试结束 | 「{姓名}」面试已结束，等待生成报告 |
| 报告生成 | 「{姓名}」评估报告已生成，评分：{分数} |

**飞书卡片模板**:
```json
{
  "type": "interactive",
  "card": {
    "header": {
      "title": { "tag": "plain_text", "content": "候选人状态更新" },
      "template": "{color}"
    },
    "elements": [
      {
        "tag": "div",
        "fields": [
          { "is_short": true, "text": { "tag": "lark_md", "content": "**候选人**\n{name}" } },
          { "is_short": true, "text": { "tag": "lark_md", "content": "**手机号**\n{phone}" } },
          { "is_short": true, "text": { "tag": "lark_md", "content": "**状态**\n{status}" } },
          { "is_short": true, "text": { "tag": "lark_md", "content": "**时间**\n{time}" } }
        ]
      },
      {
        "tag": "action",
        "actions": [
          {
            "tag": "button",
            "text": { "tag": "plain_text", "content": "查看详情" },
            "url": "{detail_url}"
          }
        ]
      }
    ]
  }
}
```

#### 4.3.2 应用内通知

**IPC 通道**: `hina:notification`

**渲染进程处理**:
- 显示 Toast 提示
- 更新侧边栏徽标（未读数量）
- 播放提示音（可配置）

### 4.4 飞书对话集成

**文件**: `src/main/im/feishuGateway.ts` (增强)

#### 4.4.1 意图识别

**支持的指令**:

| 用户输入 | 意图 | 操作 |
|---------|------|------|
| 邀请张三面试 / 邀请候选人 | invite_candidate | 调用 invite-candidate.js |
| 查询张三状态 / 候选人状态 | query_candidate | 查询数据库返回状态 |
| 候选人列表 / 有哪些候选人 | list_candidates | 返回候选人列表 |
| 获取张三报告 / 面试报告 | get_report | 调用 get-report.js |
| 可用面试间 / 面试列表 | list_interviews | 调用 get-recommendations.js |

#### 4.4.2 对话流程示例

```
用户: 帮我邀请张三参加前端面试
AI:   好的，请提供张三的手机号
用户: 13800138000
AI:   [调用 invite-candidate.js]
      已成功邀请「张三」参加面试
      面试链接: https://xxx
      候选人将收到短信通知

--- 事件驱动 ---

AI:   [收到 check_in 事件后主动推送]
      「张三」已签到，即将开始面试
```

### 4.5 UI 管理界面

**文件**: `src/renderer/components/candidates/` (新增)

#### 4.5.1 组件结构

```
src/renderer/components/candidates/
├── CandidateList.tsx          # 候选人列表
├── CandidateDetail.tsx        # 候选人详情（时间线 + 报告）
├── CandidateForm.tsx          # 邀请候选人表单
├── CandidateStatusBadge.tsx   # 状态徽章组件
└── ReportViewer.tsx           # 报告查看器
```

#### 4.5.2 候选人列表

**功能**:
- 按状态分组/筛选
- 搜索（姓名、手机号）
- 快速操作（查看详情、重新邀请、取消）
- 状态统计看板

**布局**:
```
┌────────────────────────────────────────────────────────┐
│ 候选人管理                    [🔍 搜索] [+ 邀请候选人]  │
├────────────────────────────────────────────────────────┤
│ [全部 12] [待面试 5] [面试中 2] [已完成 3] [已取消 2]   │
├────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────┐   │
│ │ 👤 张三  138****8000  前端开发                     │   │
│ │    状态: 面试中  |  面试间: 11OG6JH9LLL           │   │
│ │    开始时间: 2026-02-28 14:30                     │   │
│ └──────────────────────────────────────────────────┘   │
│ ┌──────────────────────────────────────────────────┐   │
│ │ 👤 李四  139****9000  后端开发                     │   │
│ │    状态: 已完成  |  评分: 85分  |  查看报告 →      │   │
│ │    面试时间: 2026-02-27 10:00 - 10:45            │   │
│ └──────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────┘
```

#### 4.5.3 候选人详情

**功能**:
- 基本信息展示
- 面试时间线
- 评估报告查看（直接展示海纳报告内容）
- 操作按钮（重新邀请、取消、查看原报告）

---

## 5. 海纳报告数据结构

评估结果事件 (evaluation_result) 已包含完整的分析数据：

```typescript
interface HinaEvaluationResult {
  event: 'aiExamCandidateReview';
  candidateInfo: {
    outId: string;
    name: string;
    phone: string;
    email: string;
  };
  resultOverView: {
    scoreAi: number;              // AI 综合评分
    auditDescAi: string;          // AI 综合评价
    reportUrl: string;            // 报告链接
    interviewStatus: number;      // 面试状态
  };
  questionList: Array<{           // 题目列表
    desc: string;                 // 题目描述
    score: number;                // 得分
    scoreAll: number;             // 满分
    answerDesc: string;           // 回答内容
    dimension: string;            // 考察维度
  }>;
  dimensionList: Array<{          // 维度分析
    name: string;                 // 维度名称
    score: number;
    scoreAll: number;
    auditDescAI: string;          // 维度评价
  }>;
}
```

**可直接使用的字段**:
- `resultOverView.scoreAi` - 综合评分
- `resultOverView.auditDescAi` - 综合评价
- `dimensionList` - 各维度分析
- `questionList` - 题目详情

---

## 6. 开发计划

### Phase 1: 数据层 + 事件处理 (基础) ✅ 已完成
- [x] 创建数据库表 (sqliteStore.ts)
- [x] 实现 HinaCandidateStore 类
- [x] 增强 webhook 事件处理，自动更新状态
- [x] 测试事件流转

### Phase 2: 通知系统 ✅ 已完成
- [x] 实现飞书卡片通知模板
- [x] 实现应用内通知推送
- [x] 添加通知配置开关

### Phase 3: 飞书对话集成
- [ ] 增强意图识别（候选人相关指令）
- [ ] 实现候选人查询指令
- [ ] 实现邀请候选人指令
- [ ] 实现列表展示

### Phase 4: UI 管理界面 ✅ 已完成
- [x] 候选人列表组件
- [x] 候选人详情组件
- [x] 邀请表单组件
- [x] 通知配置组件
- [x] 集成到主界面

---

## 7. 配置项

```typescript
interface HinaTrackingConfig {
  // 通知配置
  notification: {
    feishu: boolean;      // 飞书通知开关
    app: boolean;         // 应用内通知开关
    sound: boolean;       // 提示音开关
  };

  // 自动化配置
  automation: {
    autoFetchReport: boolean;  // 自动获取报告
    reportNotifyDelay: number; // 报告生成后延迟通知时间(秒)
  };
}
```

---

## 8. 更新日志

| 日期 | 更新内容 |
|------|---------|
| 2026-02-28 | 初始版本，完成系统设计 |
| 2026-02-28 | Phase 1 完成：数据层 + 事件处理 |
| 2026-02-28 | 实现文件：`hinaCandidateStore.ts`、增强 `imGatewayManager.ts`、`sqliteStore.ts`、`main.ts`、`preload.ts` |
| 2026-02-28 | Phase 2 完成：通知系统 |
| 2026-02-28 | 新增类型：`HinaNotificationConfig`，新增方法：飞书卡片通知、应用内 IPC 通知、通知配置 |
| 2026-02-28 | Phase 4 完成：UI 管理界面 |
| 2026-02-28 | 新增组件：`CandidateList`、`CandidateDetail`、`CandidateForm`、`NotificationConfig`、`HinaCandidatesPage` |
| 2026-02-28 | 新增服务：`hinaCandidateService`，新增 i18n 翻译（中/英） |
