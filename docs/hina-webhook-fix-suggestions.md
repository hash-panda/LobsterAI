# 海纳 Webhook 处理程序修复报告

## ✅ 修复状态：已完成

修复日期：2026-02-26

## 问题总结

原 `hinaWebhookHandler.ts` 中的事件解析逻辑与海纳官方文档不完全匹配。

## 需要修复的地方

### 1. 事件字段名映射

**文档格式：**
```json
{
  "event": "aiExamCandidateSignIn",
  "outId": "candidate_20240120001"
}
```

**当前代码问题：**
- 使用 `eventType` 或 `event_type` 而不是 `event`
- 使用 `candidateId` 或 `candidate_id` 而不是 `outId`

### 2. 事件类型值映射

**文档中的事件类型：**
- `aiExamCandidateSignIn` - 候选人面试签到事件
- `aiExamCandidateBegin` - 候选人面试开始事件
- `aiExamCandidateEnd` - 候选人面试结束事件
- `aiExamCandidateReview` - 候选人面试评估结果回调

**当前代码映射：**
- `check_in`, `candidate_check_in`, `signIn` → `check_in`
- `interview_start`, `start` → `interview_start`
- `interview_end`, `end` → `interview_end`
- `evaluation_result`, `evaluation`, `report` → `evaluation_result`

### 3. 评估结果回调的复杂结构

对于 `aiExamCandidateReview` 事件，文档中包含大量详细字段（见接口文档），当前代码将完整 payload 存储在 `data` 字段中，这是正确的做法。

## 建议的修复方案

### 方案一：修改 `parseEvent` 函数以匹配文档格式

```typescript
private parseEvent(payload: Record<string, unknown>): HinaWebhookEvent | null {
  // 根据海纳官方文档，字段名为 'event' 和 'outId'
  const event = payload.event as string;
  const outId = payload.outId as string;

  // 对于复杂的评估结果回调，还可能包含其他字段
  const candidateInfo = payload.candidateInfo as Record<string, unknown>;
  const interviewInfo = payload.interviewInfo as Record<string, unknown>;

  // 提取候选人和面试信息
  const candidateId = outId || (candidateInfo?.outId as string);
  const candidateName = candidateInfo?.name as string;
  const interviewCode = interviewInfo?.connectCode as string;

  const timestamp = Date.now();

  if (!event) {
    this.log('[Hina Webhook] Invalid event payload: missing event field');
    return null;
  }

  // 映射事件类型到内部格式
  let mappedEventType: HinaWebhookEvent['eventType'];
  switch (event) {
    case 'aiExamCandidateSignIn':
      mappedEventType = 'check_in';
      break;
    case 'aiExamCandidateBegin':
      mappedEventType = 'interview_start';
      break;
    case 'aiExamCandidateEnd':
      mappedEventType = 'interview_end';
      break;
    case 'aiExamCandidateReview':
      mappedEventType = 'evaluation_result';
      break;
    default:
      this.log(`[Hina Webhook] Unknown event type: ${event}`);
      return null;
  }

  return {
    eventType: mappedEventType,
    interviewId: interviewCode || '',
    candidateId: candidateId || '',
    candidateName,
    timestamp,
    data: payload as Record<string, unknown>
  };
}
```

### 方案二：保持向后兼容

如果需要同时支持旧格式和新格式：

