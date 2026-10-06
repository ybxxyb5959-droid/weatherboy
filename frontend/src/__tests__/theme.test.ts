import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// 다크모드를 위해 잉크(#222)·종이(#fcfcfa) 색은 CSS 변수(--ink, --paper)로만 쓴다.
// 새 그림을 추가하면서 색을 직접 적으면 다크모드에서 선이 안 보이게 되므로 여기서 막는다.
// 일부러 고정 색을 쓰는 파일(이미지로 저장되는 카드, 옷 위의 세부선, 밤하늘 위의 빌딩 그림자, 관리자 표)은 허용한다.
const ALLOWED = [/shareCard\.ts$/, /ClothingDoodle\.tsx$/, /SunBar\.tsx$/, /admin\.css$/, /greetingPose\.ts$/]
const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === '__tests__' ? [] : walk(join(d, e.name))) : [join(d, e.name)]))

describe('다크모드 색 규칙', () => {
  const files = walk('src').filter((f) => /\.(tsx?|css)$/.test(f))
  it('하드코딩된 #222 / #fcfcfa / rgba(34,34,34) 가 없다(변수 정의·허용 파일 제외)', () => {
    const bad: string[] = []
    for (const f of files) {
      if (ALLOWED.some((r) => r.test(f))) continue
      const text = readFileSync(f, 'utf8')
        .split(/\r?\n/)
        .filter((l) => !/^\s*--[a-z-]+\s*:/.test(l)) // :root 의 변수 정의 줄
        .join('\n')
        .replace(/var\(--paper,\s*#fcfcfa\)/g, '')
      for (const m of text.matchAll(/#222\b|#fcfcfa\b|rgba\(\s*34\s*,\s*34\s*,\s*34/gi)) bad.push(`${f}: ${m[0]}`)
    }
    expect(bad).toEqual([])
  })
  it('다크 팔레트가 변수 전부를 덮어쓴다', () => {
    const css = readFileSync('src/styles/global.css', 'utf8').replace(/\r\n/g, '\n')
    const light = css.match(/:root \{([\s\S]*?)\n\}/)![1]!
    const dark = css.match(/@media \(prefers-color-scheme: dark\) \{\s*:root \{([\s\S]*?)\n  \}/)![1]!
    const names = (s: string) => [...s.matchAll(/(--[a-z-]+):/g)].map((m) => m[1]!).filter((n) => n !== '--font')
    for (const n of names(light)) expect(names(dark), `${n} 가 다크 팔레트에 없어요`).toContain(n)
  })
  it('다크모드를 지원한다고 알린다(light dark)', () => {
    expect(readFileSync('index.html', 'utf8')).toContain('<meta name="color-scheme" content="light dark"')
    expect(readFileSync('src/styles/global.css', 'utf8')).toContain('color-scheme: light dark')
  })
})
