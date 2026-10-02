import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 개발 중 /api 를 백엔드로 넘긴다 (같은 Origin 이라 세션 쿠키가 그대로 동작)
  server: { proxy: { '/api': 'http://localhost:4000' } },
})
