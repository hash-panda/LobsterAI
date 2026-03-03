/**
 * IM Gateway Manager
 * Unified manager for DingTalk, Feishu and Telegram gateways
 */

import { EventEmitter } from 'events';
import { DingTalkGateway } from './dingtalkGateway';
import { FeishuGateway } from './feishuGateway';
import { TelegramGateway } from './telegramGateway';
import { DiscordGateway } from './discordGateway';
import { NimGateway } from './nimGateway';
import { IMChatHandler } from './imChatHandler';
import { IMCoworkHandler } from './imCoworkHandler';
import { IMStore } from './imStore';
import { getOapiAccessToken } from './dingtalkMedia';
import { fetchJsonWithTimeout } from './http';
import { HinaWebhookHandler, HinaWebhookEvent } from './hinaWebhookHandler';
import { TunnelService, getTunnelService } from './tunnelService';
import {
  getHinaCandidateStore,
  HinaCandidateStore,
  CandidateStatus,
  CandidateEventType,
} from '../hinaCandidateStore';
import { HinaNotificationConfig, DEFAULT_HINA_NOTIFICATION_CONFIG } from './types';
import { BrowserWindow } from 'electron';
import {
  IMGatewayConfig,
  IMGatewayStatus,
  IMPlatform,
  IMMessage,
  IMConnectivityCheck,
  IMConnectivityTestResult,
  IMConnectivityVerdict,
  TunnelConfig,
  TunnelStatus,
} from './types';
import type { Database } from 'sql.js';
import type { CoworkRunner } from '../libs/coworkRunner';
import type { CoworkStore } from '../coworkStore';
const CONNECTIVITY_TIMEOUT_MS = 10_000;
const INBOUND_ACTIVITY_WARN_AFTER_MS = 2 * 60 * 1000;

interface TelegramGetMeResponse {
  ok?: boolean;
  result?: {
    username?: string;
  };
  description?: string;
}

interface DiscordUserResponse {
  username?: string;
  discriminator?: string;
}

export interface IMGatewayManagerOptions {
  coworkRunner?: CoworkRunner;
  coworkStore?: CoworkStore;
}

export class IMGatewayManager extends EventEmitter {
  private dingtalkGateway: DingTalkGateway;
  private feishuGateway: FeishuGateway;
  private telegramGateway: TelegramGateway;
  private discordGateway: DiscordGateway;
  private nimGateway: NimGateway;
  private hinaWebhook: HinaWebhookHandler;
  private tunnelService: TunnelService;
  private imStore: IMStore;
  private chatHandler: IMChatHandler | null = null;
  private coworkHandler: IMCoworkHandler | null = null;
  private getLLMConfig: (() => Promise<any>) | null = null;
  private getSkillsPrompt: (() => Promise<string | null>) | null = null;

  // Cowork dependencies
  private coworkRunner: CoworkRunner | null = null;
  private coworkStore: CoworkStore | null = null;

  constructor(db: Database, saveDb: () => void, options?: IMGatewayManagerOptions) {
    super();

    this.imStore = new IMStore(db, saveDb);
    this.dingtalkGateway = new DingTalkGateway();
    this.feishuGateway = new FeishuGateway();
    this.telegramGateway = new TelegramGateway();
    this.discordGateway = new DiscordGateway();
    this.nimGateway = new NimGateway();
    this.hinaWebhook = new HinaWebhookHandler();
    this.hinaWebhook.setLogger((...args) => console.log('[HinaWebhook]', ...args));
    this.tunnelService = getTunnelService();

    // Store Cowork dependencies if provided
    if (options?.coworkRunner && options?.coworkStore) {
      this.coworkRunner = options.coworkRunner;
      this.coworkStore = options.coworkStore;
    }

    // Forward gateway events
    this.setupGatewayEventForwarding();
  }

