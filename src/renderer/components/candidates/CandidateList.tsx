import React from 'react';
import { hinaCandidateService, CandidateStatus, HinaCandidate, CandidateStats } from '../../services/hinaCandidate';
import { i18nService } from '../../services/i18n';
import {
  UserIcon,
  PhoneIcon,
  EnvelopeIcon,
  BriefcaseIcon,
  EllipsisVerticalIcon,
  ArrowPathIcon,
  TrashIcon,
  EyeIcon,
  CheckCircleIcon,
  ClockIcon,
  PlayIcon,
  ChatBubbleLeftRightIcon,
  XCircleIcon,
  QuestionMarkCircleIcon,
} from '@heroicons/react/24/outline';

interface CandidateListProps {
  onSelectCandidate?: (candidate: HinaCandidate) => void;
  onInviteCandidate?: () => void;
}

const statusTabs: { status?: CandidateStatus; labelKey: string }[] = [
  { status: undefined, labelKey: 'candidatesStatusAll' },
  { status: 'invited', labelKey: 'candidatesStatusInvited' },
  { status: 'check_in', labelKey: 'candidatesStatusCheckIn' },
  { status: 'interviewing', labelKey: 'candidatesStatusInterviewing' },
  { status: 'completed', labelKey: 'candidatesStatusCompleted' },
];

