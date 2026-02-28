/**
 * 海纳 AI 面试 Webhook Handler
 *
 * 接收海纳系统的回调事件，包括：
 * - 候选人签到
 * - 面试开始
 * - 面试结束
 * - 评估结果
 */

import { EventEmitter } from 'events';
import * as http from 'http';
import * as crypto from 'crypto';

export interface HinaWebhookConfig {
  enabled: boolean;
  port: number;
  path: string;
  secret?: string; // 用于验证请求来源
}

export interface HinaWebhookEvent {
  eventType: 'check_in' | 'interview_start' | 'interview_end' | 'evaluation_result';
  interviewId: string;
  candidateId: string;
  candidateName?: string;
  timestamp: number;
  data?: Record<string, unknown>;
}

export interface HinaWebhookStatus {
  running: boolean;
  port: number | null;
  url: string | null;
  lastEventTime: number | null;
  totalEvents: number;
}

const DEFAULT_CONFIG: HinaWebhookConfig = {
  enabled: false,
  port: 8924,
  path: '/webhook/hina',
  secret: undefined
};

export class HinaWebhookHandler extends EventEmitter {
  private config: HinaWebhookConfig;
  private server: http.Server | null = null;
  private status: HinaWebhookStatus = {
    running: false,
    port: null,
    url: null,
    lastEventTime: null,
    totalEvents: 0
  };
  private log: (...args: unknown[]) => void = () => {};

