/**
 * 海纳 AI 面试认证模块
 *
 * 实现签名算法和请求构造（基于官方文档）
 */

const crypto = require('crypto');
const { loadConfig, validateConfig } = require('./config');

/**
 * 生成时间戳 (秒级)
 */
function getTimestamp() {
  return Math.floor(Date.now() / 1000).toString();
}

/**
 * 生成签名
 *
 * 签名算法: MD5(appKey + timestamp + appSecret)
 * 结果: 32位小写
 */
function generateSignature(appKey, timestamp, appSecret) {
  const stringToSign = appKey + timestamp + appSecret;
  return crypto.createHash('md5').update(stringToSign).digest('hex').toLowerCase();
}

/**
 * 构建带认证参数的 URL
 */
function buildAuthUrl(baseUrl, path, appKey, timestamp, sign) {
  const url = new URL(path, baseUrl);
  url.searchParams.append('timestamp', timestamp);
  url.searchParams.append('sign', sign);
  url.searchParams.append('appKey', appKey);
  return url.toString();
}

/**
 * 构建完整的请求配置
 */
function buildRequestConfig(method, path, body = null, customConfig = null) {
  const config = customConfig || loadConfig();

  // 验证配置
  const validation = validateConfig(config);
  if (!validation.valid) {
    throw new Error(`配置错误: ${validation.errors.join(', ')}`);
  }

  const timestamp = getTimestamp();
  const sign = generateSignature(config.appKey, timestamp, config.appSecret);
  const url = buildAuthUrl(config.baseUrl, path, config.appKey, timestamp, sign);

  const requestConfig = {
    url,
    method: method.toUpperCase(),
    headers: {
      'Content-Type': 'application/json; charset=utf-8'
    },
    data: body
  };

  // 调试日志
  console.log('\n[海纳 API] 请求配置:');
  console.log('  Base URL:', config.baseUrl);
  console.log('  Path:', path);
  console.log('  完整 URL:', url);
  console.log('  Method:', requestConfig.method);
  console.log('  App Key:', config.appKey);
  console.log('  Timestamp:', timestamp);
  console.log('  签名字符串:', config.appKey + timestamp + config.appSecret.substring(0, 8) + '...');
  console.log('  Sign:', sign);
  if (body) {
    console.log('  Request Body:', JSON.stringify(body, null, 2));
  }
  console.log('');

  return requestConfig;
}

module.exports = {
  getTimestamp,
  generateSignature,
  buildAuthUrl,
  buildRequestConfig,
  loadConfig,
  validateConfig
};
