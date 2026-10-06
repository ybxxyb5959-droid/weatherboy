import react from '@vitejs/plugin-react'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vitest/config'

/** 빌드가 끝나면 dist/sw.js 의 미리 받아 둘 목록(WB_PRECACHE 표시 자리)을 /assets/ 의 JS·CSS 로 채운다. 관리자 화면과 공유 이미지 조각은 거의 안 써서 뺀다. */
function swPrecache(): Plugin {
  return {
    name: 'wb-sw-precache',
    apply: 'build',
    closeBundle() {
      const swPath = 'dist/sw.js'
      const files = readdirSync('dist/assets')
        .filter((f) => /.(js|css)$/.test(f) && !/^(AdminPage|shareCard|fonts)-/.test(f))
        .map((f) => `/assets/${f}`)
      const src = readFileSync(swPath, 'utf8')
      if (!src.includes('[] /*WB_PRECACHE*/')) throw new Error('sw.js 에 /*WB_PRECACHE*/ 자리가 없어요')
      writeFileSync(swPath, src.replace('[] /*WB_PRECACHE*/', `${JSON.stringify(files)} /*WB_PRECACHE*/`))
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), swPrecache()],
  // 개발 중 /api 를 백엔드로 넘긴다 (같은 Origin 이라 세션 쿠키가 그대로 동작)
  // 자동 테스트: 브라우저 없이 계산·화면 문구를 확인한다(npm test)
  test: { environment: 'node', include: ['src/__tests__/**/*.test.{ts,tsx}'] },
  server: { proxy: { '/api': 'http://localhost:4000' } },
})