  /**
   * Set up event forwarding from gateways
   */
  private setupGatewayEventForwarding(): void {
    // DingTalk events
    this.dingtalkGateway.on('connected', () => {
      this.emit('statusChange', this.getStatus());
    });
    this.dingtalkGateway.on('disconnected', () => {
      this.emit('statusChange', this.getStatus());
    });
    this.dingtalkGateway.on('error', (error) => {
      this.emit('error', { platform: 'dingtalk', error });
      this.emit('statusChange', this.getStatus());
    });
    this.dingtalkGateway.on('message', (message: IMMessage) => {
      this.emit('message', message);
    });

    // Feishu events
    this.feishuGateway.on('connected', () => {
      this.emit('statusChange', this.getStatus());
    });
    this.feishuGateway.on('disconnected', () => {
      this.emit('statusChange', this.getStatus());
    });
    this.feishuGateway.on('error', (error) => {
      this.emit('error', { platform: 'feishu', error });
      this.emit('statusChange', this.getStatus());
    });
    this.feishuGateway.on('message', (message: IMMessage) => {
      this.emit('message', message);
    });

    // Telegram events
    this.telegramGateway.on('connected', () => {
      this.emit('statusChange', this.getStatus());
    });
    this.telegramGateway.on('disconnected', () => {
      this.emit('statusChange', this.getStatus());
    });
    this.telegramGateway.on('error', (error) => {
      this.emit('error', { platform: 'telegram', error });
      this.emit('statusChange', this.getStatus());
    });
    this.telegramGateway.on('message', (message: IMMessage) => {
      this.emit('message', message);
    });

    // Discord events
    this.discordGateway.on('status', () => {
      this.emit('statusChange', this.getStatus());
    });
    this.discordGateway.on('connected', () => {
      this.emit('statusChange', this.getStatus());
    });
    this.discordGateway.on('disconnected', () => {
      this.emit('statusChange', this.getStatus());
    });
    this.discordGateway.on('error', (error) => {
      this.emit('error', { platform: 'discord', error });
      this.emit('statusChange', this.getStatus());
    });
    this.discordGateway.on('message', (message: IMMessage) => {
      this.emit('message', message);
    });

    // NIM events
    this.nimGateway.on('status', () => {
      this.emit('statusChange', this.getStatus());
    });
    this.nimGateway.on('connected', () => {
      this.emit('statusChange', this.getStatus());
    });
    this.nimGateway.on('disconnected', () => {
      this.emit('statusChange', this.getStatus());
    });
    this.nimGateway.on('error', (error) => {
      this.emit('error', { platform: 'nim', error });
      this.emit('statusChange', this.getStatus());
    });
    this.nimGateway.on('message', (message: IMMessage) => {
      this.emit('message', message);
    });

    // Hina Webhook events
    this.hinaWebhook.on('started', (url: string) => {
      console.log(`[IMGatewayManager] Hina webhook started: ${url}`);
      this.emit('hinaWebhookStarted', url);
    });
    this.hinaWebhook.on('stopped', () => {
      console.log('[IMGatewayManager] Hina webhook stopped');
      this.emit('hinaWebhookStopped');
    });
    this.hinaWebhook.on('event', (event: HinaWebhookEvent) => {
      console.log('[IMGatewayManager] Hina webhook event received:');
      console.log('  - eventType:', event.eventType);
      console.log('  - interviewId:', event.interviewId);
      console.log('  - candidateId:', event.candidateId);
      console.log('  - candidateName:', event.candidateName);
      console.log('  - timestamp:', new Date(event.timestamp).toISOString());
      console.log('  - data:', JSON.stringify(event.data, null, 2));

      // 处理候选人状态更新
      this.handleHinaCandidateEvent(event).catch((err) => {
        console.error('[IMGatewayManager] Failed to handle Hina candidate event:', err);
      });

      this.emit('hinaEvent', event);

      // 尝试发送通知到飞书
      this.sendHinaNotificationToFeishu(event).catch((err) => {
        console.error('[IMGatewayManager] Failed to send Hina notification to Feishu:', err);
      });
    });

    // Tunnel events
    this.tunnelService.on('started', (publicUrl: string) => {
      console.log(`[IMGatewayManager] Tunnel started: ${publicUrl}`);
      this.emit('tunnelStarted', publicUrl);
    });
    this.tunnelService.on('stopped', () => {
      console.log('[IMGatewayManager] Tunnel stopped');
      this.emit('tunnelStopped');
    });
    this.tunnelService.on('error', (error: string) => {
      console.error('[IMGatewayManager] Tunnel error:', error);
      this.emit('tunnelError', error);
    });
  }

  /**
   * Reconnect all disconnected gateways
   * Called when network is restored via IPC event
   */
  reconnectAllDisconnected(): void {
    console.log('[IMGatewayManager] Reconnecting all disconnected gateways...');

    if (this.dingtalkGateway && !this.dingtalkGateway.isConnected()) {
      console.log('[IMGatewayManager] Reconnecting DingTalk...');
      this.dingtalkGateway.reconnectIfNeeded();
    }

    if (this.feishuGateway && !this.feishuGateway.isConnected()) {
      console.log('[IMGatewayManager] Reconnecting Feishu...');
      this.feishuGateway.reconnectIfNeeded();
    }

    if (this.telegramGateway && !this.telegramGateway.isConnected()) {
      console.log('[IMGatewayManager] Reconnecting Telegram...');
      this.telegramGateway.reconnectIfNeeded();
    }

    if (this.discordGateway && !this.discordGateway.isConnected()) {
      console.log('[IMGatewayManager] Reconnecting Discord...');
      this.discordGateway.reconnectIfNeeded();
    }

    if (this.nimGateway && !this.nimGateway.isConnected()) {
      console.log('[IMGatewayManager] Reconnecting NIM...');
      this.nimGateway.reconnectIfNeeded();
    }
  }

  /**
   * Initialize the manager with LLM and skills providers
   */
  initialize(options: {
    getLLMConfig: () => Promise<any>;
    getSkillsPrompt?: () => Promise<string | null>;
  }): void {
    this.getLLMConfig = options.getLLMConfig;
    this.getSkillsPrompt = options.getSkillsPrompt ?? null;

    // Set up message handlers for gateways
    this.setupMessageHandlers();
  }

  /**
   * Set up message handlers for both gateways
   */
  private setupMessageHandlers(): void {
    const messageHandler = async (
      message: IMMessage,
      replyFn: (text: string) => Promise<void>
    ): Promise<void> => {
      try {
        let response: string;

        // Always use Cowork mode if handler is available
        if (this.coworkHandler) {
          console.log('[IMGatewayManager] Using Cowork mode for message processing');
          response = await this.coworkHandler.processMessage(message);
        } else {
          // Fallback to regular chat handler
          if (!this.chatHandler) {
            this.updateChatHandler();
          }

          if (!this.chatHandler) {
            throw new Error('Chat handler not available');
          }

          response = await this.chatHandler.processMessage(message);
        }

        await replyFn(response);
      } catch (error: any) {
        console.error(`[IMGatewayManager] Error processing message: ${error.message}`);
        // Don't send "Replaced by a newer IM request" error to user, just log it
        if (error.message === 'Replaced by a newer IM request') {
          return;
        }
        // Send error message to user
        try {
          await replyFn(`处理消息时出错: ${error.message}`);
        } catch (replyError) {
          console.error(`[IMGatewayManager] Failed to send error reply: ${replyError}`);
        }
      }
    };

    this.dingtalkGateway.setMessageCallback(messageHandler);
    this.feishuGateway.setMessageCallback(messageHandler);
    this.telegramGateway.setMessageCallback(messageHandler);
    this.discordGateway.setMessageCallback(messageHandler);
    this.nimGateway.setMessageCallback(messageHandler);
  }

