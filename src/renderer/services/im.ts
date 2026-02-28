/**
 * IM Service
 * IPC wrapper for IM gateway operations
 */

import { store } from '../store';
import {
  setConfig,
  setStatus,
  setLoading,
  setError,
} from '../store/slices/imSlice';
import type {
  IMGatewayConfig,
  IMGatewayStatus,
  IMPlatform,
  IMConfigResult,
  IMStatusResult,
  IMGatewayResult,
  IMConnectivityTestResult,
  IMConnectivityTestResponse,
} from '../types/im';

class IMService {
  private statusUnsubscribe: (() => void) | null = null;
  private messageUnsubscribe: (() => void) | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize IM service (with concurrency guard to prevent duplicate init)
   */
  async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this._doInit();
    return this.initPromise;
  }

  private async _doInit(): Promise<void> {
    // Set up status change listener
    this.statusUnsubscribe = window.electron.im.onStatusChange((status: IMGatewayStatus) => {
      store.dispatch(setStatus(status));
    });

    // Set up message listener (for logging/monitoring)
    this.messageUnsubscribe = window.electron.im.onMessageReceived((message) => {
      console.log('[IM Service] Message received:', message);
    });

    // Load initial config and status
    await this.loadConfig();
    await this.loadStatus();
  }

  /**
   * Clean up listeners
   */
  destroy(): void {
    if (this.statusUnsubscribe) {
      this.statusUnsubscribe();
      this.statusUnsubscribe = null;
    }
    if (this.messageUnsubscribe) {
      this.messageUnsubscribe();
      this.messageUnsubscribe = null;
    }
    this.initPromise = null;
  }

  /**
   * Load configuration from main process
   */
  async loadConfig(): Promise<IMGatewayConfig | null> {
    try {
      store.dispatch(setLoading(true));
      const result: IMConfigResult = await window.electron.im.getConfig();
      if (result.success && result.config) {
        store.dispatch(setConfig(result.config));
        return result.config;
      } else {
        store.dispatch(setError(result.error || 'Failed to load IM config'));
        return null;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load IM config';
      store.dispatch(setError(message));
      return null;
    } finally {
      store.dispatch(setLoading(false));
    }
  }

  /**
   * Load status from main process
   */
  async loadStatus(): Promise<IMGatewayStatus | null> {
    try {
      const result: IMStatusResult = await window.electron.im.getStatus();
      if (result.success && result.status) {
        store.dispatch(setStatus(result.status));
        return result.status;
      }
      return null;
    } catch (error) {
      console.error('[IM Service] Failed to load status:', error);
      return null;
    }
  }

  /**
   * Update configuration
   */
  async updateConfig(config: Partial<IMGatewayConfig>): Promise<boolean> {
    try {
      store.dispatch(setLoading(true));
      const result: IMGatewayResult = await window.electron.im.setConfig(config);
      if (result.success) {
        // Reload config to get merged values
        await this.loadConfig();
        return true;
      } else {
        store.dispatch(setError(result.error || 'Failed to update IM config'));
        return false;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update IM config';
      store.dispatch(setError(message));
      return false;
    } finally {
      store.dispatch(setLoading(false));
    }
  }

  /**
   * Start a gateway
   */
  async startGateway(platform: IMPlatform): Promise<boolean> {
    try {
      store.dispatch(setLoading(true));
      store.dispatch(setError(null));
      const result: IMGatewayResult = await window.electron.im.startGateway(platform);
      if (result.success) {
        await this.loadStatus();
        return true;
      } else {
        store.dispatch(setError(result.error || `Failed to start ${platform} gateway`));
        return false;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : `Failed to start ${platform} gateway`;
      store.dispatch(setError(message));
      return false;
    } finally {
      store.dispatch(setLoading(false));
    }
  }

  /**
   * Stop a gateway
   */
  async stopGateway(platform: IMPlatform): Promise<boolean> {
    try {
      store.dispatch(setLoading(true));
      const result: IMGatewayResult = await window.electron.im.stopGateway(platform);
      if (result.success) {
        await this.loadStatus();
        return true;
      } else {
        store.dispatch(setError(result.error || `Failed to stop ${platform} gateway`));
        return false;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : `Failed to stop ${platform} gateway`;
      store.dispatch(setError(message));
      return false;
    } finally {
      store.dispatch(setLoading(false));
    }
  }

  /**
   * Test gateway connectivity and conversation readiness
   */
  async testGateway(
    platform: IMPlatform,
    configOverride?: Partial<IMGatewayConfig>
  ): Promise<IMConnectivityTestResult | null> {
    try {
      store.dispatch(setLoading(true));
      const result: IMConnectivityTestResponse = await window.electron.im.testGateway(platform, configOverride);
      if (result.success && result.result) {
        return result.result;
      }
      store.dispatch(setError(result.error || `Failed to test ${platform} connectivity`));
      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : `Failed to test ${platform} connectivity`;
      store.dispatch(setError(message));
      return null;
    } finally {
      store.dispatch(setLoading(false));
    }
  }

  /**
   * Get current config from store
   */
  getConfig(): IMGatewayConfig {
    return store.getState().im.config;
  }

  /**
   * Get current status from store
   */
  getStatus(): IMGatewayStatus {
    return store.getState().im.status;
  }

  /**
   * Check if any gateway is connected
   */
  isAnyConnected(): boolean {
    const status = this.getStatus();
    return status.dingtalk.connected || status.feishu.connected || status.telegram.connected || status.discord.connected || status.nim.connected;
  }

  /**
   * Get Hina configuration
   */
  async getHinaConfig(): Promise<{ appKey: string; appSecret: string; baseUrl: string; webhookEnabled: boolean } | null> {
    try {
      const result = await window.electron.im.getHinaConfig();
      if (result.success && result.config) {
        return result.config;
      }
      return null;
    } catch (error) {
      console.error('[IM Service] Failed to get Hina config:', error);
      return null;
    }
  }

  /**
   * Set Hina configuration
   */
  async setHinaConfig(config: Partial<{ appKey: string; appSecret: string; baseUrl: string; webhookEnabled: boolean }>): Promise<boolean> {
    try {
      const result = await window.electron.im.setHinaConfig(config);
      return result.success;
    } catch (error) {
      console.error('[IM Service] Failed to set Hina config:', error);
      return false;
    }
  }

  /**
   * Get Hina webhook status
   */
  async getHinaWebhookStatus(): Promise<{
    running: boolean;
    port: number | null;
    url: string | null;
    lastEventTime: number | null;
    totalEvents: number;
  } | null> {
    try {
      const result = await window.electron.im.getHinaWebhookStatus();
      if (result.success && result.status) {
        return result.status;
      }
      return null;
    } catch (error) {
      console.error('[IM Service] Failed to get Hina webhook status:', error);
      return null;
    }
  }

  // ==================== Tunnel Methods ====================

  /**
   * Get tunnel configuration
   */
  async getTunnelConfig(): Promise<{
    enabled: boolean;
    provider: string;
    ngrokAuthToken?: string;
    ngrokPath?: string;
    region?: string;
  } | null> {
    try {
      const result = await window.electron.im.getTunnelConfig();
      if (result.success && result.config) {
        return result.config;
      }
      return null;
    } catch (error) {
      console.error('[IM Service] Failed to get tunnel config:', error);
      return null;
    }
  }

  /**
   * Set tunnel configuration
   */
  async setTunnelConfig(config: Partial<{
    enabled: boolean;
    provider: string;
    ngrokAuthToken?: string;
    ngrokPath?: string;
    region?: string;
  }>): Promise<boolean> {
    try {
      const result = await window.electron.im.setTunnelConfig(config);
      return result.success;
    } catch (error) {
      console.error('[IM Service] Failed to set tunnel config:', error);
      return false;
    }
  }

  /**
   * Get tunnel status
   */
  async getTunnelStatus(): Promise<{
    running: boolean;
    publicUrl: string | null;
    localUrl: string | null;
    provider: string;
    error: string | null;
    startedAt: number | null;
  } | null> {
    try {
      const result = await window.electron.im.getTunnelStatus();
      if (result.success && result.status) {
        return result.status;
      }
      return null;
    } catch (error) {
      console.error('[IM Service] Failed to get tunnel status:', error);
      return null;
    }
  }

  /**
   * Start tunnel for a specific port
   */
  async startTunnel(targetPort: number): Promise<{ success: boolean; publicUrl?: string; error?: string }> {
    try {
      const result = await window.electron.im.startTunnel(targetPort);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start tunnel';
      console.error('[IM Service] Failed to start tunnel:', message);
      return { success: false, error: message };
    }
  }

  /**
   * Stop tunnel
   */
  async stopTunnel(): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await window.electron.im.stopTunnel();
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to stop tunnel';
      console.error('[IM Service] Failed to stop tunnel:', message);
      return { success: false, error: message };
    }
  }

  /**
   * Start tunnel for Hina webhook
   */
  async startTunnelForHina(): Promise<{ success: boolean; publicUrl?: string; error?: string }> {
    try {
      const result = await window.electron.im.startTunnelForHina();
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start tunnel for Hina';
      console.error('[IM Service] Failed to start tunnel for Hina:', message);
      return { success: false, error: message };
    }
  }

  /**
   * Get public webhook URL (tunnel URL + webhook path)
   */
  async getPublicWebhookUrl(): Promise<string | null> {
    try {
      const result = await window.electron.im.getPublicWebhookUrl();
      if (result.success && result.url) {
        return result.url;
      }
      return null;
    } catch (error) {
      console.error('[IM Service] Failed to get public webhook URL:', error);
      return null;
    }
  }
}

export const imService = new IMService();
