#!/usr/bin/env node
/**
 * 海纳 AI 面试 - 邀请候选人
 *
 * 用法:
 *   node invite-candidate.js --interview-code <code> --name <name> --phone <phone>
 *                             [--email <email>] [--candidate-id <id>] [--position <position>]
 *
 * 参数:
 *   --interview-code   必填，面试间链接码 (interviewCode)
 *   --name             必填，候选人姓名
 *   --phone            必填，候选人手机号 (当面试间未开启强验证手机号功能时，可传任意字符)
 *   --email            可选，候选人邮箱
 *   --candidate-id     可选，候选人三方ID (outId)，不传则自动生成
 *   --position         可选，应聘职位
 *   --no-notify        可选，不发送通知消息 (默认不发送)
 *
 * 输出: JSON 格式的邀请结果
 */

const path = require('path');

process.chdir(path.join(__dirname, '..'));

const { inviteCandidate } = require('./lib/api');

// 生成唯一的候选人 ID
function generateCandidateId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `candidate_${timestamp}_${random}`;
}

async function main() {
  const args = process.argv.slice(2);
  const params = {
    candidate: {},
    setup: {
      sendMessage: false,  // 默认不发送消息
      repeat: true         // 允许重复面试
    }
  };

  // 解析参数
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    if (arg === '--interview-code' && nextArg) {
      params.interviewCode = nextArg;
      i++;
    } else if (arg === '--name' && nextArg) {
      params.candidate.name = nextArg;
      i++;
    } else if (arg === '--phone' && nextArg) {
      params.candidate.phone = nextArg;
      i++;
    } else if (arg === '--email' && nextArg) {
      params.candidate.email = nextArg;
      i++;
    } else if (arg === '--candidate-id' && nextArg) {
      params.candidate.outId = nextArg;
      i++;
    } else if (arg === '--position' && nextArg) {
      params.params = {
        key1: '应聘职位',
        value1: nextArg
      };
      i++;
    } else if (arg === '--no-notify') {
      params.setup.sendMessage = false;
    } else if (arg === '--notify') {
      params.setup.sendMessage = true;
    }
  }

  // 验证必填参数
  const missing = [];
  if (!params.interviewCode) missing.push('--interview-code');
  if (!params.candidate.name) missing.push('--name');
  if (!params.candidate.phone) missing.push('--phone');

  if (missing.length > 0) {
    console.log(JSON.stringify({
      success: false,
      error: `缺少必填参数: ${missing.join(', ')}`
    }, null, 2));
    process.exit(1);
  }

  // 如果没有提供 candidate.outId，自动生成一个
  if (!params.candidate.outId) {
    params.candidate.outId = generateCandidateId();
  }

  try {
    const result = await inviteCandidate(params);

    if (result.code === 0) {
      console.log(JSON.stringify({
        success: true,
        data: {
          outId: result.data.outId,
          interviewCode: result.data.interviewCode,
          interviewUrl: result.data.interviewUrl,
          createdTime: result.data.createdTime
        },
        message: '邀请候选人成功'
      }, null, 2));
    } else {
      console.log(JSON.stringify({
        success: false,
        code: result.code,
        message: result.message || '邀请候选人失败'
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