  /**
   * Update chat handler with current settings
   */
  private updateChatHandler(): void {
    if (!this.getLLMConfig) {
      console.warn('[IMGatewayManager] LLM config provider not set');
      return;
    }

    const imSettings = this.imStore.getIMSettings();

    this.chatHandler = new IMChatHandler({
      getLLMConfig: this.getLLMConfig,
      getSkillsPrompt: this.getSkillsPrompt || undefined,
      imSettings,
    });

    // Update or create Cowork handler if dependencies are available
    this.updateCoworkHandler();
  }

  /**
   * Update or create Cowork handler
   * Always creates handler if dependencies are available (Cowork mode is always enabled for IM)
   */
  private updateCoworkHandler(): void {
    // Always create Cowork handler if we have the required dependencies
    if (this.coworkRunner && this.coworkStore && !this.coworkHandler) {
      this.coworkHandler = new IMCoworkHandler({
        coworkRunner: this.coworkRunner,
        coworkStore: this.coworkStore,
        imStore: this.imStore,
        getSkillsPrompt: this.getSkillsPrompt || undefined,
      });
      console.log('[IMGatewayManager] Cowork handler created');
    }
  }

  // ==================== Configuration ====================

  /**
   * Get current configuration
   */
  getConfig(): IMGatewayConfig {
    return this.imStore.getConfig();
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<IMGatewayConfig>): void {
    this.imStore.setConfig(config);

    // Update chat handler if settings changed
    if (config.settings) {
      this.updateChatHandler();
    }

    // Hot-update Telegram config on running gateway
    if (config.telegram && this.telegramGateway) {
      this.telegramGateway.updateConfig(config.telegram);
    }
  }

  // ==================== Status ====================

  /**
   * Get current status of all gateways
   */
  getStatus(): IMGatewayStatus {
    return {
      dingtalk: this.dingtalkGateway.getStatus(),
      feishu: this.feishuGateway.getStatus(),
      telegram: this.telegramGateway.getStatus(),
      discord: this.discordGateway.getStatus(),
      nim: this.nimGateway.getStatus(),
    };
  }

  /**
   * Test platform connectivity and readiness for conversation.
   */
  async testGateway(
    platform: IMPlatform,
    configOverride?: Partial<IMGatewayConfig>
  ): Promise<IMConnectivityTestResult> {
    const config = this.buildMergedConfig(configOverride);
    const checks: IMConnectivityCheck[] = [];
    const testedAt = Date.now();

    const addCheck = (check: IMConnectivityCheck) => {
      checks.push(check);
    };

    const missingCredentials = this.getMissingCredentials(platform, config);
    if (missingCredentials.length > 0) {
      addCheck({
        code: 'missing_credentials',
        level: 'fail',
        message: `缺少必要配置项: ${missingCredentials.join(', ')}`,
        suggestion: '请补全配置后重新测试连通性。',
      });

      return {
        platform,
        testedAt,
        verdict: 'fail',
        checks,
      };
    }

    try {
      const authMessage = await this.withTimeout(
        this.runAuthProbe(platform, config),
        CONNECTIVITY_TIMEOUT_MS,
        '鉴权探测超时'
      );
      addCheck({
        code: 'auth_check',
        level: 'pass',
        message: authMessage,
      });
    } catch (error: any) {
      addCheck({
        code: 'auth_check',
        level: 'fail',
        message: `鉴权失败: ${error.message}`,
        suggestion: '请检查 ID/Secret/Token 是否正确，且机器人权限已开通。',
      });
      return {
        platform,
        testedAt,
        verdict: 'fail',
        checks,
      };
    }

    const status = this.getStatus();
    const enabled = Boolean(config[platform]?.enabled);
    const connected = this.isConnected(platform);

    if (enabled && !connected) {
      const discordStarting = platform === 'discord' && status.discord.starting;
      addCheck({
        code: 'gateway_running',
        level: discordStarting ? 'info' : 'warn',
        message: discordStarting
          ? 'IM 渠道正在启动，请稍后重试。'
          : 'IM 渠道已启用但当前未连接。',
        suggestion: discordStarting
          ? '等待启动完成后重新测试。'
          : '请检查网络、机器人配置和平台侧事件开关。',
      });
    } else {
      addCheck({
        code: 'gateway_running',
        level: connected ? 'pass' : 'info',
        message: connected ? 'IM 渠道已启用且运行正常。' : 'IM 渠道当前未启用。',
        suggestion: connected ? undefined : '请点击对应 IM 渠道胶囊按钮启用该渠道。',
      });
    }

    const startedAt = this.getStartedAtMs(platform, status);
    const lastInboundAt = this.getLastInboundAt(platform, status);
    const lastOutboundAt = this.getLastOutboundAt(platform, status);

    if (connected && startedAt && testedAt - startedAt >= INBOUND_ACTIVITY_WARN_AFTER_MS) {
      if (!lastInboundAt) {
        addCheck({
          code: 'inbound_activity',
          level: 'warn',
          message: '已连接超过 2 分钟，但尚未收到任何入站消息。',
          suggestion: '请确认机器人已在目标会话中，或按平台规则 @机器人 触发消息。',
        });
      } else {
        addCheck({
          code: 'inbound_activity',
          level: 'pass',
          message: '已检测到入站消息。',
        });
      }
    } else if (connected) {
      addCheck({
        code: 'inbound_activity',
        level: 'info',
        message: '网关刚启动，入站活动检查将在 2 分钟后更准确。',
      });
    }

    if (connected && lastInboundAt) {
      if (!lastOutboundAt) {
        addCheck({
          code: 'outbound_activity',
          level: 'warn',
          message: '已收到消息，但尚未观察到成功回发。',
          suggestion: '请检查消息发送权限、机器人可见范围和会话回包权限。',
        });
      } else {
        addCheck({
          code: 'outbound_activity',
          level: 'pass',
          message: '已检测到成功回发消息。',
        });
      }
    } else if (connected) {
      addCheck({
        code: 'outbound_activity',
        level: 'info',
        message: '尚未收到可用于评估回发能力的入站消息。',
      });
    }

    const lastError = this.getLastError(platform, status);
    if (lastError) {
      addCheck({
        code: 'platform_last_error',
        level: connected ? 'warn' : 'fail',
        message: `最近错误: ${lastError}`,
        suggestion: connected
          ? '当前已连接，但建议修复该错误避免后续中断。'
          : '该错误可能阻断对话，请优先修复后重试。',
      });
    }

    if (platform === 'feishu') {
      addCheck({
        code: 'feishu_group_requires_mention',
        level: 'info',
        message: '飞书群聊中仅响应 @机器人的消息。',
        suggestion: '请在群聊中使用 @机器人 + 内容触发对话。',
      });
      addCheck({
        code: 'feishu_event_subscription_required',
        level: 'info',
        message: '飞书需要开启消息事件订阅（im.message.receive_v1）才能收消息。',
        suggestion: '请在飞书开发者后台确认事件订阅、权限和发布状态。',
      });
    } else if (platform === 'discord') {
      addCheck({
        code: 'discord_group_requires_mention',
        level: 'info',
        message: 'Discord 群聊中仅响应 @机器人的消息。',
        suggestion: '请在频道中使用 @机器人 + 内容触发对话。',
      });
    } else if (platform === 'telegram') {
      addCheck({
        code: 'telegram_privacy_mode_hint',
        level: 'info',
        message: 'Telegram 可能受 Bot Privacy Mode 影响。',
        suggestion: '若群聊中不响应，请在 @BotFather 检查 Privacy Mode 配置。',
      });
    } else if (platform === 'dingtalk') {
      addCheck({
        code: 'dingtalk_bot_membership_hint',
        level: 'info',
        message: '钉钉机器人需被加入目标会话并具备发言权限。',
        suggestion: '请确认机器人在目标会话中，且企业权限配置允许收发消息。',
      });
    } else if (platform === 'nim') {
      addCheck({
        code: 'nim_p2p_only_hint',
        level: 'info',
        message: '云信 IM 当前仅支持 P2P（私聊）消息。',
        suggestion: '请通过私聊方式向机器人账号发送消息触发对话。',
      });
    }

    return {
      platform,
      testedAt,
      verdict: this.calculateVerdict(checks),
      checks,
    };
  }

