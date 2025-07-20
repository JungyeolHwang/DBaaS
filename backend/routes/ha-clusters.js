const express = require('express');
const router = express.Router();
const HAClusterController = require('../controllers/HAClusterController');

const haClusterController = new HAClusterController();

/**
 * Zalando PostgreSQL HA 클러스터 생성
 * POST /ha-clusters/zalando-postgresql
 */
router.post('/zalando-postgresql', (req, res) => {
  haClusterController.createZalandoCluster(req, res);
});

/**
 * HA 클러스터 목록 조회 (Zalando 전용)
 * GET /ha-clusters
 */
router.get('/', (req, res) => {
  haClusterController.getAllClusters(req, res);
});

/**
 * HA 클러스터 상태 조회 (Zalando 전용)
 * GET /ha-clusters/:name/status
 */
router.get('/:name/status', (req, res) => {
  haClusterController.getClusterStatus(req, res);
});

/**
 * HA 클러스터 삭제 (Zalando 전용)
 * DELETE /ha-clusters/:name
 */
router.delete('/:name', (req, res) => {
  haClusterController.deleteCluster(req, res);
});

module.exports = router; 