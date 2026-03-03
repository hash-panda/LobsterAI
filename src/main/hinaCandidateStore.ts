/**
 * 海纳候选人存储服务
 *
 * 管理候选人的 CRUD 操作、状态更新和事件记录
 */

import crypto from 'crypto';
import { Database } from 'sql.js';

export type CandidateStatus =
  | 'pending'      // 待邀请
  | 'invited'      // 已邀请
  | 'check_in'     // 已签到
  | 'interviewing' // 面试中
  | 'completed'    // 已完成
  | 'cancelled';   // 已取消

export type CandidateEventType =
  | 'invited'
  | 'check_in'
  | 'interview_start'
  | 'interview_end'
  | 'report_generated'
  | 'cancelled';

export interface HinaCandidate {
  id: string;                    // 候选人三方 ID (outId)
  phone: string;                 // 手机号
  name: string;
  email?: string;
  position?: string;             // 应聘职位
  status: CandidateStatus;
  interviewCode?: string;        // 面试间链接码
  interviewUrl?: string;         // 候选人面试链接
  reportUrl?: string;            // 评估报告链接
  invitedAt?: number;            // 邀请时间
  checkInAt?: number;            // 签到时间
  interviewStartAt?: number;     // 面试开始时间
  interviewEndAt?: number;       // 面试结束时间
  reportGeneratedAt?: number;    // 报告生成时间
  scoreAi?: number;              // AI 评分
  auditDescAi?: string;          // AI 评价摘要
  reportData?: Record<string, unknown>;  // 完整报告数据
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
  eventType: CandidateEventType;
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

export class HinaCandidateStore {
  private db: Database;
  private save: () => void;
  private log: (...args: unknown[]) => void = () => {};

  constructor(db: Database, saveFn: () => void) {
    this.db = db;
    this.save = saveFn;
  }

  /**
   * 设置日志函数
   */
  setLogger(logFn: (...args: unknown[]) => void): void {
    this.log = logFn;
  }

  // ==================== 候选人 CRUD ====================

  /**
   * 创建或更新候选人
   * 如果手机号已存在，则更新；否则创建新记录
   */
  upsertCandidate(data: {
    outId: string;
    phone: string;
    name: string;
    email?: string;
    position?: string;
    interviewCode?: string;
    interviewUrl?: string;
  }): HinaCandidate {
    const now = Date.now();

    // 先检查是否已存在（通过 outId 或手机号）
    const existing = this.getCandidateById(data.outId) || this.getCandidateByPhone(data.phone);

    if (existing) {
      // 更新现有记录
      this.db.run(`
        UPDATE hina_candidates SET
          phone = ?,
          name = ?,
          email = COALESCE(?, email),
          position = COALESCE(?, position),
          interview_code = COALESCE(?, interview_code),
          interview_url = COALESCE(?, interview_url),
          status = CASE
            WHEN status = 'pending' THEN 'invited'
            ELSE status
          END,
          invited_at = COALESCE(invited_at, ?),
          updated_at = ?
        WHERE id = ?
      `, [
        data.phone,
        data.name,
        data.email || null,
        data.position || null,
        data.interviewCode || null,
        data.interviewUrl || null,
        now,
        now,
        existing.id
      ]);

      this.save();
      this.log('[HinaCandidateStore] Updated candidate:', data.outId);

      return this.getCandidateById(existing.id)!;
    } else {
      // 创建新记录
      this.db.run(`
        INSERT INTO hina_candidates (
          id, phone, name, email, position, status,
          interview_code, interview_url, invited_at,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'invited', ?, ?, ?, ?, ?)
      `, [
        data.outId,
        data.phone,
        data.name,
        data.email || null,
        data.position || null,
        data.interviewCode || null,
        data.interviewUrl || null,
        now,  // invited_at
        now,  // created_at
        now   // updated_at
      ]);

      this.save();
      this.log('[HinaCandidateStore] Created candidate:', data.outId);

      return this.getCandidateById(data.outId)!;
    }
  }

  /**
   * 通过 ID 获取候选人
   */
  getCandidateById(id: string): HinaCandidate | null {
    const result = this.db.exec(
      'SELECT * FROM hina_candidates WHERE id = ?',
      [id]
    );

    if (!result[0]?.values[0]) return null;
    return this.rowToCandidate(result[0].values[0], result[0].columns);
  }

  /**
   * 通过手机号获取候选人
   */
  getCandidateByPhone(phone: string): HinaCandidate | null {
    const result = this.db.exec(
      'SELECT * FROM hina_candidates WHERE phone = ?',
      [phone]
    );

    if (!result[0]?.values[0]) return null;
    return this.rowToCandidate(result[0].values[0], result[0].columns);
  }