  // ==================== Gateway Control ====================

  /**
   * Start a specific gateway
   */
  async startGateway(platform: IMPlatform): Promise<void> {
    const config = this.getConfig();

    // Ensure chat handler is ready
    this.updateChatHandler();

    if (platform === 'dingtalk') {
      await this.dingtalkGateway.start(config.dingtalk);
    } else if (platform === 'feishu') {
      await this.feishuGateway.start(config.feishu);
    } else if (platform === 'telegram') {
      await this.telegramGateway.start(config.telegram);
    } else if (platform === 'discord') {
      await this.discordGateway.start(config.discord);
    } else if (platform === 'nim') {
      await this.nimGateway.start(config.nim);
    }
  }

  /**
   * Stop a specific gateway
   */
  async stopGateway(platform: IMPlatform): Promise<void> {
    if (platform === 'dingtalk') {
      await this.dingtalkGateway.stop();
    } else if (platform === 'feishu') {
      await this.feishuGateway.stop();
    } else if (platform === 'telegram') {
      await this.telegramGateway.stop();
    } else if (platform === 'discord') {
      await this.discordGateway.stop();
    } else if (platform === 'nim') {
      await this.nimGateway.stop();
    }
  }

  /**
   * Start all enabled gateways
   */
  async startAllEnabled(): Promise<void> {
    const config = this.getConfig();

    if (config.dingtalk.enabled && config.dingtalk.clientId && config.dingtalk.clientSecret) {
      try {
        await this.startGateway('dingtalk');
      } catch (error: any) {
        console.error(`[IMGatewayManager] Failed to start DingTalk: ${error.message}`);
      }
    }

    if (config.feishu.enabled && config.feishu.appId && config.feishu.appSecret) {
      try {
        await this.startGateway('feishu');
      } catch (error: any) {
        console.error(`[IMGatewayManager] Failed to start Feishu: ${error.message}`);
      }
    }

    if (config.telegram.enabled && config.telegram.botToken) {
      try {
        await this.startGateway('telegram');
      } catch (error: any) {
        console.error(`[IMGatewayManager] Failed to start Telegram: ${error.message}`);
      }
    }

    if (config.discord.enabled && config.discord.botToken) {
      try {
        await this.startGateway('discord');
      } catch (error: any) {
        console.error(`[IMGatewayManager] Failed to start Discord: ${error.message}`);
      }
    }

    if (config.nim.enabled && config.nim.appKey && config.nim.account && config.nim.token) {
      try {
        await this.startGateway('nim');
      } catch (error: any) {
        console.error(`[IMGatewayManager] Failed to start NIM: ${error.message}`);
      }
    }

    // Start Hina Webhook if enabled
    const hinaConfig = this.imStore.getHinaConfig?.();
    if (hinaConfig?.webhookEnabled) {
      try {
        await this.hinaWebhook.start();
      } catch (error: any) {
        console.error(`[IMGatewayManager] Failed to start Hina Webhook: ${error.message}`);
      }
    }
  }

  /**
   * Stop all gateways
   */
  async stopAll(): Promise<void> {
    await Promise.all([
      this.dingtalkGateway.stop(),
      this.feishuGateway.stop(),
      this.telegramGateway.stop(),
      this.discordGateway.stop(),
      this.nimGateway.stop(),
      this.hinaWebhook.stop(),
      this.tunnelService.stop(),
    ]);
  }

  /**
   * Check if any gateway is connected
   */
  isAnyConnected(): boolean {
    return this.dingtalkGateway.isConnected() || this.feishuGateway.isConnected() || this.telegramGateway.isConnected() || this.discordGateway.isConnected() || this.nimGateway.isConnected();
  }

