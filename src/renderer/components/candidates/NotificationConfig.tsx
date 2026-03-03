import React from 'react';
import { hinaCandidateService, HinaNotificationConfig } from '../../services/hinaCandidate';
import { i18nService } from '../../services/i18n';
import {
  BellIcon,
  ChatBubbleLeftRightIcon,
  ComputerDesktopIcon,
  SpeakerWaveIcon,
  CheckCircleIcon,
  PlayIcon,
  StopIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';

export const NotificationConfig: React.FC = () => {
  const [config, setConfig] = React.useState<HinaNotificationConfig | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    const loadConfig = async () => {
      try {
        setLoading(true);
        const result = await hinaCandidateService.getNotificationConfig();
        setConfig(result);
      } catch (error) {
        console.error('Failed to load notification config:', error);
      } finally {
        setLoading(false);
      }
    };
    loadConfig();
  }, []);

  const updateConfig = async (updates: Partial<HinaNotificationConfig>) => {
    if (!config) return;
    try {
      setSaving(true);
      await hinaCandidateService.setNotificationConfig(updates);
      setConfig({ ...config, ...updates });
    } catch (error) {
      console.error('Failed to update config:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="text-center py-4 text-gray-500">
        {i18nService.t('candidatesNotificationConfigLoadError')}
      </div>
    );
  }

  const Toggle: React.FC<{
    enabled: boolean;
    onChange: (enabled: boolean) => void;
    disabled?: boolean;
  }> = ({ enabled, onChange, disabled }) => (
    <button
      onClick={() => onChange(!enabled)}
      disabled={disabled || saving}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
      } ${disabled || saving ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          enabled ? 'translate-x-4' : 'translate-x-0.5'
        }`}
      />
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Master Toggle */}
      <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="flex items-center gap-2">
          <BellIcon className="w-5 h-5 text-gray-500" />
          <span className="font-medium text-gray-900 dark:text-white">
            {i18nService.t('candidatesNotificationEnabled')}
          </span>
        </div>
        <Toggle
          enabled={config.enabled}
          onChange={(enabled) => updateConfig({ enabled })}
        />
      </div>

      {/* Notification Channels */}
      <div className={`space-y-3 ${!config.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {i18nService.t('candidatesNotificationChannels')}
        </h4>

        <div className="space-y-2">
          {/* Feishu */}
          <div className="flex items-center justify-between p-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="flex items-center gap-2">
              <ChatBubbleLeftRightIcon className="w-4 h-4 text-blue-500" />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {i18nService.t('candidatesNotificationFeishu')}
              </span>
            </div>
            <Toggle
              enabled={config.feishuEnabled}
              onChange={(feishuEnabled) => updateConfig({ feishuEnabled })}
            />
          </div>

          {/* App */}
          <div className="flex items-center justify-between p-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="flex items-center gap-2">
              <ComputerDesktopIcon className="w-4 h-4 text-purple-500" />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {i18nService.t('candidatesNotificationApp')}
              </span>
            </div>
            <Toggle
              enabled={config.appEnabled}
              onChange={(appEnabled) => updateConfig({ appEnabled })}
            />
          </div>

          {/* Sound */}
          <div className="flex items-center justify-between p-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="flex items-center gap-2">
              <SpeakerWaveIcon className="w-4 h-4 text-orange-500" />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {i18nService.t('candidatesNotificationSound')}
              </span>
            </div>
            <Toggle
              enabled={config.soundEnabled}
              onChange={(soundEnabled) => updateConfig({ soundEnabled })}
            />
          </div>
        </div>
      </div>

      {/* Event Notifications */}
      <div className={`space-y-3 ${!config.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {i18nService.t('candidatesNotificationEvents')}
        </h4>

        <div className="space-y-2">
          {/* Check In */}
          <div className="flex items-center justify-between p-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircleIcon className="w-4 h-4 text-cyan-500" />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {i18nService.t('candidatesNotificationOnCheckIn')}
              </span>
            </div>
            <Toggle
              enabled={config.notifyOnCheckIn}
              onChange={(notifyOnCheckIn) => updateConfig({ notifyOnCheckIn })}
            />
          </div>

          {/* Interview Start */}
          <div className="flex items-center justify-between p-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="flex items-center gap-2">
              <PlayIcon className="w-4 h-4 text-blue-500" />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {i18nService.t('candidatesNotificationOnStart')}
              </span>
            </div>
            <Toggle
              enabled={config.notifyOnStart}
              onChange={(notifyOnStart) => updateConfig({ notifyOnStart })}
            />
          </div>

          {/* Interview End */}
          <div className="flex items-center justify-between p-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="flex items-center gap-2">
              <StopIcon className="w-4 h-4 text-green-500" />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {i18nService.t('candidatesNotificationOnEnd')}
              </span>
            </div>
            <Toggle
              enabled={config.notifyOnEnd}
              onChange={(notifyOnEnd) => updateConfig({ notifyOnEnd })}
            />
          </div>

          {/* Report Generated */}
          <div className="flex items-center justify-between p-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="flex items-center gap-2">
              <DocumentTextIcon className="w-4 h-4 text-purple-500" />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {i18nService.t('candidatesNotificationOnReport')}
              </span>
            </div>
            <Toggle
              enabled={config.notifyOnReport}
              onChange={(notifyOnReport) => updateConfig({ notifyOnReport })}
            />
          </div>
        </div>
      </div>

      {/* Feishu Chat ID (Optional) */}
      <div className={`${!config.enabled || !config.feishuEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {i18nService.t('candidatesNotificationFeishuChatId')}
          <span className="text-xs text-gray-400 ml-1">
            ({i18nService.t('commonOptional')})
          </span>
        </label>
        <input
          type="text"
          value={config.feishuChatId || ''}
          onChange={(e) => updateConfig({ feishuChatId: e.target.value || undefined })}
          placeholder={i18nService.t('candidatesNotificationFeishuChatIdPlaceholder')}
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
        />
        <p className="mt-1 text-xs text-gray-400">
          {i18nService.t('candidatesNotificationFeishuChatIdHint')}
        </p>
      </div>
    </div>
  );
};

export default NotificationConfig;
