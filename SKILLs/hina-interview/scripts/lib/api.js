/**
 * 海纳 AI 面试 API 客户端
 *
 * 封装所有 API 调用（基于官方文档）
 */

const axios = require('axios');
const { buildRequestConfig } = require('./auth');

// 创建 axios 实例
const createClient = () => {
  return axios.create({
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json; charset=utf-8'
    }
  });
};

/**
 * 发送 API 请求
 */
async function sendRequest(method, path, body = null) {
  const client = createClient();
  const config = buildRequestConfig(method, path, body);

  try {
    const response = await client.request({
      url: config.url,
      method: config.method,
      headers: config.headers,
      data: config.data
    });

    // 调试日志: 响应成功
    console.log('\n[海纳 API] 响应成功:');
    console.log('  Status:', response.status);
    console.log('  Status Text:', response.statusText);
    console.log('  Response Data:', JSON.stringify(response.data, null, 2));
    console.log('');

    return response.data;
  } catch (error) {
    // 调试日志: 请求失败
    console.error('\n[海纳 API] 请求失败:');
    if (error.response) {
      // 服务器返回错误
      console.error('  Status:', error.response.status);
      console.error('  Status Text:', error.response.statusText);
      console.error('  Response Data:', JSON.stringify(error.response.data, null, 2));
      console.error('  Response Headers:', JSON.stringify(error.response.headers, null, 2));
      console.error('');
      throw new Error(`API 错误 (${error.response.status}): ${JSON.stringify(error.response.data)}`);
    } else if (error.request) {
      // 请求发送但无响应
      console.error('  错误类型: 无响应');
      console.error('  Request:', error.request);
      console.error('');
      throw new Error(`网络错误: 无法连接到海纳服务器`);
    } else {
      console.error('  错误类型: 请求配置错误');
      console.error('  Error Message:', error.message);
      console.error('');
      throw error;
    }
  }
}

/**
 * API: 获取跳转海纳创建 AI 面试间页面
 * POST /api/channel/getCreateInterviewSsoUrl
 *
 * @param {Object} params - 请求参数
 * @param {string} [params.outUserId] - 三方系统用户id（可选）
 * @param {Object} [params.jobInfo] - 职位相关信息（可选）
 * @param {string} params.jobInfo.title - 职位名称（必填）
 * @param {string} [params.jobInfo.id] - 职位id（可选）
 * @param {string} [params.jobInfo.industry] - 职位所属行业（可选）
 * @param {string} [params.jobInfo.desc] - 职位描述（可选）
 * @param {string} [params.jobInfo.type] - 职位类型（可选）
 * @param {string} [params.jobInfo.scene] - 职位场景，1：社招、2：校招（可选）
 */
async function getCreateInterviewPage(params = {}) {
  const body = {};

  // 添加 outUserId（可选）
  if (params.outUserId) {
    body.outUserId = params.outUserId;
  }

  // 添加 jobInfo（可选，但如果提供则必须包含 title）
  if (params.jobInfo) {
    if (!params.jobInfo.title) {
      throw new Error('jobInfo.title 是必填字段');
    }
    body.jobInfo = params.jobInfo;
  }

  return sendRequest('POST', '/api/channel/getCreateInterviewSsoUrl', Object.keys(body).length > 0 ? body : null);
}

/**
 * API: 获取跳转海纳编辑 AI 面试间页面
 * POST /api/channel/getEditInterviewSsoUrl
 */
async function getEditInterviewPage(interviewCode, outUserId = null) {
  const body = {
    interviewCode
  };
  if (outUserId) {
    body.outUserId = outUserId;
  }
  return sendRequest('POST', '/api/channel/getEditInterviewSsoUrl', body);
}

/**
 * API: 邀请候选人面试
 * POST /api/channel/candidateCreate
 */
async function inviteCandidate(params) {
  const body = {
    interviewCode: params.interviewCode,
    outUserId: params.outUserId || undefined,
    setup: params.setup || undefined,
    candidate: {
      outId: params.candidate.outId,
      name: params.candidate.name,
      phone: params.candidate.phone,
      email: params.candidate.email || undefined
    },
    params: params.params || undefined,
    resume: params.resume || undefined
  };

  // 移除 undefined 字段
  Object.keys(body).forEach(key => body[key] === undefined && delete body[key]);
  Object.keys(body.candidate).forEach(key => body.candidate[key] === undefined && delete body.candidate[key]);

  return sendRequest('POST', '/api/channel/candidateCreate', body);
}

/**
 * API: 取消候选人面试
 * POST /api/channel/candidateDelete
 */
async function cancelInterview(outId, outUserId = null) {
  const body = {
    outId
  };
  if (outUserId) {
    body.outUserId = outUserId;
  }
  return sendRequest('POST', '/api/channel/candidateDelete', body);
}

/**
 * API: 获取候选人面试报告
 * POST /api/channel/getCandidateReport
 */
async function getInterviewReport(outId, params = {}) {
  const body = {
    outId,
    outUserId: params.outUserId || undefined,
    setup: params.setup || undefined
  };

  // 移除 undefined 字段
  Object.keys(body).forEach(key => body[key] === undefined && delete body[key]);

  return sendRequest('POST', '/api/channel/getCandidateReport', body);
}

/**
 * API: 获取系统推荐面试列表
 * POST /api/channel/getInterviewList
 */
async function getRecommendInterviewList(params = {}) {
  const body = {
    outUserId: params.outUserId || undefined,
    jobInfo: params.jobInfo || undefined,
    features: params.features || undefined,
    pagination: params.pagination || { page: 1, pageSize: 20 }
  };

  // 移除 undefined 字段
  Object.keys(body).forEach(key => body[key] === undefined && delete body[key]);

  return sendRequest('POST', '/api/channel/getInterviewList', body);
}

module.exports = {
  sendRequest,
  getCreateInterviewPage,
  getEditInterviewPage,
  inviteCandidate,
  cancelInterview,
  getInterviewReport,
  getRecommendInterviewList
};
