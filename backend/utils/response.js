/**
 * 성공 응답 생성
 */
const createSuccessResponse = (data, message, statusCode = 200) => ({
  success: true,
  ...(message && { message }),
  ...data
});

/**
 * 에러 응답 생성
 */
const createErrorResponse = (error, statusCode = 500) => ({
  success: false,
  error: typeof error === 'string' ? error : error.message
});

/**
 * 비동기 핸들러 래퍼 (에러 처리 자동화)
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * 에러 핸들링 미들웨어
 */
const errorHandler = (error, req, res, next) => {
  console.error(`Error in ${req.method} ${req.path}:`, error.message);
  
  // 이미 응답이 전송된 경우 Express 기본 에러 핸들러로 전달
  if (res.headersSent) {
    return next(error);
  }
  
  res.status(500).json(createErrorResponse(error.message));
};

module.exports = {
  createSuccessResponse,
  createErrorResponse,
  asyncHandler,
  errorHandler
}; 