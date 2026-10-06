import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 개발 중 /api 를 백엔드로 넘긴다 (같은 Origin 이라 세션 쿠키가 그대로 동작)
  // 자동 테스트: 브라우저 없이 계산·화면 문구를 확인한다(npm test)
  test: { environment: 'node', include: ['src/__tests__/**/*.test.{ts,tsx}'] },
  server: { proxy: { '/api': 'http://localhost:4000' } },
})
