import fs from 'node:fs'
import path from 'node:path'

type Row = {
  userId: string
  itemId: string
  score: number
}

type RecommendationItem = {
  itemId: string
  score: number
}

type Output = {
  meta: {
    shape: string
    nnz: number
    sparsity: number
    generatedAt: string
    source: string
  }
  byUser: Record<string, RecommendationItem[]>
}

const TOPK_USER = 10
const TOPK_ITEM = 5
const ITEM_PREFIX = 'hack'

const repoRoot = process.cwd()

const inputCsvPath = path.join(repoRoot, 'tmp', 'cf_scored.csv')
const outputJsonPath = path.join(repoRoot, 'public', 'cf_recommendations.json')

function parseCsv(filePath: string): Row[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`CSV not found: ${filePath}`)
  }

  const raw = fs.readFileSync(filePath, 'utf8')
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length <= 1) return []

  const headers = lines[0].split(',').map((h) => h.trim())
  const userCol = headers.indexOf('user_id')
  const itemCol = headers.indexOf('item_id')
  const scoreCol = headers.indexOf('score')

  if (userCol < 0 || itemCol < 0 || scoreCol < 0) {
    throw new Error('CSV must include headers: user_id,item_id,score')
  }

  return lines.slice(1)
    .map((line) => line.split(','))
    .map((cols) => {
      const score = Number(cols[scoreCol] ?? '0')
      return {
        userId: (cols[userCol] ?? '').trim(),
        itemId: (cols[itemCol] ?? '').trim(),
        score: Number.isFinite(score) ? score : 0
      }
    })
    .filter((row) => row.userId && row.itemId)
}

function l2Normalize(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0))
  if (norm === 0) return vec.map(() => 0)
  return vec.map((v) => v / norm)
}

function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length !== right.length || left.length === 0) return 0
  let dot = 0
  let leftNorm = 0
  let rightNorm = 0

  for (let i = 0; i < left.length; i += 1) {
    dot += left[i] * right[i]
    leftNorm += left[i] * left[i]
    rightNorm += right[i] * right[i]
  }

  if (leftNorm === 0 || rightNorm === 0) return 0
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm))
}

function buildMatrix(rows: Row[]) {
  const userIds = [...new Set(rows.map((row) => row.userId))]
  const itemIds = [...new Set(rows.map((row) => row.itemId))]

  const userIndex = new Map(userIds.map((id, idx) => [id, idx]))
  const itemIndex = new Map(itemIds.map((id, idx) => [id, idx]))

  const matrix = Array.from({ length: userIds.length }, () => Array(itemIds.length).fill(0))

  rows.forEach((row) => {
    const u = userIndex.get(row.userId)
    const i = itemIndex.get(row.itemId)
    if (u === undefined || i === undefined) return
    matrix[u][i] = row.score
  })

  return { matrix, userIds, itemIds }
}

function recommendForUser(
  uid: number,
  matrix: number[][],
  normalizedRows: number[][],
  itemIds: string[]
): RecommendationItem[] {
  const sims = normalizedRows.map((row, candidateIdx) =>
    candidateIdx === uid ? 0 : cosineSimilarity(normalizedRows[uid], row)
  )

  const neighbors = sims
    .map((sim, idx) => ({ sim, idx }))
    .sort((a, b) => b.sim - a.sim)
    .slice(0, TOPK_USER)
    .filter((item) => item.sim > 0)

  const seen = new Set(
    matrix[uid]
      .map((score, idx) => ({ score, idx }))
      .filter((item) => item.score > 0)
      .map((item) => item.idx)
  )

  const scoreMap = new Map<number, number>()

  neighbors.forEach(({ sim, idx }) => {
    matrix[idx].forEach((value, itemIdx) => {
      const itemId = itemIds[itemIdx] ?? ''
      if (!itemId.startsWith(ITEM_PREFIX)) return
      if (seen.has(itemIdx)) return
      if (value <= 0) return
      scoreMap.set(itemIdx, (scoreMap.get(itemIdx) ?? 0) + sim * value)
    })
  })

  return [...scoreMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOPK_ITEM)
    .map(([itemIdx, score]) => ({
      itemId: itemIds[itemIdx],
      score: Number(score.toFixed(6))
    }))
}

function main() {
  const rows = parseCsv(inputCsvPath)
  const { matrix, userIds, itemIds } = buildMatrix(rows)
  const normalizedRows = matrix.map((row) => l2Normalize(row))

  const byUser: Record<string, RecommendationItem[]> = {}
  userIds.forEach((userId, uid) => {
    byUser[userId] = recommendForUser(uid, matrix, normalizedRows, itemIds)
  })

  const nnz = rows.length
  const totalCells = userIds.length * itemIds.length
  const sparsity = totalCells > 0 ? 1 - nnz / totalCells : 0

  const output: Output = {
    meta: {
      shape: `${userIds.length} x ${itemIds.length}`,
      nnz,
      sparsity,
      generatedAt: new Date().toISOString(),
      source: 'tmp/cf_scored.csv'
    },
    byUser
  }

  fs.mkdirSync(path.dirname(outputJsonPath), { recursive: true })
  fs.writeFileSync(outputJsonPath, JSON.stringify(output, null, 2), 'utf8')

  console.log(`Updated ${path.relative(repoRoot, outputJsonPath)}`)
  console.log(`shape=${output.meta.shape}, nnz=${nnz}, sparsity=${(sparsity * 100).toFixed(2)}%`)
}

main()
