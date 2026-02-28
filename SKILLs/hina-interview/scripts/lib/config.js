/**
 * 海纳 AI 面试配置模块
 *
 * 配置优先级：
 * 1. 环境变量 (HINA_APP_KEY, HINA_APP_SECRET, HINA_BASE_URL)
 * 2. .env 文件
 * 3. 配置文件 (config.json)
 */

const fs = require('fs');
const path = require('path');

// 配置文件路径
const CONFIG_FILE = path.join(__dirname, '..', 'config.json');
const ENV_FILE = path.join(__dirname, '..', '.env');

/**
 * 解析 .env 文件
 */
function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};

  const content = fs.readFileSync(filePath, 'utf-8');
  const config = {};

  content.split('\n').forEach(line => {
    line = line.trim();
    // 跳过注释和空行
    if (!line || line.startsWith('#')) return;

    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      let value = valueParts.join('=').trim();
      // 移除引号
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      config[key.trim()] = value;
    }
  });

  return config;
}

/**
 * 加载配置
 */
function loadConfig() {
  // 1. 从 .env 文件加载
  const envConfig = parseEnvFile(ENV_FILE);

  // 2. 从 config.json 加载
  let jsonConfig = {};
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      jsonConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    } catch (e) {
      // 忽略解析错误
    }
  }

  // 3. 合并配置 (环境变量 > .env > config.json)
  return {
    appKey: process.env.HINA_APP_KEY || envConfig.HINA_APP_KEY || jsonConfig.appKey || '',
    appSecret: process.env.HINA_APP_SECRET || envConfig.HINA_APP_SECRET || jsonConfig.appSecret || '',
    baseUrl: process.env.HINA_BASE_URL || envConfig.HINA_BASE_URL || jsonConfig.baseUrl || 'https://openapi.hina.com'
  };
}

/**
 * 保存配置到 config.json
 */
function saveConfig(config) {
  const currentConfig = fs.existsSync(CONFIG_FILE)
    ? JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'))
    : {};

  const newConfig = { ...currentConfig, ...config };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(newConfig, null, 2));
}

/**
 * 验证配置是否完整
 */
function validateConfig(config) {
  const errors = [];

  if (!config.appKey) {
    errors.push('缺少 appKey (HINA_APP_KEY)');
  }

  if (!config.appSecret) {
    errors.push('缺少 appSecret (HINA_APP_SECRET)');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  loadConfig,
  saveConfig,
  validateConfig,
  CONFIG_FILE,
  ENV_FILE
};
