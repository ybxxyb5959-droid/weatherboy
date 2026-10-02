export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message)
  }
}
export const badRequest = (message = '입력값을 확인해주세요.', code = 'VALIDATION_ERROR') => new AppError(400, code, message)
export const unauthorized = (message = '로그인이 필요해요.') => new AppError(401, 'UNAUTHORIZED', message)
export const forbidden = (message = '권한이 없어요.') => new AppError(403, 'FORBIDDEN', message)
export const notFound = (message = '찾을 수 없어요.') => new AppError(404, 'NOT_FOUND', message)
