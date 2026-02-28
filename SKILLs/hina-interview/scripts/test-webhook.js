#!/usr/bin/env node
/**
 * 海纳 Webhook 事件解析测试
 *
 * 用于验证 webhook 处理程序能够正确解析海纳官方文档中的各种事件格式
 *
 * 测试数据基于真实回调示例（已脱敏处理）
 */

// ============================================================
// 真实回调示例（脱敏后）
// 可用于手动测试 webhook 接收端
// ============================================================

const realWorldExamples = {
  // 1. 已签到回调
  checkIn: {
    callbackData: {
      event: 'aiExamCandidateSignIn',
      outId: 'candidate_1740000000000_abc123'
    },
    callbackUrl: 'https://openapi.5kong.com/api/aes',
    companyId: 12345
  },

  // 2. 已开题回调（面试开始）
  begin: {
    callbackData: {
      event: 'aiExamCandidateBegin',
      outId: 'candidate_1740000000000_abc123'
    },
    callbackUrl: 'https://openapi.5kong.com/api/aes',
    companyId: 12345
  },

  // 3. 已交卷未出分回调（面试结束）
  end: {
    callbackData: {
      event: 'aiExamCandidateEnd',
      outId: 'candidate_1740000000000_abc123'
    },
    callbackUrl: 'https://openapi.5kong.com/api/aes',
    companyId: 12345
  },

  // 4. 已交卷已出分回调（评估结果）- 完整版
  review: {
    callbackData: {
      event: 'aiExamCandidateReview',
      candidateInfo: {
        outId: 'candidate_1740000000000_abc123',
        examId: 12345,
        connectCode: 'XXXXXXXXXXX',
        createdTime: '2026-02-28 12:00:00',
        name: '张三',
        phone: '13800138000',
        email: 'zhangsan@example.com',
        photoUrl: 'https://example.com/photo.jpg'
      },
      params: {
        '姓名': '张三',
        '手机': '13800138000'
      },
      interviewInfo: {
        name: '某公司 AI 面试',
        remark: '',
        connectCode: 'XXXXXXXXXXX'
      },
      resultOverView: {
        beginTime: '2026-02-28 12:00:00',
        loginTime: '2026-02-28 12:00:00',
        noticeStatus: 0,
        interviewStatus: 2,
        auditStatus: 3,
        costStatus: 2,
        notRecommendedClassify: '',
        passReason: '',
        refuseReason: '',
        pendingReason: '',
        scoreAi: 75,
        auditDescAi: '候选人在本次面试中表现良好，展现了较强的专业能力。',
        reportUrl: 'https://aihr.5kong.com/r/report?connectCode=xxx&tid=xxx&sid=xxx'
      },
      interviewSubmit: {
        time: '2026-02-28 12:30:00',
        duration: '30分00秒',
        type: 0,
        isAutoSubmit: false
      },
      questionAnswer: {
        questionNumber: 3,
        answerNumber: 3,
        isAnswerAll: true
      },
      questionList: [
        {
          questionId: 100001,
          desc: '请你做一个简单的自我介绍，包含个人基本信息、教育背景、工作或项目经历等。',
          descTextOnly: '请你做一个简单的自我介绍，包含个人基本信息、教育背景、工作或项目经历等。',
          type: 0,
          dimension: '',
          scoreAll: 20,
          score: 18,
          answerDesc: '您好，我叫张三，有5年的软件开发经验...',
          probe: [],
          isSubmit: 1,
          isCorrect: 1
        },
        {
          questionId: 100002,
          desc: '请描述你在项目中遇到的最大挑战是什么？你是如何解决的？',
          descTextOnly: '请描述你在项目中遇到的最大挑战是什么？你是如何解决的？',
          type: 0,
          dimension: '问题解决',
          scoreAll: 25,
          score: 20,
          answerDesc: '在之前的项目中，我们遇到了性能瓶颈...',
          probe: [
            {
              desc: '能具体说说你是如何分析这个性能问题的吗？',
              answer: '我首先通过日志分析定位到了慢查询...'
            }
          ],
          isSubmit: 1,
          isCorrect: 1
        },
        {
          questionId: 100003,
          desc: '你如何保持技术能力的持续提升？',
          descTextOnly: '你如何保持技术能力的持续提升？',
          type: 0,
          dimension: '学习能力',
          scoreAll: 15,
          score: 12,
          answerDesc: '我会定期阅读技术博客、参加技术会议...',
          probe: [],
          isSubmit: 1,
          isCorrect: 1
        }
      ],
      identity: {
        detectFace: 1,
        idTwoElementVeri: 1
      },
      preventCheat: {
        subCheck: 0,
        isSingleFaceCheck: 1,
        isHaveFaceCheck: 1
      },
      screenshot: {
        status: 0,
        number: 0
      },
      switchScreen: {
        status: 0,
        number: 0
      },
      backGroundCheck: {
        socialRisk: 0,
        financeRisk: 0,
        realNameMobile: 1,
        dishonestStatus: 0,
        travelBanStatus: 0,
        litArbStatus: 0,
        luxBanStatus: 0
      },
      assessTool: {
        identityColor: 0
      },
      handCheck: {
        complete: 0,
        flexible: 0,
        tattooScar: 0
      },
      psychometrics: {
        dvfPsy: {
          result: 0,
          isSubmit: false
        },
        bgfCore: {
          resultList: null,
          isSubmit: false
        },
        discPsy: {
          result: '',
          resultDesc: '',
          isSubmit: false
        },
        dvfPsyLit: {
          result: 0,
          isSubmit: false
        }
      },
      careerMotivation: null,
      dimensionList: [
        {
          name: '问题解决',
          scoreAll: 25,
          score: 20,
          auditDescAI: '候选人在问题解决维度表现良好，能够清晰地描述问题背景、分析过程和解决方案。'
        },
        {
          name: '学习能力',
          scoreAll: 15,
          score: 12,
          auditDescAI: '候选人展现了较好的学习意识，有明确的学习计划和方法。'
        }
      ],
      tags: null
    },
    callbackUrl: 'https://openapi.5kong.com/api/aes',
    companyId: 12345
  }
};