  /**
   * Check if a specific gateway is connected
   */
  isConnected(platform: IMPlatform): boolean {
    if (platform === 'dingtalk') {
      return this.dingtalkGateway.isConnected();
    }
    if (platform === 'telegram') {
      return this.telegramGateway.isConnected();
    }
    if (platform === 'discord') {
      return this.discordGateway.isConnected();
    }
    if (platform === 'nim') {
      return this.nimGateway.isConnected();
    }
    return this.feishuGateway.isConnected();
  }

  /**
   * Send a notification message through a specific platform.
   * Uses platform-specific broadcast mechanisms.
   * Returns true if successfully sent, false if platform not connected.
   */
  async sendNotification(platform: IMPlatform, text: string): Promise<boolean> {
    if (!this.isConnected(platform)) {
      console.warn(`[IMGatewayManager] Cannot send notification: ${platform} is not connected`);
      return false;
    }

    try {
      if (platform === 'dingtalk') {
        await this.dingtalkGateway.sendNotification(text);
      } else if (platform === 'feishu') {
        await this.feishuGateway.sendNotification(text);
      } else if (platform === 'telegram') {
        await this.telegramGateway.sendNotification(text);
      } else if (platform === 'discord') {
        await this.discordGateway.sendNotification(text);
      } else if (platform === 'nim') {
        await this.nimGateway.sendNotification(text);
      }
      return true;
    } catch (error: any) {
      console.error(`[IMGatewayManager] Failed to send notification via ${platform}:`, error.message);
      return false;
    }
  }

  private buildMergedConfig(configOverride?: Partial<IMGatewayConfig>): IMGatewayConfig {
    const current = this.getConfig();
    if (!configOverride) {
      return current;
    }
    return {
      ...current,
      ...configOverride,
      dingtalk: { ...current.dingtalk, ...(configOverride.dingtalk || {}) },
      feishu: { ...current.feishu, ...(configOverride.feishu || {}) },
      telegram: { ...current.telegram, ...(configOverride.telegram || {}) },
      discord: { ...current.discord, ...(configOverride.discord || {}) },
      nim: { ...current.nim, ...(configOverride.nim || {}) },
      settings: { ...current.settings, ...(configOverride.settings || {}) },
    };
  }

  private getMissingCredentials(platform: IMPlatform, config: IMGatewayConfig): string[] {
    if (platform === 'dingtalk') {
      const fields: string[] = [];
      if (!config.dingtalk.clientId) fields.push('clientId');
      if (!config.dingtalk.clientSecret) fields.push('clientSecret');
      return fields;
    }
    if (platform === 'feishu') {
      const fields: string[] = [];
      if (!config.feishu.appId) fields.push('appId');
      if (!config.feishu.appSecret) fields.push('appSecret');
      return fields;
    }
    if (platform === 'telegram') {
      return config.telegram.botToken ? [] : ['botToken'];
    }
    if (platform === 'nim') {
      const fields: string[] = [];
      if (!config.nim.appKey) fields.push('appKey');
      if (!config.nim.account) fields.push('account');
      if (!config.nim.token) fields.push('token');
      return fields;
    }
    return config.discord.botToken ? [] : ['botToken'];
  }

  private async runAuthProbe(platform: IMPlatform, config: IMGatewayConfig): Promise<string> {
    if (platform === 'dingtalk') {
      await getOapiAccessToken(config.dingtalk.clientId, config.dingtalk.clientSecret);
      return '钉钉鉴权通过。';
    }

    if (platform === 'feishu') {
      const Lark = await import('@larksuiteoapi/node-sdk');
      const domain = this.resolveFeishuDomain(config.feishu.domain, Lark);
      const client = new Lark.Client({
        appId: config.feishu.appId,
        appSecret: config.feishu.appSecret,
        appType: Lark.AppType.SelfBuild,
        domain,
      });
      const response: any = await client.request({
        method: 'GET',
        url: '/open-apis/bot/v3/info',
      });
      if (response.code !== 0) {
        throw new Error(response.msg || `code ${response.code}`);
      }
      const botName = response.data?.app_name ?? response.data?.bot?.app_name ?? 'unknown';
      return `飞书鉴权通过（Bot: ${botName}）。`;
    }

    if (platform === 'telegram') {
      const response = await fetchJsonWithTimeout<TelegramGetMeResponse>(
        `https://api.telegram.org/bot${config.telegram.botToken}/getMe`,
        {},
        CONNECTIVITY_TIMEOUT_MS
      );
      if (!response.ok) {
        const description = response.description || 'unknown error';
        throw new Error(description);
      }
      const username = response.result?.username ? `@${response.result.username}` : 'unknown';
      return `Telegram 鉴权通过（Bot: ${username}）。`;
    }
    if (platform === 'nim') {
      // If the gateway is already connected, the credentials are valid
      if (this.nimGateway.isConnected()) {
        return `云信鉴权通过（Account: ${config.nim.account}，网关已连接）。`;
      }
      // Without AppSecret we cannot call the REST API for a stateless probe.
      // Just confirm that all required fields are non-empty; the real credential
      // check will happen when the user enables the gateway and the SDK logs in.
      return `云信配置已填写（Account: ${config.nim.account}）。请启用渠道，SDK 登录时将完成实际凭证验证。`;
    }
    const response = await fetchJsonWithTimeout<DiscordUserResponse>('https://discord.com/api/v10/users/@me', {
      headers: {
        Authorization: `Bot ${config.discord.botToken}`,
      },
    }, CONNECTIVITY_TIMEOUT_MS);
    const username = response.username ? `${response.username}#${response.discriminator || '0000'}` : 'unknown';
    return `Discord 鉴权通过（Bot: ${username}）。`;
  }

  private resolveFeishuDomain(domain: string, Lark: any): any {
    if (domain === 'lark') return Lark.Domain.Lark;
    if (domain === 'feishu') return Lark.Domain.Feishu;
    return domain.replace(/\/+$/, '');
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutError: string): Promise<T> {
    let timeoutId: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<T>((_resolve, reject) => {
      timeoutId = setTimeout(() => reject(new Error(timeoutError)), timeoutMs);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    });
  }

