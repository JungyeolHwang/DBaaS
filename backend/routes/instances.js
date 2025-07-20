const express = require('express');
const router = express.Router();

// Controllers
const InstanceController = require('../controllers/InstanceController');
const BackupController = require('../controllers/BackupController');

// Middleware
const { checkInstanceExists } = require('../middleware/instanceMiddleware');
const { 
  validateCreateInstance, 
  validateBackupCreation, 
  validateRestoreRequest 
} = require('../middleware/validation');

// Utils
const { createSuccessResponse, asyncHandler, errorHandler } = require('../utils/response');

// Controller instances
const instanceController = new InstanceController();
const backupController = new BackupController();

// === Route Handlers ===

/**
 * 모든 인스턴스 목록 조회
 * GET /instances
 */
const getAllInstances = asyncHandler(async (req, res) => {
  const result = await instanceController.getAllInstances();
  res.json(createSuccessResponse(result));
});

/**
 * 새 인스턴스 생성
 * POST /instances
 */
const createInstance = asyncHandler(async (req, res) => {
  const instance = await instanceController.createInstance(req.validatedData);
  res.status(201).json(createSuccessResponse(
    { instance },
    'Instance creation started'
  ));
});

/**
 * 특정 인스턴스 상태 조회
 * GET /instances/:name
 */
const getInstanceById = asyncHandler(async (req, res) => {
  const { name } = req.params;
  const instance = await instanceController.getInstanceById(name);
  res.json(createSuccessResponse({ instance }));
});

/**
 * 인스턴스 연결 정보 조회
 * GET /instances/:name/connection
 */
const getInstanceConnection = asyncHandler(async (req, res) => {
  const { name } = req.params;
  const connection = await instanceController.getInstanceConnection(name);
  res.json(createSuccessResponse({ connection }));
});

/**
 * 인스턴스 삭제
 * DELETE /instances/:name
 */
const deleteInstance = asyncHandler(async (req, res) => {
  const { name } = req.params;
  const result = await instanceController.deleteInstance(name);
  res.json(createSuccessResponse(null, result.message));
});

/**
 * 인스턴스 백업 생성
 * POST /instances/:name/backup
 */
const createBackup = asyncHandler(async (req, res) => {
  const { name } = req.params;
  const instance = req.instance;
  const options = req.backupOptions;

  const backup = await backupController.createBackup(name, instance, options);
  
  res.status(201).json(createSuccessResponse(
    { backup },
    'Backup created successfully'
  ));
});

/**
 * 인스턴스 백업 목록 조회
 * GET /instances/:name/backups
 */
const getInstanceBackups = asyncHandler(async (req, res) => {
  const { name } = req.params;
  const instance = req.instance;

  const result = await backupController.getInstanceBackups(name, instance);
  res.json(createSuccessResponse(result));
});

/**
 * 백업에서 새 인스턴스로 복구
 * POST /instances/:name/restore
 */
const restoreFromBackup = asyncHandler(async (req, res) => {
  const { name } = req.params;
  const instance = req.instance;
  const restoreData = req.body;

  const result = await backupController.restoreFromBackup(name, instance, restoreData);

  res.status(201).json(createSuccessResponse(
    result,
    'Instance restored from backup successfully'
  ));
});

/**
 * 특정 백업 삭제
 * DELETE /instances/:name/backups/:backupName
 */
const deleteBackup = asyncHandler(async (req, res) => {
  const { backupName } = req.params;
  const instance = req.instance;

  const result = await backupController.deleteBackup(backupName, instance);
  res.json(createSuccessResponse(null, result.message));
});

/**
 * 전체 백업 목록 조회 (모든 네임스페이스)
 * GET /instances/system/backups
 */
const getAllBackups = asyncHandler(async (req, res) => {
  const result = await backupController.getAllBackups();
  res.json(createSuccessResponse(result));
});

/**
 * 기존 Helm 릴리스에서 인스턴스 정보 복구
 * POST /instances/recover
 */
const recoverInstance = asyncHandler(async (req, res) => {
  const instance = await instanceController.recoverInstance(req.body);
  res.json(createSuccessResponse(
    { instance },
    'Instance recovered successfully'
  ));
});

// === Routes ===

// 인스턴스 관리 라우트
router.get('/', getAllInstances);
router.post('/', validateCreateInstance, createInstance);
router.get('/:name', checkInstanceExists, getInstanceById);
router.get('/:name/connection', checkInstanceExists, getInstanceConnection);
router.delete('/:name', checkInstanceExists, deleteInstance);

// 백업/복구 라우트
router.post('/:name/backup', checkInstanceExists, validateBackupCreation, createBackup);
router.get('/:name/backups', checkInstanceExists, getInstanceBackups);
router.post('/:name/restore', checkInstanceExists, validateRestoreRequest, restoreFromBackup);
router.delete('/:name/backups/:backupName', checkInstanceExists, deleteBackup);

// 시스템 라우트
router.get('/system/backups', getAllBackups);
router.post('/recover', recoverInstance);

// 에러 핸들링 미들웨어 적용
router.use(errorHandler);

module.exports = router; 