  /**
   * 获取候选人列表
   */
  listCandidates(filter?: CandidateFilter): HinaCandidate[] {
    let sql = 'SELECT * FROM hina_candidates';
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (filter?.status) {
      conditions.push('status = ?');
      params.push(filter.status);
    }
    if (filter?.phone) {
      conditions.push('phone LIKE ?');
      params.push(`%${filter.phone}%`);
    }
    if (filter?.name) {
      conditions.push('name LIKE ?');
      params.push(`%${filter.name}%`);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY updated_at DESC';

    if (filter?.limit) {
      sql += ' LIMIT ?';
      params.push(filter.limit);
    }
    if (filter?.offset) {
      sql += ' OFFSET ?';
      params.push(filter.offset);
    }

    const result = this.db.exec(sql, params);

    if (!result[0]) return [];

    return result[0].values.map(row =>
      this.rowToCandidate(row, result[0].columns)
    );
  }

  /**
   * 更新候选人状态
   */
  updateCandidateStatus(
    id: string,
    status: CandidateStatus,
    timestamp?: number
  ): void {
    const now = Date.now();
    const ts = timestamp || now;

    // 根据状态更新对应的时间字段
    const timeFieldMap: Record<CandidateStatus, string | null> = {
      pending: null,
      invited: 'invited_at',
      check_in: 'check_in_at',
      interviewing: 'interview_start_at',
      completed: 'report_generated_at',
      cancelled: null
    };

    const timeField = timeFieldMap[status];

    if (timeField) {
      this.db.run(`
        UPDATE hina_candidates SET
          status = ?,
          ${timeField} = ?,
          updated_at = ?
        WHERE id = ?
      `, [status, ts, now, id]);
    } else {
      this.db.run(`
        UPDATE hina_candidates SET
          status = ?,
          updated_at = ?
        WHERE id = ?
      `, [status, now, id]);
    }

    this.save();
    this.log('[HinaCandidateStore] Updated status:', id, '->', status);
  }

  /**
   * 保存候选人报告
   */
  saveReport(
    id: string,
    reportData: {
      reportUrl?: string;
      scoreAi?: number;
      auditDescAi?: string;
      fullData?: Record<string, unknown>;
      // 新增字段
      interviewName?: string;
      photoUrl?: string;
      durationSeconds?: number;
      questionCount?: number;
      answerCount?: number;
      beginTime?: number;
      loginTime?: number;
      submitTime?: number;
    }
  ): void {
    const now = Date.now();

    this.db.run(`
      UPDATE hina_candidates SET
        report_url = COALESCE(?, report_url),
        score_ai = COALESCE(?, score_ai),
        audit_desc_ai = COALESCE(?, audit_desc_ai),
        report_data = COALESCE(?, report_data),
        interview_name = COALESCE(?, interview_name),
        photo_url = COALESCE(?, photo_url),
        duration_seconds = COALESCE(?, duration_seconds),
        question_count = COALESCE(?, question_count),
        answer_count = COALESCE(?, answer_count),
        begin_time = COALESCE(?, begin_time),
        login_time = COALESCE(?, login_time),
        submit_time = COALESCE(?, submit_time),
        report_generated_at = ?,
        status = 'completed',
        updated_at = ?
      WHERE id = ?
    `, [
      reportData.reportUrl || null,
      reportData.scoreAi ?? null,
      reportData.auditDescAi || null,
      reportData.fullData ? JSON.stringify(reportData.fullData) : null,
      reportData.interviewName || null,
      reportData.photoUrl || null,
      reportData.durationSeconds ?? null,
      reportData.questionCount ?? null,
      reportData.answerCount ?? null,
      reportData.beginTime ?? null,
      reportData.loginTime ?? null,
      reportData.submitTime ?? null,
      now,
      now,
      id
    ]);

    this.save();
    this.log('[HinaCandidateStore] Saved report for candidate:', id, { score: reportData.scoreAi });
  }

  /**
   * 删除候选人
   */
  deleteCandidate(id: string): void {
    this.db.run('DELETE FROM hina_candidates WHERE id = ?', [id]);
    this.save();
    this.log('[HinaCandidateStore] Deleted candidate:', id);
  }

  /**
   * 获取候选人统计
   */
  getStats(): CandidateStats {
    const result = this.db.exec(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'invited' THEN 1 ELSE 0 END) as invited,
        SUM(CASE WHEN status = 'check_in' THEN 1 ELSE 0 END) as check_in,
        SUM(CASE WHEN status = 'interviewing' THEN 1 ELSE 0 END) as interviewing,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
      FROM hina_candidates
    `);

    const row = result[0]?.values[0];
    if (!row) {
      return { total: 0, pending: 0, invited: 0, checkIn: 0, interviewing: 0, completed: 0, cancelled: 0 };
    }

    return {
      total: row[0] as number,
      pending: row[1] as number,
      invited: row[2] as number,
      checkIn: row[3] as number,
      interviewing: row[4] as number,
      completed: row[5] as number,
      cancelled: row[6] as number
    };
  }

  // ==================== 事件管理 ====================

  /**
   * 添加候选人事件
   */
  addEvent(
    candidateId: string,
    eventType: CandidateEventType,
    eventData?: Record<string, unknown>
  ): HinaCandidateEvent {
    const id = crypto.randomUUID();
    const now = Date.now();

    this.db.run(`
      INSERT INTO hina_candidate_events (
        id, candidate_id, event_type, event_data, notified, created_at
      ) VALUES (?, ?, ?, ?, 0, ?)
    `, [
      id,
      candidateId,
      eventType,
      eventData ? JSON.stringify(eventData) : null,
      now
    ]);

    this.save();
    this.log('[HinaCandidateStore] Added event:', eventType, 'for candidate:', candidateId);

    return {
      id,
      candidateId,
      eventType,
      eventData,
      notified: false,
      createdAt: now
    };
  }

  /**
   * 获取候选人事件列表
   */
  getEvents(candidateId: string): HinaCandidateEvent[] {
    const result = this.db.exec(`
      SELECT * FROM hina_candidate_events
      WHERE candidate_id = ?
      ORDER BY created_at DESC
    `, [candidateId]);

    if (!result[0]) return [];

    return result[0].values.map(row =>
      this.rowToEvent(row, result[0].columns)
    );
  }

  /**
   * 获取最近的事件
   */
  getRecentEvents(limit: number = 20): HinaCandidateEvent[] {
    const result = this.db.exec(`
      SELECT * FROM hina_candidate_events
      ORDER BY created_at DESC
      LIMIT ?
    `, [limit]);

    if (!result[0]) return [];

    return result[0].values.map(row =>
      this.rowToEvent(row, result[0].columns)
    );
  }

  /**
   * 标记事件为已通知
   */
  markEventNotified(eventId: string): void {
    this.db.run(
      'UPDATE hina_candidate_events SET notified = 1 WHERE id = ?',
      [eventId]
    );
    this.save();
  }

  /**
   * 获取未通知的事件
   */
  getUnnotifiedEvents(): HinaCandidateEvent[] {
    const result = this.db.exec(`
      SELECT * FROM hina_candidate_events
      WHERE notified = 0
      ORDER BY created_at ASC
    `);

    if (!result[0]) return [];

    return result[0].values.map(row =>
      this.rowToEvent(row, result[0].columns)
    );
  }

  // ==================== 辅助方法 ====================

  private rowToCandidate(row: unknown[], columns: string[]): HinaCandidate {
    const colIndex = columns.reduce((acc, col, i) => {
      acc[col] = i;
      return acc;
    }, {} as Record<string, number>);

    const getValue = (col: string): unknown => row[colIndex[col]];
    const getString = (col: string): string => getValue(col) as string;
    const getNumber = (col: string): number | undefined => {
      const val = getValue(col);
      return val !== null && val !== undefined ? val as number : undefined;
    };

    let reportData: Record<string, unknown> | undefined;
    try {
      const reportDataStr = getValue('report_data') as string | null;
      if (reportDataStr) {
        reportData = JSON.parse(reportDataStr);
      }
    } catch {
      // Ignore parse errors
    }

    return {
      id: getString('id'),
      phone: getString('phone'),
      name: getString('name'),
      email: getValue('email') as string | undefined,
      position: getValue('position') as string | undefined,
      status: getString('status') as CandidateStatus,
      interviewCode: getValue('interview_code') as string | undefined,
      interviewUrl: getValue('interview_url') as string | undefined,
      reportUrl: getValue('report_url') as string | undefined,
      invitedAt: getNumber('invited_at'),
      checkInAt: getNumber('check_in_at'),
      interviewStartAt: getNumber('interview_start_at'),
      interviewEndAt: getNumber('interview_end_at'),
      reportGeneratedAt: getNumber('report_generated_at'),
      scoreAi: getNumber('score_ai'),
      auditDescAi: getValue('audit_desc_ai') as string | undefined,
      reportData,
      // 新增字段
      interviewName: getValue('interview_name') as string | undefined,
      photoUrl: getValue('photo_url') as string | undefined,
      durationSeconds: getNumber('duration_seconds'),
      questionCount: getNumber('question_count'),
      answerCount: getNumber('answer_count'),
      beginTime: getNumber('begin_time'),
      loginTime: getNumber('login_time'),
      submitTime: getNumber('submit_time'),
      createdAt: getNumber('created_at')!,
      updatedAt: getNumber('updated_at')!
    };
  }

  private rowToEvent(row: unknown[], columns: string[]): HinaCandidateEvent {
    const colIndex = columns.reduce((acc, col, i) => {
      acc[col] = i;
      return acc;
    }, {} as Record<string, number>);

    const getValue = (col: string): unknown => row[colIndex[col]];
    const getString = (col: string): string => getValue(col) as string;

    let eventData: Record<string, unknown> | undefined;
    try {
      const eventDataStr = getValue('event_data') as string | null;
      if (eventDataStr) {
        eventData = JSON.parse(eventDataStr);
      }
    } catch {
      // Ignore parse errors
    }

    return {
      id: getString('id'),
      candidateId: getString('candidate_id'),
      eventType: getString('event_type') as CandidateEventType,
      eventData,
      notified: getValue('notified') === 1,
      createdAt: getValue('created_at') as number
    };
  }
}

// 单例实例
let candidateStore: HinaCandidateStore | null = null;

export function getHinaCandidateStore(): HinaCandidateStore | null {
  return candidateStore;
}

export function initHinaCandidateStore(db: Database, saveFn: () => void): HinaCandidateStore {
  candidateStore = new HinaCandidateStore(db, saveFn);
  return candidateStore;
}
