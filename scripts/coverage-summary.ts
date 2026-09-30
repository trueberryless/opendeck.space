import { readFileSync } from 'node:fs'

interface Metric {
  pct: number
  covered: number
  total: number
}

const METRICS = ['lines', 'statements', 'functions', 'branches'] as const

const { total } = JSON.parse(readFileSync('coverage/coverage-summary.json', 'utf8')) as {
  total: Record<(typeof METRICS)[number], Metric>
}

const rows = METRICS.map(
  (name) => `| ${name} | ${total[name].pct.toFixed(2)}% | ${total[name].covered} / ${total[name].total} |`,
)

console.log(['## Coverage', '', '| Metric | Covered | Count |', '| --- | --- | --- |', ...rows].join('\n'))
