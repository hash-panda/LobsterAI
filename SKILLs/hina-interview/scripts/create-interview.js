#!/usr/bin/env node
/**
 * 海纳 AI 面试 - 创建面试间
 *
 * 用法:
 *   node create-interview.js [--out-user-id <id>] [--job-info <json>]
 *
 * 参数:
 *   --out-user-id  可选，三方系统用户id
 *   --job-info     可选，岗位信息 (JSON 格式)
 *                  如果提供，必须包含 title 字段
 *
 * 输出: JSON 格式的面试间创建页面链接
 */

const path = require('path');

// 设置模块路径
process.chdir(path.join(__dirname, '..'));

const { getCreateInterviewPage } = require('./lib/api');

async function main() {
  const args = process.argv.slice(2);
  const params = {};

  // 解析参数
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out-user-id' && args[i + 1]) {
      params.outUserId = args[i + 1];
      i++;
    } else if (args[i] === '--job-info' && args[i + 1]) {
      try {
        params.jobInfo = JSON.parse(args[i + 1]);
      } catch (error) {
        console.error('错误: job-info 参数必须是有效的 JSON 格式');
        console.error(`解析错误: ${error.message}`);
        process.exit(1);
      }
      i++;
    }
  }

  // 调试日志: 打印配置信息
  console.log('\n[海纳面试] 启动脚本 - 创建面试间');
  console.log('='.repeat(50));
  console.log('环境变量配置:');
  console.log('  HINA_APP_KEY:', process.env.HINA_APP_KEY ? `${process.env.HINA_APP_KEY.substring(0, 8)}...` : '未设置');
  console.log('  HINA_APP_SECRET:', process.env.HINA_APP_SECRET ? '已设置 (隐藏)' : '未设置');
  console.log('  HINA_BASE_URL:', process.env.HINA_BASE_URL || '未设置 (将使用默认值)');
  console.log('\n脚本参数:');
  console.log('  Out User ID:', params.outUserId || '未提供');
  console.log('  Job Info:', params.jobInfo ? JSON.stringify(params.jobInfo, null, 2) : '未提供');
  console.log('='.repeat(50));
  console.log('');

  try {
    const result = await getCreateInterviewPage(params);

    if (result.code === 0) {
      console.log(JSON.stringify({
        success: true,
        data: result.data,
        message: '获取创建面试间页面成功'
      }, null, 2));
    } else {
      console.log(JSON.stringify({
        success: false,
        code: result.code,
        message: result.message || '获取创建面试间页面失败'
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
