#!/usr/bin/env node
/**
 * 题库 txt 转小程序批量导入 JSON
 *
 * 用法：
 *   node tools/question-bank-converter/convert.js <input.txt> <output.json> [--label 2025]
 *
 * 输入格式：
 *   - 题号开头，如 `1.题干` 或 `1、题干`
 *   - 选项 `A.` / `B.` / ...（最多 A-F）
 *   - 答案行 `答案：B` 或 `正确答案：B`
 *   - 解析行可选，支持 `答案解析：内容`
 *   - 标注 `【多选题】` 或答案包含多个字母的题会跳过
 *
 * 输出：
 *   - 小程序题目管理“批量导入”使用的 JSON 数组
 *   - 字段：question、options、answerIndex、explanation、difficulty、tags、isActive
 *
 * 注意：
 *   - 不写数据库，不生成 questionId / normalizedQuestion / bankIds / 时间戳
 *   - 网页控制台直接导入需要另行补全字段并转 JSON Lines
 */

const fs = require('fs');
const path = require('path');

const TAG_RULES = [
  { tag: '刷单返利', words: ['刷单', '返利', '垫付', '佣金', '刷流水', '任务'] },
  { tag: '兼职诈骗', words: ['兼职', '打字员', '入职押金', '招聘', '面试', '工资'] },
  { tag: '招嫖诈骗', words: ['招嫖', '嫖资', '特殊服务'] },
  { tag: '冒充客服', words: ['客服', '退款', '订单', '淘宝', '抖音', '百万医疗', '理赔', '售后'] },
  { tag: '冒充公检法', words: ['公检法', '公安', '检察院', '法院', '洗钱', '安全账户', '逮捕令', '涉案'] },
  { tag: '投资理财', words: ['投资', '理财', '收益', '虚拟货币', '杀猪盘', '高回报', '股票', '基金', '盈利'] },
  { tag: '贷款诈骗', words: ['贷款', '征信', '放款', '解冻费', '工本费', '保证金', '提额'] },
  { tag: '校园诈骗', words: ['学校', '校园', '学费', '学籍', '助学贷款', '校园贷', '辅导员', '教务处', '教育补贴', '教辅', '班主任', '教育机构', '辅导班', '教材', '校园卡'] },
  { tag: '快递理赔', words: ['快递', '包裹', '理赔', '赔偿', '快递丢失'] },
  { tag: '游戏交易', words: ['游戏', '代练', '账号交易', '点卡', '虚拟商品'] },
  { tag: '短信链接', words: ['短信', '链接', '点击', '验证码', 'CVV', '银行卡', '信用卡', '钓鱼'] },
  { tag: '中奖诈骗', words: ['中奖', '免费领取', '运费', '幸运用户', '红包', '领取手机'] },
  { tag: '二手交易', words: ['二手', '买家', '卖家', '私下转账', '脱离平台', '平台交易'] },
  { tag: '屏幕共享', words: ['屏幕共享', '远程控制'] },
  { tag: '账号安全', words: ['账号', '密码', '解封', '冻结', '异常登录'] },
  { tag: '反诈工具', words: ['96110', '国家反诈中心', '反诈APP', '反诈 App'] }
];

