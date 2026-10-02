import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../db.js'
import { analyze, TITLES } from '../../services/character/analysis.js'
import { CATALOG, cleanConfig, type Slot } from '../../services/character/catalog.js'
import { badRequest } from '../../utils/errors.js'
import { requireAuth, wrap, type AuthedRequest } from '../middleware/common.js'

export const characterRouter = Router()
characterRouter.use(requireAuth)

async function view(userId: string) {
  const [user, clothes] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { characterJson: true } }),
    // 예시 옷은 분석에 넣지 않는다 (내가 직접 담은 옷만)
    prisma.clothing.findMany({ where: { userId, active: true, isSample: false }, select: { type: true, color: true, pattern: true } }),
  ])
  return { analysis: analyze(clothes), config: cleanConfig(user.characterJson), catalog: CATALOG, titles: TITLES }
}

/** 내 캐릭터: 옷장 분석(칭호, 색·종류·무늬 비중) + 꾸미기 설정 + 꾸미기 목록 */
characterRouter.get(
  '/',
  wrap(async (req, res) => {
    res.json(await view((req as AuthedRequest).userId))
  }),
)

const slots = CATALOG.map((s) => s.slot) as [Slot, ...Slot[]]
const body = z.object({ config: z.record(z.enum(slots), z.string().nullable()) })

/** 꾸미기 저장. 슬롯 값을 null 로 보내면 벗는다. 목록에 없는 아이템은 거부한다. */
characterRouter.put(
  '/',
  wrap(async (req, res) => {
    const userId = (req as AuthedRequest).userId
    const parsed = body.safeParse(req.body)
    if (!parsed.success) throw badRequest('꾸미기 설정이 올바르지 않아요.')
    const next: Record<string, string> = {}
    for (const [slot, id] of Object.entries(parsed.data.config)) {
      if (id === null) continue
      const def = CATALOG.find((s) => s.slot === slot)!
      if (!def.items.some((i) => i.id === id)) throw badRequest('없는 꾸미기 아이템이에요.')
      next[slot] = id
    }
    await prisma.user.update({ where: { id: userId }, data: { characterJson: next } })
    res.json(await view(userId))
  }),
)
