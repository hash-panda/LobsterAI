/**
 * Hina Candidate Service
 * Renderer process service for candidate management
 */

export type CandidateStatus =
  | 'pending'
  | 'invited'
  | 'check_in'
  | 'interviewing'
  | 'completed'
  | 'cancelled';

export interface HinaCandidate {
  id: string;
  phone: string;
  name: string;
  email?: string;
  position?: string;
  status: CandidateStatus;
  interviewCode?: string;
  interviewUrl?: string;
  reportUrl?: string;
  invitedAt?: number;
  checkInAt?: number;
  interviewStartAt?: number;
  interviewEndAt?: number;
  reportGeneratedAt?: number;
  scoreAi?: number;
  auditDescAi?: string;
  reportData?: Record<string, unknown>;
  // 新增字段
  interviewName?: string;        // 面试名称
  photoUrl?: string;             // 候选人头像
  durationSeconds?: number;      // 面试时长（秒）
  questionCount?: number;        // 题目总数
  answerCount?: number;          // 回答数量
  beginTime?: number;            // 面试开始时间（来自报告）
  loginTime?: number;            // 登录时间
  submitTime?: number;           // 提交时间
  createdAt: number;
  updatedAt: number;
}

export interface HinaCandidateEvent {
  id: string;
  candidateId: string;
  eventType: string;
  eventData?: Record<string, unknown>;
  notified: boolean;
  createdAt: number;
}

export interface CandidateFilter {
  status?: CandidateStatus;
  phone?: string;
  name?: string;
  limit?: number;
  offset?: number;
}

export interface CandidateStats {
  total: number;
  pending: number;
  invited: number;
  checkIn: number;
  interviewing: number;
  completed: number;
  cancelled: number;
}

export interface HinaNotificationConfig {
  enabled: boolean;
  feishuEnabled: boolean;
  appEnabled: boolean;
  soundEnabled: boolean;
  notifyOnCheckIn: boolean;
  notifyOnStart: boolean;
  notifyOnEnd: boolean;
  notifyOnReport: boolean;
  feishuChatId?: string;
}

export interface HinaNotification {
  type: 'hina_candidate';
  title: string;
  message: string;
  event: {
    eventType: string;
    candidateId: string;
    candidateName?: string;
    timestamp: number;
  };
}

class HinaCandidateService {
  /**
   * Get candidate list
   */
  async listCandidates(filter?: CandidateFilter): Promise<{ candidates: HinaCandidate[] }> {
    const result = await window.electron.hinaCandidates.list(filter);
    if (!result.success) {
      throw new Error(result.error || 'Failed to list candidates');
    }
    return { candidates: result.candidates };
  }

  /**
   * Get candidate by ID
   */
  async getCandidate(candidateId: string): Promise<HinaCandidate | null> {
    const result = await window.electron.hinaCandidates.get(candidateId);
    if (!result.success) {
      throw new Error(result.error || 'Failed to get candidate');
    }
    return result.candidate;
  }

  /**
   * Get candidate by phone
   */
  async getCandidateByPhone(phone: string): Promise<HinaCandidate | null> {
    const result = await window.electron.hinaCandidates.getByPhone(phone);
    if (!result.success) {
      throw new Error(result.error || 'Failed to get candidate by phone');
    }
    return result.candidate;
  }

  /**
   * Get candidate statistics
   */
  async getStats(): Promise<CandidateStats> {
    const result = await window.electron.hinaCandidates.getStats();
    if (!result.success) {
      throw new Error(result.error || 'Failed to get stats');
    }
    return result.stats;
  }

  /**
   * Get candidate events
   */
  async getEvents(candidateId: string): Promise<HinaCandidateEvent[]> {
    const result = await window.electron.hinaCandidates.getEvents(candidateId);
    if (!result.success) {
      throw new Error(result.error || 'Failed to get events');
    }
    return result.events;
  }

  /**
   * Delete candidate
   */
  async deleteCandidate(candidateId: string): Promise<void> {
    const result = await window.electron.hinaCandidates.delete(candidateId);
    if (!result.success) {
      throw new Error(result.error || 'Failed to delete candidate');
    }
  }

  /**
   * Get notification configuration
   */
  async getNotificationConfig(): Promise<HinaNotificationConfig> {
    const result = await window.electron.hinaCandidates.getNotificationConfig();
    if (!result.success) {
      throw new Error(result.error || 'Failed to get notification config');
    }
    return result.config;
  }

  /**
   * Set notification configuration
   */
  async setNotificationConfig(config: Partial<HinaNotificationConfig>): Promise<void> {
    const result = await window.electron.hinaCandidates.setNotificationConfig(config);
    if (!result.success) {
      throw new Error(result.error || 'Failed to set notification config');
    }
  }

  /**
   * Subscribe to notifications
   */
  onNotification(callback: (notification: HinaNotification) => void): () => void {
    return window.electron.hinaCandidates.onNotification(callback);
  }

  /**
   * Get status label
   */
  getStatusLabel(status: CandidateStatus): string {
    const labels: Record<CandidateStatus, string> = {
      pending: '待邀请',
      invited: '已邀请',
      check_in: '已签到',
      interviewing: '面试中',
      completed: '已完成',
      cancelled: '已取消',
    };
    return labels[status] || status;
  }

  /**
   * Get status color
   */
  getStatusColor(status: CandidateStatus): string {
    const colors: Record<CandidateStatus, string> = {
      pending: 'gray',
      invited: 'blue',
      check_in: 'cyan',
      interviewing: 'orange',
      completed: 'green',
      cancelled: 'red',
    };
    return colors[status] || 'gray';
  }

  /**
   * Format timestamp
   */
  formatTime(timestamp?: number): string {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /**
   * Format duration (seconds to human readable)
   */
  formatDuration(seconds?: number): string {
    if (!seconds) return '-';
    if (seconds < 60) return `${seconds}秒`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (minutes < 60) return `${minutes}分${secs}秒`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}小时${mins}分`;
  }
}

export const hinaCandidateService = new HinaCandidateService();
