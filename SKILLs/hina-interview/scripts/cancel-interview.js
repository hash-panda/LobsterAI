#!/usr/bin/env node
/**
 * 海纳 AI 面试 - 取消面试
 *
 * 用法:
 *   node cancel-interview.js --candidate-id <outId>
 *
 * 参数:
 *   --candidate-id   必填，候选人三方 ID (outId，邀请时传入或自动生成的 ID)
 *
 * 输出: JSON 格式的取消结果
 */

const path = require('path');

process.chdir(path.join(__dirname, '..'));

const { cancelInterview } = require('./lib/api');

async function main() {
  const args = process.argv.slice(2);
  let outId = null;

  // 解析参数
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    if (arg === '--candidate-id' && nextArg) {
      outId = nextArg;
      i++;
    }
  }

  // 验证必填参数
  if (!outId) {
    console.log(JSON.stringify({
      success: false,
      error: '缺少必填参数: --candidate-id'
    }, null, 2));
    process.exit(1);
  }

  try {
    const result = await cancelInterview(outId);

    if (result.code === 0) {
      console.log(JSON.stringify({
        success: true,
        message: '取消面试成功'
      }, null, 2));
    } else {
      console.log(JSON.stringify({
        success: false,
        code: result.code,
        message: result.message || '取消面试失败'
      }, null, 2));
    }
  } catch (error) {
    console.log(JSON.stringify({
      success: false,
      error: error.message
    }, null, 2));
    process.exit(1);
  }
}

main();
