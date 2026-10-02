import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import StickPerson, { type WornItem } from '../components/StickPerson'
import type { Accessories } from '../components/CharacterDecor'
import { colorHex } from '../mocks/clothes'

export interface CardInput {
  title: string
  tagline: string
  persona: string | null
  wear: { top?: WornItem; bottom?: WornItem; outer?: WornItem }
  accessories: Accessories
  colors: { name: string; share: number }[]
  count: number
  code: string
  origin: string
}

const W = 1080
const H = 1350
const FONT = "Gaegu, 'Nanum Pen Script', 'Comic Sans MS', cursive"

/** 졸라맨을 이미지로 (SVG 문자열 -> Image). 글꼴이 필요 없는 그림이라 그대로 그릴 수 있다. */
async function characterImage(o: CardInput, size: number): Promise<HTMLImageElement> {
  const markup = renderToStaticMarkup(createElement(StickPerson, { mood: 'stand', size, wear: o.wear, persona: o.persona, accessories: o.accessories }))
  const svg = markup.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return img
  } finally {
    // decode 가 끝난 뒤에는 주소를 풀어도 그려진다
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}

/** 삐뚤빼뚤한 사각 테두리 (항상 같은 모양) */
function doodleRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r = 36) {
  const j = (n: number) => Math.sin(n * 12.9898) * 3
  ctx.beginPath()
  ctx.moveTo(x + r, y + j(1))
  ctx.lineTo(x + w - r, y + j(2))
  ctx.quadraticCurveTo(x + w + j(3), y + j(4), x + w + j(5), y + r)
  ctx.lineTo(x + w + j(6), y + h - r)
  ctx.quadraticCurveTo(x + w + j(7), y + h + j(8), x + w - r, y + h + j(9))
  ctx.lineTo(x + r, y + h + j(10))
  ctx.quadraticCurveTo(x + j(11), y + h + j(12), x + j(13), y + h - r)
  ctx.lineTo(x + j(14), y + r)
  ctx.quadraticCurveTo(x + j(15), y + j(16), x + r, y + j(17))
  ctx.closePath()
}

function fit(ctx: CanvasRenderingContext2D, text: string, maxW: number, start: number, weight = 700) {
  let size = start
  ctx.font = `${weight} ${size}px ${FONT}`
  while (ctx.measureText(text).width > maxW && size > 24) {
    size -= 2
    ctx.font = `${weight} ${size}px ${FONT}`
  }
}

/** 공유 카드(1080x1350 PNG): 칭호, 칭호 캐릭터, 색상 비중 막대, 옷 개수, 초대 코드와 앱 주소 */
export async function buildCharacterCard(o: CardInput): Promise<Blob> {
  try {
    await Promise.all([document.fonts.load(`700 80px Gaegu`), document.fonts.load(`400 40px Gaegu`)])
  } catch {
    /* 글꼴을 못 불러오면 대체 글꼴로 그린다 */
  }
  const img = await characterImage(o, 560)
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fcfcfa'
  ctx.fillRect(0, 0, W, H)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  // 테두리
  ctx.strokeStyle = '#222'
  ctx.lineWidth = 7
  doodleRect(ctx, 36, 36, W - 72, H - 72, 48)
  ctx.stroke()

  // 머리말 / 칭호
  ctx.fillStyle = '#6b6b66'
  ctx.font = `700 46px ${FONT}`
  ctx.fillText('오늘 뭐 입지?  ·  내 옷장 칭호', W / 2, 120)
  ctx.fillStyle = '#222'
  fit(ctx, o.title, W - 160, 132)
  ctx.fillText(o.title, W / 2, 262)
  ctx.fillStyle = '#555'
  fit(ctx, o.tagline, W - 180, 50, 400)
  ctx.fillText(o.tagline, W / 2, 334)

  // 캐릭터
  const ch = (560 * 160) / 140
  ctx.drawImage(img, (W - 560) / 2, 350, 560, ch)

  // 색상 비중 막대 (한 줄로 이어 붙인 막대 + 범례)
  const bx = 120
  const bw = W - 240
  const by = 1030
  ctx.fillStyle = '#fcfcfa'
  ctx.strokeStyle = '#222'
  ctx.lineWidth = 5
  doodleRect(ctx, bx, by, bw, 40, 18)
  ctx.save()
  ctx.clip()
  let x = bx
  const top = o.colors.slice(0, 6)
  const total = top.reduce((a, c) => a + c.share, 0) || 1
  for (const c of top) {
    const w = (c.share / total) * bw
    ctx.fillStyle = colorHex[c.name] ?? '#ccc'
    ctx.fillRect(x, by, w, 40)
    x += w
  }
  ctx.restore()
  doodleRect(ctx, bx, by, bw, 40, 18)
  ctx.stroke()

  ctx.fillStyle = '#222'
  const legend = o.colors.slice(0, 3).map((c) => `${c.name} ${Math.round(c.share * 100)}%`).join('  ·  ')
  fit(ctx, legend, W - 200, 46)
  ctx.fillText(legend, W / 2, by + 92)
  ctx.fillStyle = '#6b6b66'
  ctx.font = `400 42px ${FONT}`
  ctx.fillText(`직접 담은 옷 ${o.count}벌을 분석했어요`, W / 2, by + 142)

  // 초대
  ctx.fillStyle = '#222'
  fit(ctx, '나도 내 옷장 칭호 받아보기', W - 200, 54)
  ctx.fillText('나도 내 옷장 칭호 받아보기', W / 2, 1246)
  ctx.fillStyle = '#6b6b66'
  fit(ctx, `${o.origin.replace(/^https?:\/\//, '')}   ·   초대 코드 ${o.code}`, W - 160, 38, 400)
  ctx.fillText(`${o.origin.replace(/^https?:\/\//, '')}   ·   초대 코드 ${o.code}`, W / 2, 1296)

  return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('이미지를 만들지 못했어요.'))), 'image/png'))
}

export type ShareResult = 'shared' | 'downloaded' | 'canceled'

/** 폰의 공유 창(카카오톡 등)으로 이미지를 보낸다. 지원하지 않는 환경(PC 등)에서는 이미지로 저장한다. */
export async function shareImage(blob: Blob, text: string): Promise<ShareResult> {
  const file = new File([blob], 'my-character.png', { type: 'image/png' })
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: '내 캐릭터', text })
      return 'shared'
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'canceled' // 공유 창을 닫음
      throw e
    }
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'my-character.png'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  return 'downloaded'
}