export const CandidateList: React.FC<CandidateListProps> = ({
  onSelectCandidate,
  onInviteCandidate,
}) => {
  const [candidates, setCandidates] = React.useState<HinaCandidate[]>([]);
  const [stats, setStats] = React.useState<CandidateStats | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [activeStatus, setActiveStatus] = React.useState<CandidateStatus | undefined>(undefined);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [menuOpenId, setMenuOpenId] = React.useState<string | null>(null);
  const menuRefs = React.useRef<Map<string, HTMLDivElement>>(new Map());

  // Load candidates
  const loadCandidates = React.useCallback(async () => {
    try {
      setLoading(true);
      const filter: { status?: CandidateStatus; name?: string; phone?: string } = {};
      if (activeStatus) {
        filter.status = activeStatus;
      }
      if (searchQuery) {
        if (/^\d+$/.test(searchQuery)) {
          filter.phone = searchQuery;
        } else {
          filter.name = searchQuery;
        }
      }
      const [listResult, statsResult] = await Promise.all([
        hinaCandidateService.listCandidates(filter),
        hinaCandidateService.getStats(),
      ]);
      setCandidates(listResult.candidates);
      setStats(statsResult);
    } catch (error) {
      console.error('Failed to load candidates:', error);
    } finally {
      setLoading(false);
    }
  }, [activeStatus, searchQuery]);

  React.useEffect(() => {
    loadCandidates();
  }, [loadCandidates]);

  // Close menu on outside click
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuOpenId) {
        const menuEl = menuRefs.current.get(menuOpenId);
        if (menuEl && !menuEl.contains(e.target as Node)) {
          setMenuOpenId(null);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpenId]);

  // Listen for notifications to refresh
  React.useEffect(() => {
    const unsubscribe = hinaCandidateService.onNotification(() => {
      loadCandidates();
    });
    return unsubscribe;
  }, [loadCandidates]);

  const handleDelete = async (candidate: HinaCandidate) => {
    console.log('[CandidateList] handleDelete called:', candidate.id);
    setMenuOpenId(null);  // 先关闭菜单

    const confirmMsg = `确定要删除候选人"${candidate.name}"吗？`;
    console.log('[CandidateList] Showing confirm dialog:', confirmMsg);

    try {
      // 使用 Electron 原生对话框
      const result = await window.electron.dialog.showMessageBox({
        type: 'warning',
        buttons: ['取消', '确定'],
        defaultId: 1,
        cancelId: 0,
        title: '确认删除',
        message: confirmMsg,
      });

      console.log('[CandidateList] Dialog result:', result);

      if (result.response === 1) {
        console.log('[CandidateList] Calling deleteCandidate...');
        await hinaCandidateService.deleteCandidate(candidate.id);
        console.log('[CandidateList] Delete successful, reloading...');
        loadCandidates();
      } else {
        console.log('[CandidateList] Delete cancelled by user');
      }
    } catch (error) {
      console.error('[CandidateList] Delete error:', error);
    }
  };

  const handleViewReport = (candidate: HinaCandidate) => {
    console.log('[CandidateList] handleViewReport called:', candidate.id, candidate.reportUrl);
    if (candidate.reportUrl) {
      window.electron.shell.openExternal(candidate.reportUrl);
    } else {
      console.warn('[CandidateList] No reportUrl for candidate:', candidate.id);
    }
    setMenuOpenId(null);
  };

  const getStatusIcon = (status: CandidateStatus) => {
    switch (status) {
      case 'pending':
        return <ClockIcon className="w-4 h-4" />;
      case 'invited':
        return <EnvelopeIcon className="w-4 h-4" />;
      case 'check_in':
        return <CheckCircleIcon className="w-4 h-4" />;
      case 'interviewing':
        return <PlayIcon className="w-4 h-4" />;
      case 'completed':
        return <ChatBubbleLeftRightIcon className="w-4 h-4" />;
      case 'cancelled':
        return <XCircleIcon className="w-4 h-4" />;
      default:
        return <UserIcon className="w-4 h-4" />;
    }
  };

  const getStatusBadgeClass = (status: CandidateStatus) => {
    const baseClasses = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium';
    const colorClasses: Record<CandidateStatus, string> = {
      pending: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
      invited: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
      check_in: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300',
      interviewing: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
      completed: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
      cancelled: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
    };
    return `${baseClasses} ${colorClasses[status] || colorClasses.pending}`;
  };

  return (
    <div className="flex flex-col h-full p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {i18nService.t('candidatesTitle')}
        </h2>
        <button
          onClick={onInviteCandidate}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <UserIcon className="w-4 h-4" />
          {i18nService.t('candidatesInvite')}
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-2 mb-4">
          <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
            <div className="text-lg font-bold text-gray-900 dark:text-white">{stats.total}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{i18nService.t('candidatesStatsTotal')}</div>
          </div>
          <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-center">
            <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{stats.invited}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{i18nService.t('candidatesStatsInvited')}</div>
          </div>
          <div className="p-2 bg-orange-50 dark:bg-orange-900/30 rounded-lg text-center">
            <div className="text-lg font-bold text-orange-600 dark:text-orange-400">{stats.interviewing}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{i18nService.t('candidatesStatsInterviewing')}</div>
          </div>
          <div className="p-2 bg-green-50 dark:bg-green-900/30 rounded-lg text-center">
            <div className="text-lg font-bold text-green-600 dark:text-green-400">{stats.completed}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{i18nService.t('candidatesStatsCompleted')}</div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={i18nService.t('candidatesSearchPlaceholder')}
            className="w-full px-3 py-2 pl-9 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-600 dark:text-white"
          />
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
        {statusTabs.map((tab) => {
          const count = tab.status === undefined
            ? stats?.total || 0
            : stats?.[tab.status as keyof CandidateStats] || 0;
          return (
            <button
              key={tab.status || 'all'}
              onClick={() => setActiveStatus(tab.status)}
              className={`px-3 py-1.5 text-sm rounded-lg whitespace-nowrap transition-colors ${
                activeStatus === tab.status
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
              }`}
            >
              {i18nService.t(tab.labelKey)} ({count})
            </button>
          );
        })}
      </div>

      {/* Candidate List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <ArrowPathIcon className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : candidates.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-500 dark:text-gray-400">
            <UserIcon className="w-12 h-12 mb-2 opacity-50" />
            <p className="text-sm">{i18nService.t('candidatesEmpty')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {candidates.map((candidate) => (
              <div
                key={candidate.id}
                onClick={() => onSelectCandidate?.(candidate)}
                className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900 dark:text-white truncate">
                        {candidate.name}
                      </span>
                      <span className={getStatusBadgeClass(candidate.status)}>
                        {getStatusIcon(candidate.status)}
                        {hinaCandidateService.getStatusLabel(candidate.status)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <PhoneIcon className="w-3.5 h-3.5" />
                        {candidate.phone}
                      </span>
                      {candidate.position && (
                        <span className="flex items-center gap-1">
                          <BriefcaseIcon className="w-3.5 h-3.5" />
                          {candidate.position}
                        </span>
                      )}
                      {candidate.scoreAi !== undefined && candidate.scoreAi !== null && (
                        <span className="flex items-center gap-1 font-medium text-green-600 dark:text-green-400">
                          {candidate.scoreAi}分
                        </span>
                      )}
                      {candidate.durationSeconds !== undefined && candidate.durationSeconds > 0 && (
                        <span className="flex items-center gap-1">
                          <ClockIcon className="w-3.5 h-3.5" />
                          {hinaCandidateService.formatDuration(candidate.durationSeconds)}
                        </span>
                      )}
                      {candidate.questionCount !== undefined && candidate.questionCount > 0 && (
                        <span className="flex items-center gap-1">
                          <QuestionMarkCircleIcon className="w-3.5 h-3.5" />
                          {candidate.answerCount || 0}/{candidate.questionCount}题
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                      {candidate.status === 'completed' && candidate.reportGeneratedAt
                        ? `${i18nService.t('candidatesReportTime')}: ${hinaCandidateService.formatTime(candidate.reportGeneratedAt)}`
                        : candidate.status === 'interviewing' && candidate.interviewStartAt
                          ? `${i18nService.t('candidatesStartTime')}: ${hinaCandidateService.formatTime(candidate.interviewStartAt)}`
                          : candidate.invitedAt
                            ? `${i18nService.t('candidatesInviteTime')}: ${hinaCandidateService.formatTime(candidate.invitedAt)}`
                            : ''}
                    </div>
                  </div>

                  {/* Actions Menu */}
                  <div
                    className="relative"
                    ref={(el) => {
                      if (el) {
                        menuRefs.current.set(candidate.id, el);
                      } else {
                        menuRefs.current.delete(candidate.id);
                      }
                    }}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log('[CandidateList] Menu button clicked for:', candidate.id);
                        setMenuOpenId(menuOpenId === candidate.id ? null : candidate.id);
                      }}
                      className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <EllipsisVerticalIcon className="w-5 h-5 text-gray-400" />
                    </button>
                    {menuOpenId === candidate.id && (
                      <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-10">
                        {candidate.reportUrl && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewReport(candidate);
                            }}
                            className="w-full px-3 py-1.5 text-sm text-left flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                          >
                            <EyeIcon className="w-4 h-4" />
                            {i18nService.t('candidatesViewReport')}
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(candidate);
                          }}
                          className="w-full px-3 py-1.5 text-sm text-left flex items-center gap-2 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
                        >
                          <TrashIcon className="w-4 h-4" />
                          {i18nService.t('candidatesDelete')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CandidateList;