  constructor(config?: Partial<HinaWebhookConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 设置日志函数
   */
  setLogger(logFn: (...args: unknown[]) => void): void {
    this.log = logFn;
  }

  /**
   * 获取当前状态
   */
  getStatus(): HinaWebhookStatus {
    return { ...this.status };
  }

  /**
   * 获取配置
   */
  getConfig(): HinaWebhookConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<HinaWebhookConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取 Webhook URL
   */
  getWebhookUrl(): string | null {
    if (!this.status.running || !this.status.port) {
      return null;
    }
    // 返回外部可访问的 URL (需要用户配置公网地址或使用内网穿透)
    return `http://localhost:${this.status.port}${this.config.path}`;
  }

  /**
   * 启动 Webhook 服务器
   */
  async start(): Promise<void> {
    if (this.server) {
      this.log('[Hina Webhook] Server already running');
      return;
    }

    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EADDRINUSE') {
          this.log(`[Hina Webhook] Port ${this.config.port} is in use, trying next port`);
          this.config.port++;
          this.server?.listen(this.config.port, '0.0.0.0');
        } else {
          this.log('[Hina Webhook] Server error:', error.message);
          reject(error);
        }
      });

      this.server.listen(this.config.port, '0.0.0.0', () => {
        this.status.running = true;
        this.status.port = this.config.port;
        this.status.url = `http://localhost:${this.config.port}${this.config.path}`;
        this.log(`[Hina Webhook] Server started on port ${this.config.port}`);
        this.log(`[Hina Webhook] Webhook URL: ${this.status.url}`);
        this.emit('started', this.status.url);
        resolve();
      });
    });
  }

  /**
   * 停止 Webhook 服务器
   */
  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }

    return new Promise((resolve) => {
      this.server?.close(() => {
        this.server = null;
        this.status.running = false;
        this.status.port = null;
        this.status.url = null;
        this.log('[Hina Webhook] Server stopped');
        this.emit('stopped');
        resolve();
      });
    });
  }

  /**
   * 处理 HTTP 请求
   */
  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const { method, url } = req;

    // 只处理 POST 请求到指定路径
    if (method !== 'POST' || !url?.startsWith(this.config.path)) {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'Not Found' }));
      return;
    }

    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        // 验证签名（如果配置了 secret）
        if (this.config.secret) {
          const signature = req.headers['x-hina-signature'] as string;
          if (!this.verifySignature(body, signature)) {
            res.statusCode = 401;
            res.end(JSON.stringify({ error: 'Invalid signature' }));
            this.log('[Hina Webhook] Invalid signature');
            return;
          }
        }

        // 解析请求体
        const payload = JSON.parse(body);
        this.log('[Hina Webhook] Received event:', JSON.stringify(payload, null, 2));

        // 转换为统一的事件格式
        const event = this.parseEvent(payload);

        if (event) {
          // 更新状态
          this.status.lastEventTime = Date.now();
          this.status.totalEvents++;

          // 触发事件
          this.emit('event', event);
          this.emit(event.eventType, event);

          this.log(`[Hina Webhook] Event processed: ${event.eventType}`, {
            interviewId: event.interviewId,
            candidateId: event.candidateId,
            candidateName: event.candidateName
          });
        }

        res.statusCode = 200;
        res.end(JSON.stringify({ success: true }));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.log('[Hina Webhook] Error processing request:', errorMessage);
        res.statusCode = 400;
        res.end(JSON.stringify({ error: errorMessage }));
      }
    });
  }

  /**
   * 验证签名
   */
  private verifySignature(body: string, signature: string | undefined): boolean {
    if (!this.config.secret || !signature) {
      return true; // 如果没有配置 secret，跳过验证
    }

    const expectedSignature = crypto
      .createHmac('sha256', this.config.secret)
      .update(body)
      .digest('hex');

    return signature === expectedSignature;
  }

  /**
   * 解析海纳回调事件
   *
   * 根据海纳官方文档，回调格式为：
   * {
   *   callbackData: {
   *     event: "aiExamCandidateSignIn" | "aiExamCandidateBegin" | "aiExamCandidateEnd" | "aiExamCandidateReview",
   *     outId: "候选人ID",  // 简单事件
   *     candidateInfo: { outId: "...", ... },  // aiExamCandidateReview 事件
   *     interviewInfo: { connectCode: "...", ... }, // aiExamCandidateReview 事件
   *     ...
   *   },
   *   callbackUrl: "...",
   *   companyId: ...
   * }
   */
  private parseEvent(payload: Record<string, unknown>): HinaWebhookEvent | null {
    // 事件数据在 callbackData 中
    const data = (payload.callbackData as Record<string, unknown>) || payload;

    const event = data.event as string;
    if (!event) {
      this.log('[Hina Webhook] Invalid payload: missing event field');
      return null;
    }

    // 提取候选人和面试信息（aiExamCandidateReview 事件有这些字段）
    const candidateInfo = data.candidateInfo as Record<string, unknown> | undefined;
    const interviewInfo = data.interviewInfo as Record<string, unknown> | undefined;

    // 提取候选人 ID：
    // - 简单事件（签到/开始/结束）：outId 在 data 根级别
    // - 评估结果事件：outId 在 candidateInfo 中
    const candidateId = (data.outId as string) || (candidateInfo?.outId as string) || '';

    const candidateName = candidateInfo?.name as string | undefined;
    const interviewCode = (interviewInfo?.connectCode as string) || '';

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

    this.log(`[Hina Webhook] Parsed event: ${event} -> ${mappedEventType}`, {
      candidateId,
      candidateName,
      interviewCode
    });

    return {
      eventType: mappedEventType,
      interviewId: interviewCode,
      candidateId,
      candidateName,
      timestamp: Date.now(),
      data: payload
    };
  }

  /**
   * 设置事件回调
   */
  onEvent(callback: (event: HinaWebhookEvent) => void): void {
    this.on('event', callback);
  }

  /**
   * 设置特定事件类型的回调
   */
  onEventType(
    eventType: HinaWebhookEvent['eventType'],
    callback: (event: HinaWebhookEvent) => void
  ): void {
    this.on(eventType, callback);
  }
}

// 导出单例
let webhookHandler: HinaWebhookHandler | null = null;

export function getHinaWebhookHandler(config?: Partial<HinaWebhookConfig>): HinaWebhookHandler {
  if (!webhookHandler) {
    webhookHandler = new HinaWebhookHandler(config);
  }
  return webhookHandler;
}
