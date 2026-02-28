#!/usr/bin/env node
/**
 * 测试环境变量注入
 */

console.log('\n========== 环境变量测试 ==========');
console.log('HINA_APP_KEY:', process.env.HINA_APP_KEY || '未设置');
console.log('HINA_APP_SECRET:', process.env.HINA_APP_SECRET ? '已设置' : '未设置');
console.log('HINA_BASE_URL:', process.env.HINA_BASE_URL || '未设置');
console.log('===================================\n');

const { loadConfig, validateConfig } = require('./scripts/lib/config');

const config = loadConfig();
console.log('加载的配置:');
console.log('  appKey:', config.appKey ? `${config.appKey.substring(0, 8)}...` : '未设置');
console.log('  appSecret:', config.appSecret ? '已设置 (隐藏)' : '未设置');
console.log('  baseUrl:', config.baseUrl);

const validation = validateConfig(config);
console.log('\n配置验证:');
console.log('  是否有效:', validation.valid ? '是' : '否');
if (!validation.valid) {
  console.log('  错误:', validation.errors.join(', '));
}
