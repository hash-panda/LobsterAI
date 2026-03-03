import React from 'react';
import { CandidateList } from './CandidateList';
import { CandidateDetail } from './CandidateDetail';
import { CandidateForm, CandidateFormData } from './CandidateForm';
import { NotificationConfig } from './NotificationConfig';
import { HinaCandidate } from '../../services/hinaCandidate';
import { i18nService } from '../../services/i18n';
import WindowTitleBar from '../window/WindowTitleBar';
import SidebarToggleIcon from '../icons/SidebarToggleIcon';
import ComposeIcon from '../icons/ComposeIcon';
import {
  UserIcon,
  BellIcon,
} from '@heroicons/react/24/outline';

type TabType = 'list' | 'settings';

interface InterviewRoom {
  interviewCode: string;
  name: string;
}

interface HinaCandidatesPageProps {
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  onNewChat?: () => void;
}

export const HinaCandidatesPage: React.FC<HinaCandidatesPageProps> = ({
  isSidebarCollapsed,
  onToggleSidebar,
  onNewChat,
}) => {
  const [activeTab, setActiveTab] = React.useState<TabType>('list');
  const [selectedCandidate, setSelectedCandidate] = React.useState<HinaCandidate | null>(null);
  const [showInviteForm, setShowInviteForm] = React.useState(false);
  const [interviewRooms, setInterviewRooms] = React.useState<InterviewRoom[]>([]);
  const [inviteLoading, setInviteLoading] = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState(0);

  // Load interview rooms for the invite form
  React.useEffect(() => {
    const loadInterviewRooms = async () => {
      try {
        // Use the hina-interview skill to get recommendations
        const result = await window.electron.shell.openExternal?.('');
        // For now, we'll just use an empty array
        // In a real implementation, you'd call the skill API
        setInterviewRooms([]);
      } catch (error) {
        console.error('Failed to load interview rooms:', error);
      }
    };
    loadInterviewRooms();
  }, []);

  const handleInvite = async (data: CandidateFormData) => {
    setInviteLoading(true);
    try {
      // Call the hina-interview skill to invite candidate
      const scriptPath = 'SKILLs/hina-interview/scripts/invite-candidate.js';
      const args = [
        '--interview-code', data.interviewCode,
        '--name', data.name,
        '--phone', data.phone,
      ];
      if (data.email) {
        args.push('--email', data.email);
      }
      if (data.position) {
        args.push('--position', data.position);
      }

      // Execute via skill manager
      const result = await window.electron.skills.executeSkill?.({
        skillId: 'hina-interview',
        action: 'invite',
        params: data,
      });

      if (result?.success) {
        // Refresh the list
        setRefreshKey((k) => k + 1);
        // Show success message
        window.dispatchEvent(new CustomEvent('app:showToast', {
          detail: i18nService.t('candidatesInviteSuccess', { name: data.name }),
        }));
      } else {
        throw new Error(result?.error || 'Failed to invite candidate');
      }
    } catch (error) {
      console.error('Failed to invite candidate:', error);
      window.dispatchEvent(new CustomEvent('app:showToast', {
        detail: i18nService.t('candidatesInviteError'),
      }));
    } finally {
      setInviteLoading(false);
    }
  };

  const isMac = window.electron.platform === 'darwin';

  return (
    <div className="flex flex-col h-full p-2">
      {/* Header */}
      <div className="draggable flex h-12 items-center justify-between px-4 border-b dark:border-claude-darkBorder border-claude-border shrink-0">
        <div className="flex items-center space-x-3 h-8">
          {isSidebarCollapsed && (
            <div className={`non-draggable flex items-center gap-1 ${isMac ? 'pl-[68px]' : ''}`}>
              <button
                type="button"
                onClick={onToggleSidebar}
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg dark:text-claude-darkTextSecondary text-claude-textSecondary hover:bg-claude-surfaceHover dark:hover:bg-claude-darkSurfaceHover transition-colors"
              >
                <SidebarToggleIcon className="h-4 w-4" isCollapsed={true} />
              </button>
              <button
                type="button"
                onClick={onNewChat}
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg dark:text-claude-darkTextSecondary text-claude-textSecondary hover:bg-claude-surfaceHover dark:hover:bg-claude-darkSurfaceHover transition-colors"
              >
                <ComposeIcon className="h-4 w-4" />
              </button>
            </div>
          )}
          <h1 className="text-lg font-semibold dark:text-claude-darkText text-claude-text">
            {i18nService.t('hinaCandidates')}
          </h1>
        </div>
        <WindowTitleBar inline />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 shrink-0">
        <button
          onClick={() => setActiveTab('list')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors relative ${
            activeTab === 'list'
              ? 'dark:text-claude-darkText text-claude-text'
              : 'dark:text-claude-darkTextSecondary text-claude-textSecondary hover:dark:text-claude-darkText hover:text-claude-text'
          }`}
        >
          <UserIcon className="w-4 h-4" />
          {i18nService.t('candidatesTabList')}
          {activeTab === 'list' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-claude-accent rounded-t" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors relative ${
            activeTab === 'settings'
              ? 'dark:text-claude-darkText text-claude-text'
              : 'dark:text-claude-darkTextSecondary text-claude-textSecondary hover:dark:text-claude-darkText hover:text-claude-text'
          }`}
        >
          <BellIcon className="w-4 h-4" />
          {i18nService.t('candidatesTabSettings')}
          {activeTab === 'settings' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-claude-accent rounded-t" />
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'list' ? (
          <CandidateList
            key={refreshKey}
            onSelectCandidate={setSelectedCandidate}
            onInviteCandidate={() => setShowInviteForm(true)}
          />
        ) : (
          <div className="h-full overflow-y-auto">
            <NotificationConfig />
          </div>
        )}
      </div>

      {/* Candidate Detail Modal */}
      {selectedCandidate && (
        <CandidateDetail
          candidate={selectedCandidate}
          onClose={() => setSelectedCandidate(null)}
        />
      )}

      {/* Invite Form Modal */}
      {showInviteForm && (
        <CandidateForm
          onClose={() => setShowInviteForm(false)}
          onSubmit={handleInvite}
          interviewCodes={interviewRooms.map(r => ({ interviewCode: r.interviewCode, name: r.name }))}
          loading={inviteLoading}
        />
      )}
    </div>
  );
};

export default HinaCandidatesPage;
