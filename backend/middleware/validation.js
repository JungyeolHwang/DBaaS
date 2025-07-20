const { createErrorResponse } = require('../utils/response');

// Constants
const SUPPORTED_DB_TYPES = ['postgresql', 'mysql', 'mariadb'];
const DEFAULT_RETENTION_DAYS = '7';

/**
 * 인스턴스 생성 입력 검증
 */
const validateCreateInstance = (req, res, next) => {
  const { type, name, config = {} } = req.body;
  const errors = [];

  if (!type) errors.push('Type is required');
  if (!name) errors.push('Name is required');
  if (type && !SUPPORTED_DB_TYPES.includes(type)) {
    errors.push(`Supported types: ${SUPPORTED_DB_TYPES.join(', ')}`);
  }

  if (errors.length > 0) {
    return res.status(400).json(createErrorResponse(errors.join(', ')));
  }

  req.validatedData = { type, name, config };
  next();
};

/**
 * 백업 생성 검증
 */
const validateBackupCreation = (req, res, next) => {
  const { backupName, retentionDays } = req.body;
  
  // 백업명 자동 생성
  req.backupOptions = {
    backupName: backupName || `${req.params.name}-backup-${Date.now()}`,
    retentionDays: retentionDays || DEFAULT_RETENTION_DAYS,
    instanceType: req.instance.type
  };
  
  next();
};

/**
 * 복구 요청 검증
 */
const validateRestoreRequest = (req, res, next) => {
  const { backupName, newInstanceName } = req.body;
  const errors = [];

  if (!backupName) errors.push('backupName is required');
  if (!newInstanceName) errors.push('newInstanceName is required');

  if (errors.length > 0) {
    return res.status(400).json(createErrorResponse(errors.join(', ')));
  }

  next();
};

module.exports = {
  validateCreateInstance,
  validateBackupCreation,
  validateRestoreRequest,
  SUPPORTED_DB_TYPES,
  DEFAULT_RETENTION_DAYS
}; 