const EXPLANATIONS = {
  '刷单返利': '刷单返利本身就是诈骗：先小额返利建立信任，再诱导大额垫付，最后以任务未完成、账户异常等理由拒绝提现。不要垫付，立即停止并举报。',
  '兼职诈骗': '入职前要求交押金、培训费、保证金，或要求提供银行卡密码、验证码的，基本都是诈骗；正规兼职不会先收费。',
  '招嫖诈骗': '以“招嫖”为诱饵诱导刷单、垫付或交保证金，是刷单返利诈骗的变种；不要转账、不要刷单，直接删除并举报。',
  '冒充客服': '正规平台退款、解冻、关闭服务都在官方 APP 或订单页操作，不会要求加 QQ、下载陌生 APP、提供银行卡密码或验证码。应挂断并通过官方客服核实。',
  '冒充公检法': '公检法不会电话办案，也不存在“安全账户”；不会要求转账、提供验证码或“保密调查”。应挂断并拨打 110 或到派出所核实。',
  '投资理财': '“保本高息、稳赚不赔、内部消息”是典型诈骗话术；不要下载陌生理财 APP，不要向个人账户转账，投资应通过正规持牌机构。',
  '贷款诈骗': '正规贷款不会先收工本费、保证金、解冻费或征信修复费；放款前要求转账的，基本可以判定为诈骗。',
  '校园诈骗': '涉及学费、学籍、补贴、助学贷款等，应通过学校官方系统、辅导员、班主任或教务处核实，不要点陌生链接或向私人账户转账。',
  '快递理赔': '快递理赔应在快递公司官方 APP 或客服核实，不会要求提供银行卡密码、验证码或下载陌生理赔 APP。',
  '游戏交易': '游戏账号、代练交易应走官方平台，不要提前支付押金或把账号密码交给陌生人。',
  '短信链接': '陌生短信或链接可能是钓鱼入口，不要点击或填写银行卡、验证码、CVV；应通过官方 APP 或客服电话核实。',
  '中奖诈骗': '“免费领取”却要求先付运费、手续费或保证金，是典型中奖诈骗；不要转账。',
  '二手交易': '二手交易应坚持平台内担保支付，脱离平台私下转账会失去交易保障。',
  '屏幕共享': '屏幕共享或远程控制会暴露验证码、支付密码和账户页面，任何要求开启屏幕共享的“客服”都应拒绝。',
  '账号安全': '账号异常应通过官方 APP 或客服处理，不要点击陌生链接、不要提供密码或验证码。',
  '反诈工具': '96110 是反诈预警劝阻专线；国家反诈中心 APP 应从官方应用商店下载，遇到可疑情况及时核实。',
  '综合': '遇到涉及转账、验证码、银行卡密码或陌生链接的情况，应先通过官方渠道核实，做到不轻信、不转账、不泄露个人信息。'
};

function printUsage() {
  console.log(`题库 txt 转小程序导入 JSON

用法：
  node tools/question-bank-converter/convert.js <input.txt> <output.json> [--label 2025]

示例：
  node tools/question-bank-converter/convert.js test/question_bank/2025/2025全民反诈.txt test/question_bank/2025/2025全民反诈.json
  node tools/question-bank-converter/convert.js test/question_bank/2026/2026反诈题目.txt test/question_bank/2026/2026反诈题目.json --label 2026

说明：
  - 只保留单选题，跳过多选题
  - 输出给小程序“题目管理 → 批量导入”使用
  - 不写数据库，不补 questionId / bankIds / 时间戳
`);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const result = { input: '', output: '', label: '' };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    }
    if (arg === '--label') {
      result.label = args[i + 1] || '';
      i += 1;
      continue;
    }
    if (!result.input) {
      result.input = arg;
    } else if (!result.output) {
      result.output = arg;
    } else {
      throw new Error(`多余参数：${arg}`);
    }
  }

  return result;
}

function cleanText(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .replace(/^答案解析[：:]\s*/, '')
    .replace(/^答案解析[：:]\s*/, '')
    .trim();
}