// 打印真实回调示例（用于手动测试）
function printRealWorldExamples() {
  console.log('\n📋 真实回调示例（脱敏后）\n');
  console.log('='.repeat(80));

  console.log('\n1️⃣  已签到回调 (aiExamCandidateSignIn):');
  console.log('-'.repeat(80));
  console.log(JSON.stringify(realWorldExamples.checkIn, null, 2));

  console.log('\n2️⃣  已开题回调 (aiExamCandidateBegin):');
  console.log('-'.repeat(80));
  console.log(JSON.stringify(realWorldExamples.begin, null, 2));

  console.log('\n3️⃣  已交卷未出分回调 (aiExamCandidateEnd):');
  console.log('-'.repeat(80));
  console.log(JSON.stringify(realWorldExamples.end, null, 2));

  console.log('\n4️⃣  已交卷已出分回调 (aiExamCandidateReview):');
  console.log('-'.repeat(80));
  console.log(JSON.stringify(realWorldExamples.review, null, 2));

  console.log('\n' + '='.repeat(80));
  console.log('\n💡 提示: 可使用以下命令测试 webhook 接收:');
  console.log('   curl -X POST http://localhost:8924/webhook/hina \\');
  console.log('     -H "Content-Type: application/json" \\');
  console.log('     -d \'{"event":"aiExamCandidateSignIn","outId":"test_123"}\'\n');
}

// 测试用例：符合海纳官方文档的事件格式
const testCases = [
  {
    name: '签到事件 - 真实回调格式',
    payload: realWorldExamples.checkIn,
    expected: {
      eventType: 'check_in',
      candidateId: 'candidate_1740000000000_abc123'
    }
  },
  {
    name: '面试开始事件 - 真实回调格式',
    payload: realWorldExamples.begin,
    expected: {
      eventType: 'interview_start',
      candidateId: 'candidate_1740000000000_abc123'
    }
  },
  {
    name: '面试结束事件 - 真实回调格式',
    payload: realWorldExamples.end,
    expected: {
      eventType: 'interview_end',
      candidateId: 'candidate_1740000000000_abc123'
    }
  },
  {
    name: '评估结果事件 - 真实回调格式（完整版）',
    payload: realWorldExamples.review,
    expected: {
      eventType: 'evaluation_result',
      candidateId: 'candidate_1740000000000_abc123',
      candidateName: '张三',
      interviewId: 'XXXXXXXXXXX'
    }
  },
  {
    name: '评估结果事件 - 简化格式（无 callbackData 包装）',
    payload: {
      event: 'aiExamCandidateReview',
      candidateInfo: {
        outId: 'candidate_test001',
        name: '李四',
        phone: '13900139000'
      },
      interviewInfo: {
        name: '前端开发-AI面试',
        connectCode: 'TESTCODE123'
      },
      resultOverView: {
        scoreAi: 85,
        auditDescAi: '表现优秀'
      }
    },
    expected: {
      eventType: 'evaluation_result',
      candidateId: 'candidate_test001',
      candidateName: '李四',
      interviewId: 'TESTCODE123'
    }
  }
];

