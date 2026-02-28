---
name: hina-interview
description: 海纳 AI 面试系统集成，支持创建面试间、邀请候选人、获取面试报告等功能
official: false
homepage: https://hina.com
---

# 海纳 AI 面试 Skill

海纳 AI 面试是一个智能面试系统，本 Skill 允许 Agent 通过海纳 OpenAPI 完成面试相关的操作。

## 何时使用此 Skill

当用户需要以下操作时，应使用此 Skill：

- 创建或编辑 AI 面试间
- 邀请候选人参加面试
- 取消候选人面试
- 获取候选人面试报告
- 获取系统推荐的面试列表

## 配置要求

在使用此 Skill 之前，需要先配置海纳租户凭证。配置方式有两种：

### 方式一：在设置界面配置（推荐）

1. 打开 LobsterAI 设置
2. 切换到 "海纳 AI 面试" 标签页
3. 输入海纳租户的 App Key 和 App Secret
4. 选择 API 环境（生产/测试）
5. 配置会自动保存到数据库，所有技能调用都会自动读取

**优点：**
- 无需手动创建配置文件
- 配置加密存储
- 与其他系统配置（模型、IM 机器人）统一管理
- 支持图形界面配置和 Webhook 设置

### 方式二：手动配置文件（向后兼容）

如果需要独立运行脚本或有特殊需求，仍然支持以下方式：

1. 在 `.env` 文件中设置：
   ```
   HINA_APP_KEY=your_app_key
   HINA_APP_SECRET=your_app_secret
   HINA_BASE_URL=https://openapi.5kong.com
   ```

2. 或在 `config.json` 文件中配置：
   ```json
   {
     "appKey": "your_app_key",
     "appSecret": "your_app_secret",
     "baseUrl": "https://openapi.5kong.com"
   }
   ```

**注意：** 环境变量优先级最高，其次是 .env 文件，最后是 config.json。但通常推荐使用设置界面配置。

## 可用工具

### 1. 创建面试间

获取跳转到海纳创建 AI 面试间的页面链接。

```bash
node "$SKILLS_ROOT/hina-interview/scripts/create-interview.js" [--callback-url <url>]
```

**参数：**
- `--callback-url` (可选): 回调 URL，面试间创建完成后会跳转到此地址

**示例：**
```bash
node "$SKILLS_ROOT/hina-interview/scripts/create-interview.js"
```

### 2. 编辑面试间

获取跳转到海纳编辑 AI 面试间的页面链接。

```bash
node "$SKILLS_ROOT/hina-interview/scripts/edit-interview.js" --interview-id <id> [--callback-url <url>]
```

**参数：**
- `--interview-id` (必填): 面试间 ID
- `--callback-url` (可选): 回调 URL

**示例：**
```bash
node "$SKILLS_ROOT/hina-interview/scripts/edit-interview.js" --interview-id "inter_12345"
```

### 3. 邀请候选人

邀请候选人参加 AI 面试。

```bash
node "$SKILLS_ROOT/hina-interview/scripts/invite-candidate.js" \
  --interview-code <code> \
  --name <name> \
  --phone <phone> \
  [--email <email>] \
  [--candidate-id <id>] \
  [--position <position>]
```

**参数：**
- `--interview-code` (必填): 面试间链接码 (interviewCode)
- `--name` (必填): 候选人姓名
- `--phone` (必填): 候选人手机号（当面试间未开启强验证手机号功能时，可传任意字符）
- `--email` (可选): 候选人邮箱
- `--candidate-id` (可选): 候选人三方 ID (outId)，不传则自动生成
- `--position` (可选): 应聘职位
- `--notify` (可选): 发送通知消息（默认不发送）

**示例：**
```bash
node "$SKILLS_ROOT/hina-interview/scripts/invite-candidate.js" \
  --interview-code "11OG6JH9LLL" \
  --name "张三" \
  --phone "13800138000" \
  --email "zhangsan@example.com" \
  --position "前端开发工程师"
```