function parseFile(file) {
  const raw = fs.readFileSync(file, 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const lines = raw.split('\n').map(line => line.trim()).filter(Boolean);
  const blocks = [];
  let current = null;

  for (const line of lines) {
    const match = line.match(/^(\d+)[.、]\s*(.*)$/);
    if (match) {
      if (current) blocks.push(current);
      current = { num: Number(match[1]), lines: [match[2]] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) blocks.push(current);

  return blocks.map(block => {
    const rawQuestion = block.lines[0] || '';
    const typeMatch = rawQuestion.match(/【(单选题|多选题|判断题)】/);
    const type = typeMatch ? typeMatch[1] : '';
    const question = cleanText(
      rawQuestion
        .replace(/【(单选题|多选题|判断题)】/g, '')
        .replace(/（\d+分）/g, '')
        .replace(/[（(]\s*[）)]\s*$/g, '')
    );

    const options = [];
    let answer = '';
    let explanation = '';
    let currentOptionIndex = -1;

    for (let i = 1; i < block.lines.length; i += 1) {
      const line = block.lines[i];
      const optionMatch = line.match(/^([A-F])[.、．]\s*(.*)$/);
      if (optionMatch) {
        options.push(cleanText(optionMatch[2]));
        currentOptionIndex = options.length - 1;
        continue;
      }

      const answerMatch = line.match(/^(?:正确答案|答案)[：:]\s*([A-F]+)\s*(.*)$/);
      if (answerMatch) {
        answer = answerMatch[1];
        let rest = answerMatch[2] || '';
        rest = rest.replace(/^答案解析[：:]\s*/, '');
        rest = rest.replace(/^答案解析[：:]\s*/, '');
        if (rest) explanation = cleanText(rest);
        continue;
      }

      const explanationMatch = line.match(/^答案解析[：:]\s*(.*)$/);
      if (explanationMatch) {
        explanation = cleanText(
          [explanation, explanationMatch[1].replace(/^答案解析[：:]\s*/, '')]
            .filter(Boolean)
            .join(' ')
        );
        continue;
      }

      if (currentOptionIndex >= 0 && !answer) {
        options[currentOptionIndex] = cleanText(`${options[currentOptionIndex]} ${line}`);
      }
    }

    return { num: block.num, type, question, options, answer, explanation };
  });
}

function tagsFor(text) {
  const matches = TAG_RULES
    .map(rule => ({
      tag: rule.tag,
      count: rule.words.reduce((n, word) => n + (text.includes(word) ? 1 : 0), 0)
    }))
    .filter(item => item.count > 0)
    .sort((a, b) => b.count - a.count);

  return matches.length ? matches.slice(0, 2).map(item => item.tag) : ['综合'];
}

function difficultyFor(question) {
  if (/不是|不包括|不会|不属于|最可能|首先/.test(question)) return 3;
  if (question.length >= 45) return 3;
  if (/^[小王李张陈周吴郑孙]/.test(question)) return 3;
  return 2;
}

function convertBlocks(blocks) {
  const converted = [];
  const skipped = [];
  const seenQuestions = new Set();
  const seenOptionSets = new Map();

  for (const block of blocks) {
    const questionKey = block.question.replace(/\s+/g, '').toLowerCase();
    const optionKey = block.options.join('||');
    let reason = '';

    if (block.type === '多选题') reason = '多选题，按需求跳过';
    else if (!/^[A-F]$/.test(block.answer)) reason = `答案不是单选字母：${block.answer || '空'}`;
    else if (block.options.length < 2 || block.options.length > 6) reason = `选项数量异常：${block.options.length}`;
    else if (block.answer.charCodeAt(0) - 65 >= block.options.length) reason = '答案字母超出选项范围';
    else if (!questionKey) reason = '题干为空';
    else if (seenQuestions.has(questionKey)) reason = '题干重复';
    else if (seenOptionSets.has(optionKey)) reason = `选项与第 ${seenOptionSets.get(optionKey)} 题完全相同，疑似复制错误`;

    if (reason) {
      skipped.push({
        num: block.num,
        reason,
        question: block.question,
        options: block.options,
        answer: block.answer
      });
      continue;
    }

    seenQuestions.add(questionKey);
    seenOptionSets.set(optionKey, block.num);

    const answerIndex = block.answer.charCodeAt(0) - 65;
    let tags = tagsFor(block.question);
    if (tags.length === 1 && tags[0] === '综合') {
      tags = tagsFor(`${block.question} ${block.options.join(' ')}`);
    }

    const explanation = block.explanation
      ? block.explanation
      : `正确答案是 ${block.answer}：${block.options[answerIndex]}。${EXPLANATIONS[tags[0]] || EXPLANATIONS['综合']}`;

    converted.push({
      question: block.question,
      options: block.options,
      answerIndex,
      explanation,
      difficulty: difficultyFor(block.question),
      tags,
      isActive: true
    });
  }

  return { converted, skipped };
}

function printReport(label, total, converted, skipped) {
  console.log(`\n### ${label}`);
  console.log(`total ${total}, converted ${converted.length}, skipped ${skipped.length}`);

  const distribution = {};
  converted.forEach(item => {
    const letter = String.fromCharCode(65 + item.answerIndex);
    distribution[letter] = (distribution[letter] || 0) + 1;
  });
  console.log('answer distribution:', distribution);

  const tagDistribution = {};
  converted.forEach(item => {
    item.tags.forEach(tag => {
      tagDistribution[tag] = (tagDistribution[tag] || 0) + 1;
    });
  });
  console.log('tags:', tagDistribution);

  if (skipped.length) {
    console.log('skipped:');
    skipped.forEach(item => {
      console.log(`  #${item.num} ${item.reason} | ${item.question.slice(0, 60)}`);
    });
  }
}

function main() {
  const { input, output, label } = parseArgs(process.argv);
  if (!input || !output) {
    printUsage();
    process.exit(1);
  }

  if (!fs.existsSync(input)) {
    console.error(`输入文件不存在：${input}`);
    process.exit(1);
  }

  const blocks = parseFile(input);
  const { converted, skipped } = convertBlocks(blocks);

  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(converted, null, 2)}\n`, 'utf8');

  printReport(label || path.basename(input, path.extname(input)), blocks.length, converted, skipped);
  console.log(`\n输出文件：${output}`);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error('转换失败：', err.message);
    process.exit(1);
  }
}

module.exports = {
  parseFile,
  convertBlocks,
  tagsFor,
  difficultyFor
};
