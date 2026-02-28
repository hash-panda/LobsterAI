#!/usr/bin/env node
/**
 * 海纳 AI 面试 - 获取推荐面试列表
 *
 * 用法:
 *   node get-recommendations.js [--page <num>] [--page-size <num>] [--job-info <json>]
 *
 * 参数:
 *   --page       可选，页码，默认 1
 *   --page-size  可选，每页数量，默认 20
 *   --job-info   可选，岗位信息 (JSON 格式)
 *
 * 输出: JSON 格式的推荐面试列表
 *
 * 注意:
 *   - interviewCode 以 'T' 开头的是面试模板，不是真正的面试间
 *   - 返回结果会自动过滤掉模板，只返回真正的面试间
 *   - 如果没有符合条件的面试间，会提示用户先创建
 */

const path = require('path');

process.chdir(path.join(__dirname, '..'));

const { getRecommendInterviewList } = require('./lib/api');

/**
 * 检查 interviewCode 是否为模板
 * 模板的 interviewCode 以 'T' 开头
 */
function isTemplate(interviewCode) {
  return interviewCode && interviewCode.startsWith('T');
}

/**
 * 过滤掉模板，只保留真正的面试间
 */
function filterRealInterviews(list) {
  if (!Array.isArray(list)) return { real: [], templates: [] };

  const real = [];
  const templates = [];

  for (const item of list) {
    if (isTemplate(item.interviewCode)) {
      templates.push(item);
    } else {
      real.push(item);
    }
  }

  return { real, templates };
}

async function main() {
  const args = process.argv.slice(2);
  let page = 1;
  let pageSize = 20;
  const params = {
    pagination: { page, pageSize }
  };

  // 解析参数
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    if (arg === '--page' && nextArg) {
      page = parseInt(nextArg, 10) || 1;
      params.pagination.page = page;
      i++;
    } else if (arg === '--page-size' && nextArg) {
      pageSize = parseInt(nextArg, 10) || 20;
      params.pagination.pageSize = pageSize;
      i++;
    } else if (arg === '--job-info' && nextArg) {
      try {
        params.jobInfo = JSON.parse(nextArg);
      } catch (error) {
        console.error('错误: job-info 参数必须是有效的 JSON 格式');
        console.error(`解析错误: ${error.message}`);
        process.exit(1);
      }
      i++;
    }
  }

  try {
    const result = await getRecommendInterviewList(params);

    if (result.code === 0) {
      // 过滤掉模板（interviewCode 以 'T' 开头的是模板）
      const { real: realInterviews, templates } = filterRealInterviews(result.data?.list || []);

      console.log(JSON.stringify({
        success: true,
        data: {
          list: realInterviews,
          total: realInterviews.length,
          templatesFiltered: templates.length,
          pagination: result.data?.pagination
        },
        message: realInterviews.length > 0
          ? '获取推荐面试列表成功'
          : '没有找到可用的面试间（已过滤掉模板）。请先创建面试间。',
        hint: templates.length > 0
          ? `已过滤掉 ${templates.length} 个面试模板（interviewCode 以 T 开头）`
          : undefined
      }, null, 2));
    } else {
      console.log(JSON.stringify({
        success: false,
        code: result.code,
        message: result.message || '获取推荐面试列表失败'
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
