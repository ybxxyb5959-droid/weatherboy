import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// 잉크(#222)·종이(#fcfcfa) 색은 CSS 변수(--ink, --paper)로 통일한다.
// 새 그림도 공통 팔레트를 따르도록 색을 직접 적는 것을 막는다.
// 일부러 고정 색을 쓰는 파일(이미지로 저장되는 카드, 옷 위의 세부선, 밤하늘 위의 빌딩 그림자, 관리자 표)은 허용한다.
const ALLOWED = [/shareCard\.ts$/, /ClothingDoodle\.tsx$/, /SunBar\.tsx$/, /admin\.css$/, /greetingPose\.ts$/]
const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === '__tests__' ? [] : walk(join(d, e.name))) : [join(d, e.name)]))

describe('라이트모드 색 규칙', () => {
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
  it('시스템 다크모드에 따른 팔레트 변경이 없다', () => {
    expect(readFileSync('src/styles/global.css', 'utf8')).not.toContain('prefers-color-scheme')
  })
  it('라이트모드와 밝은 브라우저 표시색을 고정한다', () => {
    const html = readFileSync('index.html', 'utf8')
    expect(html).toContain('<meta name="color-scheme" content="light"')
    expect(html).toContain('<meta name="supported-color-schemes" content="light"')
    expect(html).toContain('<meta name="theme-color" content="#fcfcfa" />')
    expect(html).not.toContain('prefers-color-scheme')
    expect(readFileSync('src/styles/global.css', 'utf8')).toContain('color-scheme: only light')
  })
})