```typescript
private parseEvent(payload: Record<string, unknown>): HinaWebhookEvent | null {
  // 兼容多种字段名格式
  const event = (payload.event || payload.eventType || payload.event_type) as string;
  const outId = (payload.outId || payload.candidateId || payload.candidate_id) as string;

  const candidateInfo = payload.candidateInfo as Record<string, unknown>;
  const interviewInfo = payload.interviewInfo as Record<string, unknown>;

  const candidateId = outId || (candidateInfo?.outId as string);
  const candidateName = (candidateInfo?.name || payload.candidateName || payload.candidate_name) as string;
  const interviewCode = (interviewInfo?.connectCode || payload.interviewId || payload.interview_id) as string;

  const timestamp = (payload.timestamp as number) || Date.now();

  if (!event) {
    this.log('[Hina Webhook] Invalid event payload: missing event field');
    return null;
  }

  // 映射事件类型
  let mappedEventType: HinaWebhookEvent['eventType'];
  switch (event) {
    // 新格式（文档标准）
    case 'aiExamCandidateSignIn':
    // 旧格式（兼容）
    case 'check_in':
    case 'candidate_check_in':
    case 'signIn':
      mappedEventType = 'check_in';
      break;

    case 'aiExamCandidateBegin':
    case 'interview_start':
    case 'start':
      mappedEventType = 'interview_start';
      break;

    case 'aiExamCandidateEnd':
    case 'interview_end':
    case 'end':
      mappedEventType = 'interview_end';
      break;

    case 'aiExamCandidateReview':
    case 'evaluation_result':
    case 'evaluation':
    case 'report':
      mappedEventType = 'evaluation_result';
      break;

    default:
      this.log(`[Hina Webhook] Unknown event type: ${event}`);
      return null;
  }

  return {
    eventType: mappedEventType,
    interviewId: interviewCode || '',
    candidateId: candidateId || '',
    candidateName,
    timestamp,
    data: payload as Record<string, unknown>
  };
}
```

## 推荐方案

**推荐使用方案二（向后兼容）**，理由：
1. 保持对现有集成的兼容性
2. 支持文档标准格式
3. 更健壮的错误处理

## 验证方式

修复后，可以使用以下测试数据验证：

### 测试用例 1: 签到事件
```json
{
  "event": "aiExamCandidateSignIn",
  "outId": "candidate_20240120001"
}
```

### 测试用例 2: 面试开始
```json
{
  "event": "aiExamCandidateBegin",
  "outId": "candidate_20240120001"
}
```

### 测试用例 3: 面试结束
```json
{
  "event": "aiExamCandidateEnd",
  "outId": "candidate_20240120001"
}
```

### 测试用例 4: 评估结果（简化版）
```json
{
  "event": "aiExamCandidateReview",
  "candidateInfo": {
    "outId": "candidate_20240120001",
    "name": "张三",
    "phone": "13800138000"
  },
  "interviewInfo": {
    "name": "产品经理-AI模拟面试",
    "connectCode": "11OU8"
  },
  "resultOverView": {
    "scoreAi": 85,
    "auditStatus": 1
  }
}
```

## 实际修复方案

已采用**方案二（向后兼容）**，修改了 `hinaWebhookHandler.ts:241-324` 行的 `parseEvent` 函数。

### 修复内容

1. **支持文档标准格式**：
   - 优先读取 `event` 字段（文档标准）
   - 优先读取 `outId` 字段（文档标准）
   - 支持复杂事件结构（`candidateInfo`, `interviewInfo` 等）

2. **保持向后兼容**：
   - 兼容旧的 `eventType` 字段
   - 兼容旧的 `candidateId` 字段
   - 兼容所有旧的事件类型值

3. **新增事件类型映射**：
   - `aiExamCandidateSignIn` → `check_in`
   - `aiExamCandidateBegin` → `interview_start`
   - `aiExamCandidateEnd` → `interview_end`
   - `aiExamCandidateReview` → `evaluation_result`

### 测试结果

创建了测试脚本 `SKILLs/hina-interview/scripts/test-webhook.js`，包含 6 个测试用例：

```bash
$ node SKILLs/hina-interview/scripts/test-webhook.js

测试结果: 6/6 通过, 0 失败
🎉 所有测试通过！
```

测试覆盖：
- ✅ 文档标准格式（`event` + `outId`）
- ✅ 复杂事件结构（`candidateInfo`, `interviewInfo`）
- ✅ 旧格式向后兼容
- ✅ 混合格式优先级处理

## 相关文件

- `src/main/im/hinaWebhookHandler.ts` - Webhook 处理程序（已修复）
- `docs/hina-interview-api.md` - 海纳 API 文档（包含回调事件格式）
- `SKILLs/hina-interview/scripts/test-webhook.js` - Webhook 事件解析测试脚本