// 简化的事件解析逻辑（与 hinaWebhookHandler.ts 保持一致）
function parseEvent(payload) {
  // 事件数据在 callbackData 中
  const data = payload.callbackData || payload;

  const event = data.event;
  if (!event) {
    return null;
  }

  // 提取候选人和面试信息（aiExamCandidateReview 事件有这些字段）
  const candidateInfo = data.candidateInfo;
  const interviewInfo = data.interviewInfo;

  // 提取候选人 ID：
  // - 简单事件（签到/开始/结束）：outId 在 data 根级别
  // - 评估结果事件：outId 在 candidateInfo 中
  const candidateId = data.outId || candidateInfo?.outId || '';

  const candidateName = candidateInfo?.name;
  const interviewCode = interviewInfo?.connectCode || '';

  // 映射事件类型
  let mappedEventType;
  switch (event) {
    case 'aiExamCandidateSignIn':
      mappedEventType = 'check_in';
      break;
    case 'aiExamCandidateBegin':
      mappedEventType = 'interview_start';
      break;
    case 'aiExamCandidateEnd':
      mappedEventType = 'interview_end';
      break;
    case 'aiExamCandidateReview':
      mappedEventType = 'evaluation_result';
      break;
    default:
      return null;
  }

  return {
    eventType: mappedEventType,
    interviewId: interviewCode,
    candidateId,
    candidateName,
    timestamp: Date.now(),
    data: payload
  };
}

// 运行测试
const args = process.argv.slice(2);

// 如果传入 --examples 参数，只打印真实示例
if (args.includes('--examples') || args.includes('-e')) {
  printRealWorldExamples();
  process.exit(0);
}

console.log('🧪 海纳 Webhook 事件解析测试\n');
console.log('=' .repeat(80));

let passCount = 0;
let failCount = 0;

testCases.forEach((testCase, index) => {
  console.log(`\n测试 ${index + 1}: ${testCase.name}`);
  console.log('-'.repeat(80));

  const result = parseEvent(testCase.payload);

  if (!result) {
    console.log('❌ 解析失败：返回 null');
    failCount++;
    return;
  }

  let passed = true;
  const errors = [];

  // 检查事件类型
  if (result.eventType !== testCase.expected.eventType) {
    errors.push(`事件类型不匹配: 期望 "${testCase.expected.eventType}", 实际 "${result.eventType}"`);
    passed = false;
  }

  // 检查候选人ID
  if (testCase.expected.candidateId && result.candidateId !== testCase.expected.candidateId) {
    errors.push(`候选人ID不匹配: 期望 "${testCase.expected.candidateId}", 实际 "${result.candidateId}"`);
    passed = false;
  }

  // 检查候选人姓名
  if (testCase.expected.candidateName && result.candidateName !== testCase.expected.candidateName) {
    errors.push(`候选人姓名不匹配: 期望 "${testCase.expected.candidateName}", 实际 "${result.candidateName}"`);
    passed = false;
  }

  // 检查面试ID
  if (testCase.expected.interviewId && result.interviewId !== testCase.expected.interviewId) {
    errors.push(`面试ID不匹配: 期望 "${testCase.expected.interviewId}", 实际 "${result.interviewId}"`);
    passed = false;
  }

  if (passed) {
    console.log('✅ 通过');
    console.log('解析结果:', JSON.stringify({
      eventType: result.eventType,
      candidateId: result.candidateId,
      candidateName: result.candidateName,
      interviewId: result.interviewId
    }, null, 2));
    passCount++;
  } else {
    console.log('❌ 失败');
    errors.forEach(err => console.log('   -', err));
    failCount++;
  }
});

console.log('\n' + '='.repeat(80));
console.log(`\n测试结果: ${passCount}/${testCases.length} 通过, ${failCount} 失败\n`);

if (failCount === 0) {
  console.log('🎉 所有测试通过！');
  process.exit(0);
} else {
  console.log('⚠️  部分测试失败，请检查代码');
  process.exit(1);
}
