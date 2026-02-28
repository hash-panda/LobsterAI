/**
 * Hina AI Interview Skill Configuration Component
 * Configuration UI for Hina API credentials and Webhook settings
 */

import React, { useState, useEffect } from 'react';
import { i18nService } from '../../services/i18n';
import { imService } from '../../services/im';
import { EnvelopeIcon, CheckCircleIcon, XCircleIcon, LinkIcon, CloudIcon } from '@heroicons/react/24/outline';

interface HinaConfig {
  appKey: string;
  appSecret: string;
  baseUrl: string;
  webhookEnabled: boolean;
}

interface HinaWebhookStatus {
  running: boolean;
  port: number | null;
  url: string | null;
  lastEventTime: number | null;
  totalEvents: number;
}

interface TunnelConfig {
  enabled: boolean;
  provider: string;
  ngrokAuthToken?: string;
  ngrokPath?: string;
  region?: string;
}

interface TunnelStatus {
  running: boolean;
  publicUrl: string | null;
  localUrl: string | null;
  provider: string;
  error: string | null;
  startedAt: number | null;
}

const HinaSkillConfig: React.FC = () => {
  const [language, setLanguage] = useState<'zh' | 'en'>(i18nService.getLanguage());
  const [showSecret, setShowSecret] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<HinaConfig>({
    appKey: '',
    appSecret: '',
    baseUrl: 'https://openapi.5kong.com',
    webhookEnabled: false,
  });
  const [webhookStatus, setWebhookStatus] = useState<HinaWebhookStatus | null>(null);
  const [tunnelConfig, setTunnelConfig] = useState<TunnelConfig>({
    enabled: false,
    provider: 'ngrok',
  });
  const [tunnelStatus, setTunnelStatus] = useState<TunnelStatus | null>(null);
  const [tunnelLoading, setTunnelLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = i18nService.subscribe(() => {
      setLanguage(i18nService.getLanguage());
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    loadConfig();
    loadWebhookStatus();
    loadTunnelConfig();
    loadTunnelStatus();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const result = await imService.getHinaConfig();
      if (result) {
        setConfig(result);
      }
    } catch (error) {
      console.error('Failed to load Hina config:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadWebhookStatus = async () => {
    try {
      const result = await imService.getHinaWebhookStatus();
      if (result) {
        setWebhookStatus(result);
      }
    } catch (error) {
      console.error('Failed to load Hina webhook status:', error);
    }
  };

  const loadTunnelConfig = async () => {
    try {
      const result = await imService.getTunnelConfig();
      if (result) {
        setTunnelConfig(result as TunnelConfig);
      }
    } catch (error) {
      console.error('Failed to load tunnel config:', error);
    }
  };

  const loadTunnelStatus = async () => {
    try {
      const result = await imService.getTunnelStatus();
      if (result) {
        setTunnelStatus(result);
      }
    } catch (error) {
      console.error('Failed to load tunnel status:', error);
    }
  };

  const handleTunnelConfigChange = async (changes: Partial<TunnelConfig>) => {
    const newConfig = { ...tunnelConfig, ...changes };
    setTunnelConfig(newConfig);

    setSaving(true);
    try {
      await imService.setTunnelConfig(changes);
    } catch (error) {
      console.error('Failed to save tunnel config:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleStartTunnel = async () => {
    if (!webhookStatus?.running) {
      alert('请先启用并启动 Webhook 服务器');
      return;
    }

    setTunnelLoading(true);
    try {
      console.log('[UI] Starting tunnel for Hina...');
      const result = await imService.startTunnelForHina();
      console.log('[UI] Tunnel result:', result);
      if (result.success && result.publicUrl) {
        await loadTunnelStatus();
      } else {
        // 显示详细错误信息
        const errorMsg = result.error || '未知错误';
        console.error('[UI] Tunnel failed:', errorMsg);
        setTunnelStatus({
          running: false,
          publicUrl: null,
          localUrl: null,
          provider: tunnelConfig.provider,
          error: errorMsg,
          startedAt: null,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '启动隧道失败';
      console.error('[UI] Tunnel exception:', message);
      setTunnelStatus({
        running: false,
        publicUrl: null,
        localUrl: null,
        provider: tunnelConfig.provider,
        error: message,
        startedAt: null,
      });
    } finally {
      setTunnelLoading(false);
    }
  };

  const handleStopTunnel = async () => {
    setTunnelLoading(true);
    try {
      await imService.stopTunnel();
      await loadTunnelStatus();
    } catch (error) {
      console.error('Failed to stop tunnel:', error);
    } finally {
      setTunnelLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleConfigChange = async (changes: Partial<HinaConfig>) => {
    const newConfig = { ...config, ...changes };
    setConfig(newConfig);

    setSaving(true);
    try {
      await imService.setHinaConfig(changes);
      // Reload webhook status if webhookEnabled changed
      if (changes.webhookEnabled !== undefined) {
        setTimeout(() => {
          loadWebhookStatus();
        }, 500);
      }
    } catch (error) {
      console.error('Failed to save Hina config:', error);
    } finally {
      setSaving(false);
    }
  };

  const t = (key: string) => i18nService.t(key);

  if (loading) {
    return (
      <div className="p-4 text-sm text-gray-600 dark:text-gray-400">
        {t('loading')}...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
          <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t('hinaConfig')}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            配置海纳 AI 面试系统 API 凭证，实现面试创建、邀请候选人、获取报告等功能
          </p>
        </div>
      </div>

      {saving && (
        <div className="text-xs text-blue-600 dark:text-blue-400">
          {t('saving')}...
        </div>
      )}

      {/* API Configuration */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <EnvelopeIcon className="w-4 h-4" />
          API 凭证配置
        </h4>

        <div className="grid grid-cols-1 gap-4">
          {/* App Key */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('hinaAppKey')}
            </label>
            <input
              type="text"
              value={config.appKey}
              onChange={(e) => handleConfigChange({ appKey: e.target.value })}
              placeholder="输入海纳租户的 App Key"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              从海纳 CSM 获取的租户 App Key
            </p>
          </div>

          {/* App Secret */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('hinaAppSecret')}
            </label>
            <div className="relative">
              <input
                type={showSecret ? 'text' : 'password'}
                value={config.appSecret}
                onChange={(e) => handleConfigChange({ appSecret: e.target.value })}
                placeholder="输入海纳租户的 App Secret"
                className="w-full px-3 py-2 pr-16 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                {showSecret ? '隐藏' : '显示'}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              从海纳 CSM 获取的租户 App Secret，请妥善保管
            </p>
          </div>

          {/* Base URL / Environment Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('hinaBaseUrl')}
            </label>
            <div className="space-y-2">
              {/* Quick Environment Buttons */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleConfigChange({ baseUrl: 'https://openapi.5kong.com' })}
                  className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                    config.baseUrl === 'https://openapi.5kong.com'
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                >
                  {t('hinaEnvProduction')}
                </button>
                <button
                  type="button"
                  onClick={() => handleConfigChange({ baseUrl: 'https://openapi.5kong.com' })}
                  className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                    config.baseUrl === 'https://openapi.5kong.com'
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                >
                  {t('hinaEnvTest')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (config.baseUrl !== 'https://openapi.5kong.com' && config.baseUrl !== 'https://openapi.5kong.com') {
                      // Already custom, do nothing
                    } else {
                      handleConfigChange({ baseUrl: '' });
                    }
                  }}
                  className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                    config.baseUrl !== 'https://openapi.5kong.com' && config.baseUrl !== 'https://openapi.5kong.com'
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                >
                  {t('hinaEnvCustom')}
                </button>
              </div>

              {/* Custom URL Input */}
              {config.baseUrl !== 'https://openapi.5kong.com' && config.baseUrl !== 'https://openapi.5kong.com' && (
                <input
                  type="text"
                  value={config.baseUrl}
                  onChange={(e) => handleConfigChange({ baseUrl: e.target.value })}
                  placeholder="https://your-custom-domain.com"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                />
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              生产环境: https://openapi.5kong.com | 测试环境: https://openapi.5kong.com
            </p>
          </div>
        </div>
      </div>

      {/* Webhook Configuration */}
      <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <LinkIcon className="w-4 h-4" />
          {t('hinaWebhook')}
        </h4>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {t('hinaWebhookEnabled')}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              接收候选人签到、面试开始/结束、评估结果等事件通知
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={config.webhookEnabled}
              onChange={(e) => handleConfigChange({ webhookEnabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {/* Webhook Status */}
        {webhookStatus && (
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-3">
            <div className="flex items-center gap-2">
              {webhookStatus.running ? (
                <>
                  <CheckCircleIcon className="w-5 h-5 text-green-500" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-400">
                    {t('hinaWebhookRunning')}
                  </span>
                </>
              ) : (
                <>
                  <XCircleIcon className="w-5 h-5 text-gray-400" />
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    {t('hinaWebhookStopped')}
                  </span>
                </>
              )}
            </div>

            {webhookStatus.running && webhookStatus.url && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">回调地址:</span>
                  <code className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">
                    {webhookStatus.url}
                  </code>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">端口:</span>
                  <span className="text-xs text-gray-700 dark:text-gray-300">
                    {webhookStatus.port}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">已处理事件:</span>
                  <span className="text-xs text-gray-700 dark:text-gray-300">
                    {webhookStatus.totalEvents} 个
                  </span>
                </div>
              </div>
            )}

            <p className="text-xs text-amber-600 dark:text-amber-400">
              提示: 如需接收海纳的回调，请确保此地址可从公网访问。
              可使用内网穿透工具（如 ngrok）将本地端口映射到公网。
            </p>
          </div>
        )}
      </div>

      {/* Tunnel Configuration */}
      <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <CloudIcon className="w-4 h-4" />
          内网穿透配置
        </h4>

        <p className="text-xs text-gray-500 dark:text-gray-400">
          使用 ngrok 等工具将本地 Webhook 端口映射到公网，使海纳系统能够回调到本地服务。
        </p>

        {/* Provider Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            穿透工具
          </label>
          <select
            value={tunnelConfig.provider}
            onChange={(e) => handleTunnelConfigChange({ provider: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
          >
            <option value="ngrok">ngrok</option>
            <option value="cloudflare" disabled>Cloudflare Tunnel (即将支持)</option>
            <option value="localtunnel" disabled>localtunnel (即将支持)</option>
          </select>
        </div>

        {/* ngrok Auth Token (optional) */}
        {tunnelConfig.provider === 'ngrok' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              ngrok Auth Token <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={tunnelConfig.ngrokAuthToken || ''}
              onChange={(e) => handleTunnelConfigChange({ ngrokAuthToken: e.target.value })}
              placeholder="从 ngrok 控制台获取"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              ngrok 需要注册账号才能使用。{' '}
              <a
                href="https://dashboard.ngrok.com/get-started/your-authtoken"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                获取 Auth Token →
              </a>
            </p>
          </div>
        )}

        {/* Tunnel Control */}
        <div className="flex items-center gap-3">
          {tunnelStatus?.running ? (
            <button
              onClick={handleStopTunnel}
              disabled={tunnelLoading}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-sm font-medium rounded-md transition-colors"
            >
              {tunnelLoading ? '停止中...' : '停止隧道'}
            </button>
          ) : (
            <button
              onClick={handleStartTunnel}
              disabled={tunnelLoading || !webhookStatus?.running}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-md transition-colors"
            >
              {tunnelLoading ? '启动中...' : '启动隧道'}
            </button>
          )}

          {!webhookStatus?.running && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              请先启用 Webhook
            </span>
          )}
        </div>

        {/* Tunnel Status */}
        {tunnelStatus && (
          <div className={`p-4 rounded-lg ${tunnelStatus.running ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-gray-800'}`}>
            <div className="flex items-center gap-2 mb-3">
              {tunnelStatus.running ? (
                <>
                  <CheckCircleIcon className="w-5 h-5 text-green-500" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-400">
                    隧道运行中
                  </span>
                </>
              ) : (
                <>
                  <XCircleIcon className="w-5 h-5 text-gray-400" />
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    隧道未启动
                  </span>
                </>
              )}
            </div>

            {tunnelStatus.running && tunnelStatus.publicUrl && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">公网地址:</span>
                  <code className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded flex-1 overflow-hidden text-ellipsis">
                    {tunnelStatus.publicUrl}/webhook/hina
                  </code>
                  <button
                    onClick={() => copyToClipboard(`${tunnelStatus.publicUrl}/webhook/hina`)}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
                  >
                    复制
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">本地地址:</span>
                  <span className="text-xs text-gray-700 dark:text-gray-300">
                    {tunnelStatus.localUrl}
                  </span>
                </div>
                {tunnelStatus.startedAt && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">启动时间:</span>
                    <span className="text-xs text-gray-700 dark:text-gray-300">
                      {new Date(tunnelStatus.startedAt).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            )}

            {tunnelStatus.error && (
              <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-800">
                <p className="text-sm font-medium text-red-700 dark:text-red-400">
                  启动失败
                </p>
                <p className="text-xs text-red-600 dark:text-red-300 mt-1 whitespace-pre-wrap">
                  {tunnelStatus.error}
                </p>
                {tunnelStatus.error.includes('authentication failed') && (
                  <p className="text-xs text-red-600 dark:text-red-300 mt-2">
                    请在上方输入 ngrok Auth Token 后重试。如果没有账号，请先{' '}
                    <a
                      href="https://dashboard.ngrok.com/signup"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline font-medium"
                    >
                      注册 ngrok 账号
                    </a>
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ngrok Installation Hint */}
        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
          <p className="text-xs text-amber-700 dark:text-amber-300">
            <strong>前提条件:</strong> 请确保已安装 ngrok 并添加到系统 PATH。
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
            安装: <code className="bg-amber-100 dark:bg-amber-800 px-1 rounded">brew install ngrok</code> (macOS)
            或从 <a href="https://ngrok.com/download" target="_blank" rel="noopener noreferrer" className="underline">ngrok.com</a> 下载
          </p>
        </div>
      </div>

      {/* Usage Guide */}
      <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          使用说明
        </h4>
        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
          <p>1. 从海纳 CSM 获取租户的 App Key 和 App Secret</p>
          <p>2. 选择 API 环境（生产/测试）或输入自定义地址</p>
          <p>3. 启用 Webhook 以接收面试状态回调（可选）</p>
          <p>4. 在飞书/钉钉等 IM 中发送消息即可使用海纳面试功能</p>
        </div>

        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            示例: 在飞书中发送 "帮我创建一个前端开发的 AI 面试"
          </p>
        </div>
      </div>
    </div>
  );
};

export default HinaSkillConfig;
