/**
 * 统一日志工具 - 公共模块
 *
 * 上游依赖：无
 * 入口：createLogger(module)
 * 主要功能：按 CLAUDE.md「调试日志规范」输出 `[module] {"ts","level","stage",...}` 单行 JSON
 * 输出：log(level, stage, detail) => void
 *
 * 约定：
 * - level 取 INFO / WARN / ERROR，非法值按 INFO 处理。
 * - stage 使用「模块:动作」，例如 `save:failed`、`upload:preview-resolve-failed`。
 * - detail 只能放可公开排查信息，禁止写入 openid、手机号、学号、姓名、密钥、token。
 */

const LEVELS = ['INFO', 'WARN', 'ERROR']

function createLogger(module) {
  const name = module || 'app'

  return function log(level, stage, detail) {
    const safeLevel = LEVELS.includes(level) ? level : 'INFO'
    const line = `[${name}] ${JSON.stringify({
      ...(detail || {}),
      ts: new Date().toISOString(),
      level: safeLevel,
      stage: stage || 'unknown'
    })}`

    if (safeLevel === 'ERROR') console.error(line)
    else if (safeLevel === 'WARN') console.warn(line)
    else console.log(line)
  }
}

module.exports = { createLogger }
