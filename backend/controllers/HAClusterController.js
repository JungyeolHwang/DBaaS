const ZalandoOperatorService = require('../services/zalandoOperatorService');
const DatabaseService = require('../services/database');
const { createSuccessResponse, createErrorResponse } = require('../utils/response');

class HAClusterController {
  constructor() {
    this.zalandoOperatorService = new ZalandoOperatorService();
    this.databaseService = new DatabaseService();
  }

  /**
   * Zalando PostgreSQL HA 클러스터 생성
   */
  async createZalandoCluster(req, res) {
    try {
      const { name, namespace, config = {} } = req.body;

      if (!name || !namespace) {
        return res.status(400).json(
          createErrorResponse('Name and namespace are required')
        );
      }

      console.log(`🐘 Creating Zalando PostgreSQL HA cluster: ${name}`);

      // Zalando Operator로 클러스터 생성
      const cluster = await this.zalandoOperatorService.createPostgreSQLHA(name, namespace, config);

      // 메타데이터 DB에 저장 시도
      try {
        await this.databaseService.createInstance({
          name: `${name}-cluster`,
          type: 'zalando-postgresql-ha',
          status: 'creating',
          namespace: namespace,
          config: {
            ...config,
            nodes: cluster.nodes,
            services: cluster.services
          }
        });
        console.log(`✅ HA cluster metadata saved successfully`);
      } catch (dbError) {
        console.warn(`⚠️ Failed to save cluster metadata:`, dbError.message);
      }

      res.status(201).json(
        createSuccessResponse('Zalando PostgreSQL HA cluster creation started', {
          cluster,
          name: cluster.name,
          namespace: cluster.namespace,
          nodes: cluster.nodes,
          services: cluster.services
        })
      );

    } catch (error) {
      console.error('❌ Failed to create Zalando PostgreSQL HA cluster:', error.message);
      res.status(500).json(
        createErrorResponse('Failed to create Zalando PostgreSQL HA cluster', error.message)
      );
    }
  }

  /**
   * HA 클러스터 목록 조회
   */
  async getAllClusters(req, res) {
    try {
      let clusters = [];
      
      try {
        clusters = await this.databaseService.getInstancesByType('zalando-postgresql-ha');
      } catch (dbError) {
        console.warn('⚠️ Failed to retrieve HA clusters from metadata DB:', dbError.message);
        console.log('🔄 Retrieving clusters directly from Kubernetes...');
        
        // 메타데이터 DB가 없어도 Kubernetes에서 직접 조회
        clusters = await this.zalandoOperatorService.getAllClusters();
      }
      
      res.json(
        createSuccessResponse(
          {
            count: clusters.length,
            clusters: clusters
          },
          'HA clusters retrieved successfully'
        )
      );
    } catch (error) {
      console.error('❌ Failed to get HA clusters:', error.message);
      res.status(500).json(
        createErrorResponse('Failed to retrieve HA clusters', error.message)
      );
    }
  }

  /**
   * HA 클러스터 상태 조회
   */
  async getClusterStatus(req, res) {
    try {
      const { name } = req.params;
      
      // DB에서 클러스터 정보 조회 (안전한 처리)
      let clusterInfo = null;
      let namespace = `dbaas-${name}-ha`; // 기본 네임스페이스
      
      try {
        clusterInfo = await this.databaseService.getInstance(`${name}-cluster`);
        if (clusterInfo) {
          namespace = clusterInfo.namespace;
        }
      } catch (dbError) {
        console.warn('⚠️ Failed to retrieve cluster info from metadata DB:', dbError.message);
        console.log('🔄 Retrieving cluster status directly from Kubernetes...');
      }

      // Zalando Operator를 통해 실시간 상태 조회
      const status = await this.zalandoOperatorService.getClusterStatus(name, namespace);

      if (!status) {
        return res.status(404).json(
          createErrorResponse('Cluster not found')
        );
      }

      res.json(
        createSuccessResponse(
          'HA cluster status retrieved successfully',
          {
            cluster: {
              name: `${name}-cluster`,
              namespace: namespace,
              status: status.status,
              replicas: status.replicas,
              ready: status.ready,
              connections: clusterInfo?.config?.services || {
                master: `${name}-cluster:5432`,
                replica: `${name}-cluster-repl:5432`
              }
            }
          }
        )
      );
    } catch (error) {
      console.error('❌ Failed to get cluster status:', error.message);
      res.status(500).json(
        createErrorResponse('Failed to get cluster status', error.message)
      );
    }
  }

  /**
   * HA 클러스터 삭제
   */
  async deleteCluster(req, res) {
    try {
      const { name } = req.params;
      
      // DB에서 클러스터 정보 조회 (안전한 처리)
      let clusterInfo = null;
      let namespace = `dbaas-${name}-ha`; // 기본 네임스페이스
      
      try {
        clusterInfo = await this.databaseService.getInstance(`${name}-cluster`);
        if (clusterInfo) {
          namespace = clusterInfo.namespace;
        }
      } catch (dbError) {
        console.warn('⚠️ Failed to retrieve cluster info from metadata DB:', dbError.message);
        console.log('🔄 Deleting cluster directly from Kubernetes...');
      }

      // Zalando Operator를 통해 클러스터 삭제
      await this.zalandoOperatorService.deletePostgreSQLHA(name, namespace);

      // DB에서 클러스터 정보 삭제 (안전한 처리)
      try {
        await this.databaseService.deleteInstance(`${name}-cluster`);
        console.log('✅ HA cluster metadata deleted successfully');
      } catch (dbError) {
        console.warn('⚠️ Failed to delete HA cluster metadata:', dbError.message);
        console.log('🔄 HA cluster deleted from Kubernetes successfully');
      }

      res.json(
        createSuccessResponse(
          'HA cluster deleted successfully',
          {
            name: `${name}-cluster`,
            namespace: namespace
          }
        )
      );
    } catch (error) {
      console.error('❌ Failed to delete HA cluster:', error.message);
      res.status(500).json(
        createErrorResponse('Failed to delete HA cluster', error.message)
      );
    }
  }
}

module.exports = HAClusterController; 