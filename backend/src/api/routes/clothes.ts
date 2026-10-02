import { Router } from 'express'
import { z } from 'zod'
import { clothingTypeMap, colorMap, patternMap, thicknessMap } from '../../config/mappings.js'
import { prisma } from '../../db.js'
import { defaultsForType, deriveClothing } from '../../rules/clothing.js'
import { serializeClothing } from '../../services/serializers.js'
import { badRequest, notFound } from '../../utils/errors.js'
import { parse, requireAuth, wrap, type AuthedRequest } from '../middleware/common.js'

export const clothesRouter = Router()
clothesRouter.use(requireAuth)

const base = z.object({
  type: z.enum(clothingTypeMap.uiValues),
  // 두께/방풍/방수는 선택 사항이다. 보내지 않으면 옷 종류로 정한다.
  thickness: z.enum(thicknessMap.uiValues).optional(),
  color: z.enum(colorMap.uiValues),
  pattern: z.enum(patternMap.uiValues).optional(), // 없으면 무지
  windproof: z.boolean().optional(),
  waterproof: z.boolean().optional(),
})
const idParam = z.object({ id: z.string().uuid() })
// 한 사람이 만들 수 있는 옷 수의 상한 (자동 입력 남용으로 DB 가 불어나는 것을 막는다)
const MAX_CLOTHES = 500

clothesRouter.get(
  '/',
  wrap(async (req, res) => {
    const rows = await prisma.clothing.findMany({ where: { userId: (req as AuthedRequest).userId, active: true }, orderBy: { createdAt: 'asc' } })
    res.json(rows.map(serializeClothing))
  }),
)

clothesRouter.post(
  '/',
  wrap(async (req, res) => {
    const b = parse(base, req.body)
    const userId = (req as AuthedRequest).userId
    if ((await prisma.clothing.count({ where: { userId, active: true } })) >= MAX_CLOTHES) throw badRequest(`옷은 ${MAX_CLOTHES}벌까지 담을 수 있어요.`, 'LIMIT_REACHED')
    const type = clothingTypeMap.toDb(b.type)
    const d = defaultsForType(type)
    const thickness = b.thickness ? thicknessMap.toDb(b.thickness) : d.thickness
    const row = await prisma.clothing.create({
      data: { userId, type, thickness, color: colorMap.toDb(b.color), pattern: b.pattern ? patternMap.toDb(b.pattern) : 'SOLID', windproof: b.windproof ?? d.windproof, waterproof: b.waterproof ?? d.waterproof, ...deriveClothing(type, thickness) },
    })
    res.status(201).json(serializeClothing(row))
  }),
)

clothesRouter.patch(
  '/:id',
  wrap(async (req, res) => {
    const { id } = parse(idParam, req.params)
    const b = parse(base.partial().extend({ confirmed: z.boolean().optional() }), req.body)
    const userId = (req as AuthedRequest).userId
    const cur = await prisma.clothing.findFirst({ where: { id, userId, active: true } })
    if (!cur) throw notFound('옷을 찾을 수 없어요.')
    const type = b.type ? clothingTypeMap.toDb(b.type) : cur.type
    // 종류를 바꾸면(예: 반팔 -> 패딩) 방풍/방수도 새 종류에 맞게 다시 정한다. 직접 보낸 값은 그대로 쓴다.
    const retyped = b.type !== undefined && type !== cur.type
    const d = defaultsForType(type)
    const thickness = b.thickness ? thicknessMap.toDb(b.thickness) : retyped ? d.thickness : cur.thickness
    const row = await prisma.clothing.update({
      where: { id },
      data: {
        type,
        thickness,
        color: b.color ? colorMap.toDb(b.color) : cur.color,
        pattern: b.pattern ? patternMap.toDb(b.pattern) : cur.pattern,
        windproof: b.windproof ?? (retyped ? d.windproof : cur.windproof),
        waterproof: b.waterproof ?? (retyped ? d.waterproof : cur.waterproof),
        isSample: false, // 수정하거나 '내 옷이에요'로 확인하면 예시가 아니라 내 옷이 된다
        ...deriveClothing(type, thickness),
      },
    })
    res.json(serializeClothing(row))
  }),
)

// Soft delete
clothesRouter.delete(
  '/:id',
  wrap(async (req, res) => {
    const { id } = parse(idParam, req.params)
    const r = await prisma.clothing.updateMany({ where: { id, userId: (req as AuthedRequest).userId, active: true }, data: { active: false } })
    if (r.count === 0) throw notFound('옷을 찾을 수 없어요.')
    res.status(204).end()
  }),
)
