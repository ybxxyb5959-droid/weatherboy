// AI 기능(사진으로 옷 등록, 말로 일정 등록)용 도구

/**
 * 사진을 서버로 보내기 전에 줄인다 (긴 변 768px, JPEG).
 * 용량을 줄여 전송/분석을 빠르게 하고, 원본 사진은 서버에 보내지 않는다.
 */
export async function resizeImageToDataUrl(file: File, maxSide = 768, quality = 0.75): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('사진 파일만 고를 수 있어요.')
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('사진을 처리하지 못했어요.')
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', quality)
}

/** AI 가 제안하는 것은 종류와 색뿐이다 (두께·방풍·방수는 사진으로 알기 어렵고 호출량만 늘어서 묻지 않는다) */
/** AI 가 제안하는 것은 종류/색/무늬뿐이다 (두께·방풍·방수는 사진으로 알기 어렵고 호출량만 늘어서 묻지 않는다) */
export interface ClothingSuggestion {
  type: string
  color: string
  pattern: string
}

export interface EventSuggestion {
  title: string
  kind: string
  startDate: string
  endDate?: string
  place: string
  startTime?: string
  endTime?: string
}

/**
 * 옷장/행거 사진을 분석용 조각으로 나눈다.
 * 가로로 긴 사진(가로/세로 1.25 이상)은 서로 조금 겹치는 3조각(세로 띠)으로 잘라서 따로 분석해야 빽빽한 행거에서 더 많이 찾는다.
 * (시험: 한 장 통째로 7~10벌, 3조각으로 22벌). 그 외에는 한 장 그대로 쓴다.
 */
export async function splitForScan(file: File, maxSide = 1280, quality = 0.8): Promise<string[]> {
  if (!file.type.startsWith('image/')) throw new Error('사진 파일만 고를 수 있어요.')
  const bmp = await createImageBitmap(file)
  const ranges: [number, number][] = bmp.width / bmp.height >= 1.25 ? [[0, 0.42], [0.29, 0.71], [0.58, 1]] : [[0, 1]]
  const out: string[] = []
  for (const [a, b] of ranges) {
    const sx = Math.round(bmp.width * a)
    const sw = Math.round(bmp.width * (b - a))
    const scale = Math.min(1, maxSide / Math.max(sw, bmp.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(sw * scale)
    canvas.height = Math.round(bmp.height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('사진을 처리하지 못했어요.')
    ctx.drawImage(bmp, sx, 0, sw, bmp.height, 0, 0, canvas.width, canvas.height)
    out.push(canvas.toDataURL('image/jpeg', quality))
  }
  bmp.close()
  return out
}
