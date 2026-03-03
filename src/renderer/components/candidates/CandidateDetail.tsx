import React from 'react';
import { createPortal } from 'react-dom';
import { hinaCandidateService, HinaCandidate, HinaCandidateEvent } from '../../services/hinaCandidate';
import { i18nService } from '../../services/i18n';
import {
  XMarkIcon,
  UserIcon,
  PhoneIcon,
  EnvelopeIcon,
  BriefcaseIcon,
  ClockIcon,
  DocumentTextIcon,
  ChartBarIcon,
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  PlayIcon,
  ChatBubbleLeftRightIcon,
  QuestionMarkCircleIcon,
  CodeBracketIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline';

interface CandidateDetailProps {
  candidate: HinaCandidate;
  onClose: () => void;
}

const eventTypeLabels: Record<string, string> = {
  invited: '邀请候选人',
  check_in: '签到',
  interview_start: '面试开始',
  interview_end: '面试结束',
  report_generated: '报告生成',
};

const eventTypeIcons: Record<string, React.ReactNode> = {
  invited: <EnvelopeIcon className="w-4 h-4" />,
  check_in: <CheckCircleIcon className="w-4 h-4" />,
  interview_start: <PlayIcon className="w-4 h-4" />,
  interview_end: <ClockIcon className="w-4 h-4" />,
  report_generated: <DocumentTextIcon className="w-4 h-4" />,
};

export const CandidateDetail: React.FC<CandidateDetailProps> = ({
  candidate,
  onClose,
}) => {
  const [events, setEvents] = React.useState<HinaCandidateEvent[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [expandedEvents, setExpandedEvents] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    const loadEvents = async () => {
      try {
        setLoading(true);
        const result = await hinaCandidateService.getEvents(candidate.id);
        setEvents(result);
      } catch (error) {
        console.error('Failed to load events:', error);
      } finally {
        setLoading(false);
      }
    };
    loadEvents();
  }, [candidate.id]);

  const toggleEventExpand = (eventId: string) => {
    setExpandedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  };

  const getStatusBadgeClass = (status: string) => {
    const baseClasses = 'inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium';
    const colorClasses: Record<string, string> = {
      pending: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
      invited: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
      check_in: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300',
      interviewing: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
      completed: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
      cancelled: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
    };
    return `${baseClasses} ${colorClasses[status] || colorClasses.pending}`;
  };

  // Extract report data
  const reportData = candidate.reportData as Record<string, unknown> | undefined;
  const dimensionList = reportData?.dimensionList as Array<{ name: string; score: number; scoreAll: number; auditDescAI: string }> | undefined;
  const questionList = reportData?.questionList as Array<{ desc: string; score: number; scoreAll: number; answerDesc?: string }> | undefined;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl max-h-[90vh] bg-white dark:bg-gray-900 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              <UserIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {candidate.name}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{candidate.phone}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={getStatusBadgeClass(candidate.status)}>
              {hinaCandidateService.getStatusLabel(candidate.status as any)}
            </span>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <XMarkIcon className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <UserIcon className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600 dark:text-gray-400">{i18nService.t('candidatesDetailId')}:</span>
                <span className="text-gray-900 dark:text-white font-mono text-xs">{candidate.id}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <PhoneIcon className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600 dark:text-gray-400">{i18nService.t('candidatesDetailPhone')}:</span>
                <span className="text-gray-900 dark:text-white">{candidate.phone}</span>
              </div>
              {candidate.email && (
                <div className="flex items-center gap-2 text-sm">
                  <EnvelopeIcon className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600 dark:text-gray-400">{i18nService.t('candidatesDetailEmail')}:</span>
                  <span className="text-gray-900 dark:text-white">{candidate.email}</span>
                </div>
              )}
              {candidate.position && (
                <div className="flex items-center gap-2 text-sm">
                  <BriefcaseIcon className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600 dark:text-gray-400">{i18nService.t('candidatesDetailPosition')}:</span>
                  <span className="text-gray-900 dark:text-white">{candidate.position}</span>
                </div>
              )}
            </div>
            <div className="space-y-3">
              {candidate.interviewCode && (
                <div className="flex items-center gap-2 text-sm">
                  <ChatBubbleLeftRightIcon className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600 dark:text-gray-400">{i18nService.t('candidatesDetailInterviewCode')}:</span>
                  <span className="text-gray-900 dark:text-white font-mono">{candidate.interviewCode}</span>
                </div>
              )}
              {candidate.scoreAi !== undefined && candidate.scoreAi !== null && (
                <div className="flex items-center gap-2 text-sm">
                  <ChartBarIcon className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600 dark:text-gray-400">{i18nService.t('candidatesDetailScore')}:</span>
                  <span className="text-lg font-bold text-green-600 dark:text-green-400">{candidate.scoreAi}</span>
                  <span className="text-gray-400">分</span>
                </div>
              )}
            </div>
          </div>

          {/* Interview Info - New Fields */}
          {(candidate.interviewName || candidate.durationSeconds || candidate.questionCount || candidate.beginTime || candidate.loginTime || candidate.submitTime) && (
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                {i18nService.t('candidatesDetailInterviewInfo')}
              </h4>
              <div className="grid grid-cols-2 gap-3">
                {candidate.interviewName && (
                  <div className="flex items-center gap-2 text-sm">
                    <DocumentTextIcon className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600 dark:text-gray-400">{i18nService.t('candidatesDetailInterviewName')}:</span>
                    <span className="text-gray-900 dark:text-white">{candidate.interviewName}</span>
                  </div>
                )}
                {candidate.durationSeconds !== undefined && candidate.durationSeconds > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <ClockIcon className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600 dark:text-gray-400">{i18nService.t('candidatesDetailDuration')}:</span>
                    <span className="text-gray-900 dark:text-white">{hinaCandidateService.formatDuration(candidate.durationSeconds)}</span>
                  </div>
                )}
                {candidate.questionCount !== undefined && candidate.questionCount > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <QuestionMarkCircleIcon className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600 dark:text-gray-400">{i18nService.t('candidatesDetailQuestionsCount')}:</span>
                    <span className="text-gray-900 dark:text-white">{candidate.answerCount || 0}/{candidate.questionCount}</span>
                  </div>
                )}
                {candidate.loginTime && (
                  <div className="flex items-center gap-2 text-sm">
                    <UserIcon className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600 dark:text-gray-400">{i18nService.t('candidatesDetailLoginTime')}:</span>
                    <span className="text-gray-900 dark:text-white">{hinaCandidateService.formatTime(candidate.loginTime)}</span>
                  </div>
                )}
                {candidate.beginTime && (
                  <div className="flex items-center gap-2 text-sm">
                    <PlayIcon className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600 dark:text-gray-400">{i18nService.t('candidatesDetailBeginTime')}:</span>
                    <span className="text-gray-900 dark:text-white">{hinaCandidateService.formatTime(candidate.beginTime)}</span>
                  </div>
                )}
                {candidate.submitTime && (
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircleIcon className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600 dark:text-gray-400">{i18nService.t('candidatesDetailSubmitTime')}:</span>
                    <span className="text-gray-900 dark:text-white">{hinaCandidateService.formatTime(candidate.submitTime)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Score Card */}
          {candidate.scoreAi !== undefined && candidate.scoreAi !== null && (
            <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {i18nService.t('candidatesDetailAiScore')}
                </span>
                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {candidate.scoreAi}
                </span>
              </div>
              <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                  style={{ width: `${Math.min(candidate.scoreAi, 100)}%` }}
                />
              </div>
              {candidate.auditDescAi && (
                <p className="mt-3 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  {candidate.auditDescAi}
                </p>
              )}
            </div>
          )}

          {/* Dimensions */}
          {dimensionList && dimensionList.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                {i18nService.t('candidatesDetailDimensions')}
              </h4>
              <div className="space-y-2">
                {dimensionList.map((dim, index) => (
                  <div key={index} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {dim.name}
                      </span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {dim.score} / {dim.scoreAll}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${(dim.score / dim.scoreAll) * 100}%` }}
                      />
                    </div>
                    {dim.auditDescAI && (
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {dim.auditDescAI}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Questions */}
          {questionList && questionList.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                {i18nService.t('candidatesDetailQuestions')} ({questionList.length})
              </h4>
              <div className="space-y-2">
                {questionList.slice(0, 5).map((q, index) => (
                  <div key={index} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex items-start justify-between">
                      <p className="text-sm text-gray-900 dark:text-white flex-1">
                        {index + 1}. {q.desc}
                      </p>
                      <span className="text-sm font-medium text-blue-600 dark:text-blue-400 ml-2">
                        {q.score}/{q.scoreAll}
                      </span>
                    </div>
                  </div>
                ))}
                {questionList.length > 5 && (
                  <p className="text-xs text-gray-400 text-center">
                    {`还有 ${questionList.length - 5} 道题目...`}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              {i18nService.t('candidatesDetailTimeline')}
            </h4>
            {loading ? (
              <div className="text-center py-4 text-gray-400">
                {i18nService.t('commonLoading')}
              </div>
            ) : events.length === 0 ? (
              <div className="text-center py-4 text-gray-400">
                {i18nService.t('candidatesDetailNoEvents')}
              </div>
            ) : (
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
                <div className="space-y-3">
                  {events.map((event) => (
                    <div key={event.id} className="relative pl-10">
                      <div className="absolute left-2.5 top-1 w-3 h-3 rounded-full bg-blue-500 border-2 border-white dark:border-gray-900" />
                      <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-gray-400">
                              {eventTypeIcons[event.eventType] || <ClockIcon className="w-4 h-4" />}
                            </span>
                            <span className="font-medium text-gray-900 dark:text-white">
                              {eventTypeLabels[event.eventType] || event.eventType}
                            </span>
                            <span className="text-xs text-gray-400">
                              {hinaCandidateService.formatTime(event.createdAt)}
                            </span>
                          </div>
                          {event.eventData && (
                            <button
                              onClick={() => toggleEventExpand(event.id)}
                              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                              title={i18nService.t('candidatesDetailViewRawData')}
                            >
                              {expandedEvents.has(event.id) ? (
                                <ChevronUpIcon className="w-4 h-4" />
                              ) : (
                                <ChevronDownIcon className="w-4 h-4" />
                              )}
                            </button>
                          )}
                        </div>
                        {expandedEvents.has(event.id) && event.eventData && (
                          <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-900 rounded text-xs">
                            <div className="flex items-center gap-1 mb-1 text-gray-500 dark:text-gray-400">
                              <CodeBracketIcon className="w-3 h-3" />
                              <span>{i18nService.t('candidatesDetailRawData')}</span>
                            </div>
                            <pre className="overflow-x-auto text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-all">
                              {JSON.stringify(event.eventData, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="text-xs text-gray-400">
            {i18nService.t('candidatesDetailCreatedAt')}: {hinaCandidateService.formatTime(candidate.createdAt)}
          </div>
          <div className="flex gap-2">
            {candidate.interviewUrl && (
              <button
                onClick={() => window.electron.shell.openExternal(candidate.interviewUrl!)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                {i18nService.t('candidatesDetailInterviewUrl')}
                <ArrowTopRightOnSquareIcon className="w-4 h-4" />
              </button>
            )}
            {candidate.reportUrl && (
              <button
                onClick={() => window.electron.shell.openExternal(candidate.reportUrl!)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                {i18nService.t('candidatesDetailViewFullReport')}
                <ArrowTopRightOnSquareIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CandidateDetail;
