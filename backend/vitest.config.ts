import 'dotenv/config' // .env 의 TEST_DATABASE_URL 을 읽는다
import { defineConfig } from 'vitest/config'

// 통합 테스트는 반드시 TEST_DATABASE_URL(개발 DB 와 다른, 이름에 'test' 가 들어간 DB)에서만 실행한다.
// 설정이 없거나 개발 DB 를 가리키면 테스트를 시작하지 않는다. 외부 API 키는 항상 가짜 값 + fetch Mock.
const testUrl = process.env.TEST_DATABASE_URL
if (!testUrl) {
  throw new Error('TEST_DATABASE_URL 이 없습니다. 테스트는 전용 DB 에서만 실행됩니다 (.env 에 설정하세요).')
}
const dbName = (url: string) => new URL(url).pathname.replace(/^\//, '')
if (testUrl === process.env.DATABASE_URL || !/test/i.test(dbName(testUrl))) {
  throw new Error('TEST_DATABASE_URL 이 개발 DB 와 같거나 DB 이름에 "test" 가 없습니다. 테스트를 중단합니다.')
}

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 30000,
    fileParallelism: false,
    env: {
      DATABASE_URL: testUrl,
      SESSION_SECRET: 'test-session-secret-0123456789',
      FRONTEND_ORIGIN: 'http://localhost:5173',
      KAKAO_REST_API_KEY: 'test-rest-key',
      KAKAO_CLIENT_SECRET: 'test-client-secret',
      KAKAO_REDIRECT_URI: 'http://localhost:4000/api/auth/kakao/callback',
      KMA_SERVICE_KEY: '',
      AIRKOREA_SERVICE_KEY: '',
      AI_ENABLED: 'false',
    },
  },
})