  private getStartedAtMs(platform: IMPlatform, status: IMGatewayStatus): number | null {
    if (platform === 'feishu') {
      return status.feishu.startedAt ? Date.parse(status.feishu.startedAt) : null;
    }
    if (platform === 'dingtalk') return status.dingtalk.startedAt;
    if (platform === 'telegram') return status.telegram.startedAt;
    if (platform === 'nim') return status.nim.startedAt;
    return status.discord.startedAt;
  }

  private getLastInboundAt(platform: IMPlatform, status: IMGatewayStatus): number | null {
    if (platform === 'dingtalk') return status.dingtalk.lastInboundAt;
    if (platform === 'feishu') return status.feishu.lastInboundAt;
    if (platform === 'telegram') return status.telegram.lastInboundAt;
    if (platform === 'nim') return status.nim.lastInboundAt;
    return status.discord.lastInboundAt;
  }

  private getLastOutboundAt(platform: IMPlatform, status: IMGatewayStatus): number | null {
    if (platform === 'dingtalk') return status.dingtalk.lastOutboundAt;
    if (platform === 'feishu') return status.feishu.lastOutboundAt;
    if (platform === 'telegram') return status.telegram.lastOutboundAt;
    if (platform === 'nim') return status.nim.lastOutboundAt;
    return status.discord.lastOutboundAt;
  }

  private getLastError(platform: IMPlatform, status: IMGatewayStatus): string | null {
    if (platform === 'dingtalk') return status.dingtalk.lastError;
    if (platform === 'feishu') return status.feishu.error;
    if (platform === 'telegram') return status.telegram.lastError;
    if (platform === 'nim') return status.nim.lastError;
    return status.discord.lastError;
  }

  private calculateVerdict(checks: IMConnectivityCheck[]): IMConnectivityVerdict {
    if (checks.some((check) => check.level === 'fail')) {
      return 'fail';
    }
    if (checks.some((check) => check.level === 'warn')) {
      return 'warn';
    }
    return 'pass';
  }

  // ==================== Hina Webhook ====================

  /**
   * Get Hina Webhook status
   */
  getHinaWebhookStatus() {
    return this.hinaWebhook.getStatus();
  }

  /**
   * Start Hina Webhook
   */
  async startHinaWebhook(): Promise<void> {
    await this.hinaWebhook.start();
  }

  /**
   * Stop Hina Webhook
   */
  async stopHinaWebhook(): Promise<void> {
    await this.hinaWebhook.stop();
  }

  /**
   * Get Hina Webhook URL
   */
  getHinaWebhookUrl(): string | null {
    return this.hinaWebhook.getWebhookUrl();
  }

  /**
   * Get Hina notification configuration
   */
  getHinaNotificationConfig(): HinaNotificationConfig {
    return this.imStore.getHinaNotificationConfig();
  }

  /**
   * Set Hina notification configuration
   */
  setHinaNotificationConfig(config: Partial<HinaNotificationConfig>): void {
    this.imStore.setHinaNotificationConfig(config);
  }

  /**
   * Send Hina event notification to Feishu and App
   * This is called when a Hina webhook event is received
   */
  async sendHinaNotificationToFeishu(event: HinaWebhookEvent): Promise<void> {
    const notifConfig = this.getHinaNotificationConfig();

    // Check if notification is enabled for this event type
    if (!notifConfig.enabled) {
      console.log('[IMGatewayManager] Hina notification disabled');
      return;
    }

    // Check event-specific notification settings
    const eventNotifMap: Record<string, keyof HinaNotificationConfig> = {
      check_in: 'notifyOnCheckIn',
      interview_start: 'notifyOnStart',
      interview_end: 'notifyOnEnd',
      evaluation_result: 'notifyOnReport',
    };

    const notifKey = eventNotifMap[event.eventType];
    if (notifKey && !notifConfig[notifKey]) {
      console.log(`[IMGatewayManager] Notification disabled for event type: ${event.eventType}`);
      return;
    }

    // Build notification content
    const { title, message, color } = this.buildHinaNotificationContent(event);

    // Send to Feishu
    if (notifConfig.feishuEnabled) {
      await this.sendHinaNotificationToFeishuImpl(event, title, message, color, notifConfig.feishuChatId);
    }

    // Send to App (IPC to renderer)
    if (notifConfig.appEnabled) {
      this.sendHinaNotificationToApp(event, title, message);
    }

    // Emit event for other listeners
    this.emit('hinaNotification', { event, title, message });
  }

  /**
   * Build notification content based on event type
   */
  private buildHinaNotificationContent(event: HinaWebhookEvent): {
    title: string;
    message: string;
    color: string;
  } {
    const candidateName = event.candidateName || event.candidateId;
    const eventData = event.data as Record<string, unknown> | undefined;
    const resultOverView = eventData?.resultOverView as Record<string, unknown> | undefined;

    switch (event.eventType) {
      case 'check_in':
        return {
          title: '候选人签到通知',
          message: `候选人 **${candidateName}** 已签到，即将开始 AI 面试`,
          color: 'blue',
        };
      case 'interview_start':
        return {
          title: '面试开始',
          message: `候选人 **${candidateName}** 的面试已开始`,
          color: 'turquoise',
        };
      case 'interview_end':
        return {
          title: '面试完成',
          message: `候选人 **${candidateName}** 的面试已完成，正在生成评估报告...`,
          color: 'green',
        };
      case 'evaluation_result':
        const score = resultOverView?.scoreAi;
        const scoreText = score !== undefined ? `\n**评分**: ${score}分` : '';
        const auditDesc = resultOverView?.auditDescAi as string | undefined;
        const auditText = auditDesc ? `\n\n**评价**: ${auditDesc.substring(0, 100)}${auditDesc.length > 100 ? '...' : ''}` : '';
        return {
          title: '评估报告已生成',
          message: `候选人 **${candidateName}** 的面试评估报告已生成${scoreText}${auditText}`,
          color: 'purple',
        };
      default:
        return {
          title: '面试状态更新',
          message: `候选人 **${candidateName}** 状态更新: ${event.eventType}`,
          color: 'grey',
        };
    }
  }

