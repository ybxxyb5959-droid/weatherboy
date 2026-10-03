import { api } from '../api'

// 앱 후기(사용자당 한 번). 추천에 대한 피드백(별개)과 헷갈리지 않게 이름을 review 로 쓴다.
export interface ReviewStatus {
  reviewed: boolean // 이미 후기를 남겼는가
  show: boolean // 지금 홈에 후기 요청 카드를 보여줄까(접속 3일 이상 등 서버가 판단)
}

export const getReviewStatus = () => api<ReviewStatus>('GET', '/api/reviews/status')
export const submitReview = (rating: number, message: string) => api('POST', '/api/reviews', { rating, message })
export const snoozeReview = () => api('POST', '/api/reviews/snooze')
export const dismissReview = () => api('POST', '/api/reviews/dismiss')

// 의견·불편 제보: 사용하다 떠오를 때마다 여러 번 보낼 수 있다(하루 5번까지).
export type SupportKind = 'BUG' | 'IDEA' | 'OTHER'
export const sendSupport = (kind: SupportKind, message: string) => api('POST', '/api/support', { kind, message })
