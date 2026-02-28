#!/usr/bin/env node
/**
 * 海纳 AI 面试 - 编辑面试间
 *
 * 用法:
 *   node edit-interview.js --interview-id <id> [--callback-url <url>]
 *
 * 参数:
 *   --interview-id  必填，面试间 ID
 *   --callback-url  可选，回调 URL
 *
 * 输出: JSON 格式的编辑页面链接
 */

const path = require('path');

process.chdir(path.join(__dirname, '..'));

const { getEditInterviewPage } = require('./lib/api');

async function main() {
  const args = process.argv.slice(2);
  const params = {};

  // 解析参数
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--interview-id' && args[i + 1]) {
      params.interviewId = args[i + 1];
      i++;
    } else if (args[i] === '--callback-url' && args[i + 1]) {
      params.callbackUrl = args[i + 1];
      i++;
    }
  }

  // 验证必填参数
  if (!params.interviewId) {
    console.log(JSON.stringify({
      success: false,
      error: '缺少必填参数: --interview-id'
    }, null, 2));
    process.exit(1);
  }

  try {
    const result = await getEditInterviewPage(params.interviewId, params.callbackUrl);

    if (result.code === 0) {
      console.log(JSON.stringify({
        success: true,
        data: result.data,
        message: '获取编辑面试间页面成功'
      }, null, 2));
    } else {
      console.log(JSON.stringify({
        success: false,
        code: result.code,
        message: result.message || '获取编辑面试间页面失败'
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