  /**
   * Send notification to Feishu (implementation)
   */
  private async sendHinaNotificationToFeishuImpl(
    event: HinaWebhookEvent,
    title: string,
    message: string,
    color: string,
    chatId?: string
  ): Promise<void> {
    const config = this.getConfig();
    if (!config.feishu.enabled) {
      console.log('[IMGatewayManager] Feishu not enabled, skipping notification');
      return;
    }

    if (!this.feishuGateway.isConnected()) {
      console.log('[IMGatewayManager] Feishu not connected, skipping notification');
      return;
    }

    try {
      // Use specified chatId or last active chat
      const targetChatId = chatId || this.feishuGateway.getLastChatId();
      if (!targetChatId) {
        console.log('[IMGatewayManager] No target chat for Feishu notification');
        return;
      }

      // Build Feishu card message
      const card = this.buildFeishuNotificationCard(event, title, message, color);
      const content = JSON.stringify(card);

      // Send via Feishu gateway
      await this.feishuGateway.sendCardMessageToChat(targetChatId, content);
      console.log('[IMGatewayManager] Sent Hina notification to Feishu:', title);
    } catch (error) {
      console.error('[IMGatewayManager] Failed to send Hina notification to Feishu:', error);
    }
  }

  /**
   * Build Feishu interactive card for notification
   */
  private buildFeishuNotificationCard(
    event: HinaWebhookEvent,
    title: string,
    message: string,
    color: string
  ): Record<string, unknown> {
    const candidateName = event.candidateName || event.candidateId;
    const eventData = event.data as Record<string, unknown> | undefined;
    const candidateInfo = eventData?.candidateInfo as Record<string, unknown> | undefined;
    const resultOverView = eventData?.resultOverView as Record<string, unknown> | undefined;

    // Build fields
    const fields: Array<{ is_short: boolean; text: { tag: string; content: string } }> = [
      {
        is_short: true,
        text: { tag: 'lark_md', content: `**候选人**\n${candidateName}` },
      },
    ];

    // Add phone if available
    if (candidateInfo?.phone) {
      fields.push({
        is_short: true,
        text: { tag: 'lark_md', content: `**手机号**\n${candidateInfo.phone}` },
      });
    }

    // Add score for evaluation result
    if (event.eventType === 'evaluation_result' && resultOverView?.scoreAi !== undefined) {
      fields.push({
        is_short: true,
        text: { tag: 'lark_md', content: `**评分**\n${resultOverView.scoreAi}分` },
      });
    }

    // Add time
    fields.push({
      is_short: true,
      text: { tag: 'lark_md', content: `**时间**\n${new Date(event.timestamp).toLocaleString('zh-CN')}` },
    });

    // Build card
    const card: Record<string, unknown> = {
      config: { wide_screen_mode: true },
      header: {
        title: { tag: 'plain_text', content: title },
        template: color,
      },
      elements: [
        { tag: 'div', text: { tag: 'lark_md', content: message } },
        { tag: 'hr' },
        { tag: 'div', fields },
      ],
    };

    // Add report link for evaluation result
    if (event.eventType === 'evaluation_result' && resultOverView?.reportUrl) {
      (card.elements as Record<string, unknown>[]).push({
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '查看完整报告' },
            url: resultOverView.reportUrl,
            type: 'primary',
          },
        ],
      });
    }

    return card;
  }

  /**
   * Send notification to app (IPC to renderer)
   */
  private sendHinaNotificationToApp(
    event: HinaWebhookEvent,
    title: string,
    message: string
  ): void {
    try {
      const windows = BrowserWindow.getAllWindows();
      if (windows.length === 0) {
        console.log('[IMGatewayManager] No windows to send app notification');
        return;
      }

      const notification = {
        type: 'hina_candidate',
        title,
        message,
        event: {
          eventType: event.eventType,
          candidateId: event.candidateId,
          candidateName: event.candidateName,
          timestamp: event.timestamp,
        },
      };

      // Send to all windows
      for (const win of windows) {
        if (!win.isDestroyed()) {
          win.webContents.send('hina:notification', notification);
        }
      }

      console.log('[IMGatewayManager] Sent Hina notification to app:', title);
    } catch (error) {
      console.error('[IMGatewayManager] Failed to send app notification:', error);
    }
  }

  /**
   * Handle Hina candidate event - update status in database
   */
  private async handleHinaCandidateEvent(event: HinaWebhookEvent): Promise<void> {
    const candidateStore = getHinaCandidateStore();
    if (!candidateStore) {
      console.warn('[IMGatewayManager] HinaCandidateStore not initialized, skipping candidate status update');
      return;
    }

    const { candidateId, candidateName, eventType, interviewId, data } = event;

    // 检查候选人是否存在，不存在则创建
    let candidate = candidateStore.getCandidateById(candidateId);

    // 事件类型到状态的映射
    const statusMap: Record<string, CandidateStatus> = {
      check_in: 'check_in',
      interview_start: 'interviewing',
      interview_end: 'interviewing', // 面试结束但报告未生成，保持 interviewing 状态
      evaluation_result: 'completed',
    };

    // 事件类型到存储事件类型的映射
    const eventTypeMap: Record<string, CandidateEventType> = {
      check_in: 'check_in',
      interview_start: 'interview_start',
      interview_end: 'interview_end',
      evaluation_result: 'report_generated',
    };

    const newStatus = statusMap[eventType];
    const storeEventType = eventTypeMap[eventType];

    if (!candidate) {
      // 候选人不存在，从事件数据中提取信息并创建
      const payload = data as Record<string, unknown> | undefined;
      const callbackData = payload?.callbackData as Record<string, unknown> | undefined;
      const candidateInfo = callbackData?.candidateInfo as Record<string, unknown> | undefined;
      const interviewInfo = callbackData?.interviewInfo as Record<string, unknown> | undefined;

      // 创建新候选人（需要手机号，如果没有则使用占位符）
      const phone = (candidateInfo?.phone as string) || `unknown_${candidateId}`;
      const name = candidateName || (candidateInfo?.name as string) || '未知候选人';
      const interviewCode = (interviewInfo?.connectCode as string) || interviewId || undefined;

      candidate = candidateStore.upsertCandidate({
        outId: candidateId,
        phone,
        name,
        email: candidateInfo?.email as string | undefined,
        interviewCode,
      });

      console.log('[IMGatewayManager] Created new candidate from webhook event:', candidateId, { phone, name, interviewCode });
    }

    // 更新状态
    if (newStatus) {
      candidateStore.updateCandidateStatus(candidateId, newStatus, event.timestamp);
    }

    // 记录事件
    candidateStore.addEvent(candidateId, storeEventType, data);

    // 如果是评估结果事件，保存报告数据
    if (eventType === 'evaluation_result' && data) {
      const payload = data as Record<string, unknown>;
      const callbackData = payload.callbackData as Record<string, unknown> | undefined;

      if (!callbackData) {
        console.log('[IMGatewayManager] No callbackData in event');
        return;
      }

      const resultOverView = callbackData.resultOverView as Record<string, unknown> | undefined;
      const candidateInfo = callbackData.candidateInfo as Record<string, unknown> | undefined;
      const interviewInfo = callbackData.interviewInfo as Record<string, unknown> | undefined;
      const interviewSubmit = callbackData.interviewSubmit as Record<string, unknown> | undefined;
      const questionAnswer = callbackData.questionAnswer as Record<string, unknown> | undefined;

      // 解析面试时长字符串（如 "14分19秒"）为秒数
      const parseDuration = (durationStr: string | undefined): number | undefined => {
        if (!durationStr) return undefined;
        const match = durationStr.match(/(?:(\d+)分)?(?:(\d+)秒)?/);
        if (!match) return undefined;
        const minutes = parseInt(match[1] || '0', 10);
        const seconds = parseInt(match[2] || '0', 10);
        return minutes * 60 + seconds;
      };

      // 解析时间字符串（如 "2026-02-28 12:17:40"）为时间戳
      const parseTimeString = (timeStr: string | undefined): number | undefined => {
        if (!timeStr) return undefined;
        const ts = Date.parse(timeStr.replace(' ', 'T'));
        return isNaN(ts) ? undefined : ts;
      };

      // 提取新增字段（修正路径）
      const reportData = {
        reportUrl: resultOverView?.reportUrl as string | undefined,
        scoreAi: resultOverView?.scoreAi as number | undefined,
        auditDescAi: resultOverView?.auditDescAi as string | undefined,
        fullData: callbackData,  // 保存完整的回调数据
        // 新增字段（修正路径）
        interviewName: interviewInfo?.name as string | undefined,
        photoUrl: candidateInfo?.photoUrl as string | undefined,
        durationSeconds: parseDuration(interviewSubmit?.duration as string | undefined),
        questionCount: questionAnswer?.questionNumber as number | undefined,
        answerCount: questionAnswer?.answerNumber as number | undefined,
        beginTime: parseTimeString(resultOverView?.beginTime as string | undefined),
        loginTime: parseTimeString(resultOverView?.loginTime as string | undefined),
        submitTime: parseTimeString(interviewSubmit?.time as string | undefined),
      };

      candidateStore.saveReport(candidateId, reportData);

      console.log('[IMGatewayManager] Saved report for candidate:', candidateId, {
        score: reportData.scoreAi,
        duration: reportData.durationSeconds,
        questionCount: reportData.questionCount,
      });
    }

    console.log('[IMGatewayManager] Updated candidate status:', candidateId, '->', newStatus);
  }

  // ==================== Tunnel Service ====================

  /**
   * Get tunnel configuration
   */
  getTunnelConfig(): TunnelConfig {
    return this.imStore.getTunnelConfig();
  }

  /**
   * Set tunnel configuration
   */
  setTunnelConfig(config: Partial<TunnelConfig>): void {
    this.imStore.setTunnelConfig(config);
    this.tunnelService.updateConfig(config);
  }

  /**
   * Get tunnel status
   */
  getTunnelStatus(): TunnelStatus {
    return this.tunnelService.getStatus();
  }

  /**
   * Start tunnel for a specific port
   */
  async startTunnel(targetPort: number): Promise<string> {
    const config = this.getTunnelConfig();
    this.tunnelService.updateConfig(config);
    return await this.tunnelService.start(targetPort);
  }

  /**
   * Stop tunnel
   */
  async stopTunnel(): Promise<void> {
    await this.tunnelService.stop();
  }

  /**
   * Start tunnel for Hina Webhook
   * This is a convenience method that starts the tunnel for the Hina webhook port
   */
  async startTunnelForHina(): Promise<string> {
    const hinaStatus = this.hinaWebhook.getStatus();
    if (!hinaStatus.running || !hinaStatus.port) {
      throw new Error('Hina Webhook is not running. Please start it first.');
    }
    return await this.startTunnel(hinaStatus.port);
  }

  /**
   * Get the full public webhook URL (tunnel URL + webhook path)
   */
  getPublicWebhookUrl(): string | null {
    const tunnelStatus = this.tunnelService.getStatus();
    const hinaConfig = this.hinaWebhook.getConfig();

    if (!tunnelStatus.running || !tunnelStatus.publicUrl) {
      return null;
    }

    return `${tunnelStatus.publicUrl}${hinaConfig.path}`;
  }
}
