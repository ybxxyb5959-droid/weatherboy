/**
 * 받침에 맞는 조사를 고른다. 받침이 있으면 a, 없으면 b (예: josa('후드티', '은', '는') -> '는').
 * '으로/로'는 받침이 ㄹ이면 '로'가 맞아서(예: 서울로) 따로 처리한다. 한글이 아니면 받침이 없는 것으로 본다.
 */
export function josa(word: string, a: string, b: string): string {
  const w = word.trimEnd()
  if (!w) return b
  const code = w.charCodeAt(w.length - 1) - 0xac00
  if (code < 0 || code > 11171) return b
  const jong = code % 28
  if (jong === 0) return b
  if (a === '으로' && jong === 8) return b // ㄹ 받침
  return a
}

/** 낱말에 조사를 붙여 돌려준다: withJosa('후드티', '은', '는') -> '후드티는' */
export const withJosa = (word: string, a: string, b: string) => `${word}${josa(word, a, b)}`