**返回数据：**
- `outId`: 候选人 ID
- `interviewCode`: 面试间链接码
- `interviewUrl`: 候选人面试链接（候选人通过此链接参加面试）
- `createdTime`: 邀请创建时间

### 4. 取消面试

取消候选人的面试邀请。

```bash
node "$SKILLS_ROOT/hina-interview/scripts/cancel-interview.js" --candidate-id <outId>
```

**参数：**
- `--candidate-id` (必填): 候选人三方 ID (outId，邀请时返回的 ID)

**示例：**
```bash
node "$SKILLS_ROOT/hina-interview/scripts/cancel-interview.js" --candidate-id "candidate_1708123456789_abc123"
```

### 5. 获取面试报告

获取候选人的面试评估报告。

```bash
node "$SKILLS_ROOT/hina-interview/scripts/get-report.js" --candidate-id <outId>
```

**参数：**
- `--candidate-id` (必填): 候选人三方 ID (outId，邀请时返回的 ID)

**示例：**
```bash
node "$SKILLS_ROOT/hina-interview/scripts/get-report.js" --candidate-id "candidate_1708123456789_abc123"
```

### 6. 获取推荐面试列表

获取系统推荐的面试间列表。

```bash
node "$SKILLS_ROOT/hina-interview/scripts/get-recommendations.js" [--page <num>] [--page-size <num>]
```

**参数：**
- `--page` (可选): 页码，默认 1
- `--page-size` (可选): 每页数量，默认 20

**注意：**
- `interviewCode` 以 `T` 开头的是面试模板，不是真正的面试间
- 返回结果会自动过滤掉模板，只返回真正的面试间
- 如果没有可用的面试间，会提示用户先创建

**示例：**
```bash
node "$SKILLS_ROOT/hina-interview/scripts/get-recommendations.js" --page 1 --page-size 10
```

**返回数据：**
- `list`: 可用的面试间列表（已过滤掉模板）
- `total`: 可用面试间数量
- `templatesFiltered`: 被过滤掉的模板数量

## 返回格式

所有脚本都返回 JSON 格式的结果：

**成功示例：**
```json
{
  "success": true,
  "data": {
    ...
  },
  "message": "操作成功"
}
```

**失败示例：**
```json
{
  "success": false,
  "error": "错误信息"
}
```

## 使用场景示例

### 场景 1: 创建面试并邀请候选人

```
用户: 帮我创建一个前端开发的 AI 面试，然后邀请张三参加

Agent:
1. 首先调用 create-interview.js 获取创建页面链接
2. 告知用户打开链接创建面试间，创建完成后会返回 interviewCode
3. 使用 interviewCode 调用 invite-candidate.js 邀请候选人：
   - 需要候选人姓名、手机号
   - 邮箱是可选的
   - 会返回面试链接 (interviewUrl)，候选人通过此链接参加面试
```

### 场景 2: 查看候选人面试结果

```
用户: 张三的面试结果出来了吗？

Agent:
1. 使用邀请时返回的 outId 调用 get-report.js 获取面试报告
2. 解析报告内容，总结关键信息：
   - 综合评分
   - 各维度得分
   - 推荐等级
   - 亮点和关注点
```

## 注意事项

1. **凭证安全**: appKey 和 appSecret 是敏感信息，请勿泄露
2. **面试间链接码 (interviewCode)**: 创建面试间后请保存 interviewCode，邀请候选人时需要使用
3. **候选人 ID (outId)**: 邀请候选人后会返回 outId，用于后续查询报告和取消面试
4. **面试链接 (interviewUrl)**: 邀请成功后返回的 interviewUrl 是候选人参加面试的入口
5. **回调通知**: 建议配置 Webhook 接收面试状态变更通知

## 相关链接

- [海纳 AI 面试 API 文档](https://q0d0xp5txc.apifox.cn/8073705m0.md)
- [身份验证方式](https://q0d0xp5txc.apifox.cn/8073773m0.md)
