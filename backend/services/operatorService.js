const { execSync } = require('child_process');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

class OperatorService {
  
  // kubectl 환경변수 설정
  getKubectlEnv() {
    return { 
      ...process.env, 
      KUBECONFIG: process.env.HOME + '/.kube/config' 
    };
  }
  
  // PostgreSQL HA 클러스터 생성 (CloudNativePG)
  async createPostgreSQLCluster(instance) {
    const { name, namespace, config = {} } = instance;
    
    const manifest = {
      apiVersion: 'postgresql.cnpg.io/v1',
      kind: 'Cluster',
      metadata: {
        name: `${name}-cluster`,
        namespace: namespace
      },
      spec: {
        instances: config.replicas || 3,  // 기본 3개 노드 HA
        imageName: 'postgres:15',
        
        // PostgreSQL 설정
        postgresql: {
          parameters: {
            max_connections: (config.maxConnections || 200).toString(),
            shared_buffers: config.sharedBuffers || "128MB",
            effective_cache_size: config.effectiveCacheSize || "512MB",
            maintenance_work_mem: "64MB",
            checkpoint_completion_target: "0.9",
            wal_buffers: "16MB"
          }
        },
        
        // 초기 데이터베이스 설정
        bootstrap: {
          initdb: {
            database: config.database || name,
            owner: config.username || 'dbuser',
            secret: {
              name: `${name}-credentials`
            }
          }
        },
        
        // 스토리지 설정
        storage: {
          size: config.storage || '1Gi',
          storageClass: config.storageClass || 'standard'
        },
        
        // 리소스 설정
        resources: {
          requests: {
            memory: config.memory || "256Mi",
            cpu: config.cpu || "250m"
          },
          limits: {
            memory: config.memoryLimit || "512Mi", 
            cpu: config.cpuLimit || "500m"
          }
        }
      }
    };
    
    // Secret 매니페스트
    const secret = {
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: {
        name: `${name}-credentials`,
        namespace: namespace
      },
      type: 'kubernetes.io/basic-auth',
      data: {
        username: Buffer.from(config.username || 'dbuser').toString('base64'),
        password: Buffer.from(config.password || 'defaultpass').toString('base64')
      }
    };
    
    // YAML 파일 생성
    const manifestsDir = path.join(__dirname, '../../k8s/operators');
    if (!fs.existsSync(manifestsDir)) {
      fs.mkdirSync(manifestsDir, { recursive: true });
    }
    
    const manifestPath = path.join(manifestsDir, `${name}-postgres-cluster.yaml`);
    const combinedYaml = yaml.dump(secret) + '---\n' + yaml.dump(manifest);
    fs.writeFileSync(manifestPath, combinedYaml);
    
    try {
      const kubectlEnv = this.getKubectlEnv();
      
      // 네임스페이스 생성
      execSync(`kubectl create namespace ${namespace} --dry-run=client -o yaml | kubectl apply -f -`, { env: kubectlEnv });
      
      // 클러스터 배포
      execSync(`kubectl apply -f "${manifestPath}"`, { env: kubectlEnv });
      
      console.log(`✅ PostgreSQL HA cluster created: ${name}`);
      return {
        success: true,
        type: 'postgresql-ha',
        name: `${name}-cluster`,
        namespace: namespace,
        nodes: config.replicas || 3,
        services: {
          readWrite: `${name}-cluster-rw`,
          readOnly: `${name}-cluster-ro`,
          read: `${name}-cluster-r`,
          any: `${name}-cluster-any`
        }
      };
    } catch (error) {
      console.error(`❌ Failed to create PostgreSQL HA cluster: ${error.message}`);
      throw error;
    }
  }
  

  
  // 클러스터 상태 조회
  async getClusterStatus(name, namespace, type) {
    try {
      let statusCmd;
      const kubectlEnv = this.getKubectlEnv();
      
      if (type === 'postgresql-ha') {
        statusCmd = `kubectl get cluster ${name}-cluster -n ${namespace} -o json`;
      } else if (type === 'mysql-ha') {
        statusCmd = `kubectl get perconaxtradbcluster ${name}-cluster -n ${namespace} -o json`;
      } else {
        throw new Error(`Unsupported cluster type: ${type}`);
      }
      
      const result = execSync(statusCmd, { encoding: 'utf8', env: kubectlEnv });
      const clusterData = JSON.parse(result);
      
      if (type === 'postgresql-ha') {
        return {
          name: clusterData.metadata.name,
          status: clusterData.status.phase,
          instances: clusterData.status.instances,
          readyInstances: clusterData.status.readyInstances,
          primary: clusterData.status.currentPrimary,
          health: clusterData.status.conditions?.find(c => c.type === 'Ready')?.status === 'True'
        };
      } else if (type === 'mysql-ha') {
        return {
          name: clusterData.metadata.name,
          status: clusterData.status?.state || 'unknown',
          pxcSize: clusterData.status?.pxc?.size,
          readyPxc: clusterData.status?.pxc?.ready,
          proxysqlSize: clusterData.status?.proxysql?.size,
          readyProxysql: clusterData.status?.proxysql?.ready
        };
      }
    } catch (error) {
      console.error(`❌ Failed to get cluster status: ${error.message}`);
      return {
        name: name,
        status: 'error',
        error: error.message
      };
    }
  }
  
  // 클러스터 삭제
  async deleteCluster(name, namespace, type) {
    try {
      const kubectlEnv = this.getKubectlEnv();
      const manifestPath = path.join(__dirname, `../../k8s/operators/${name}-${type.replace('-ha', '')}-cluster.yaml`);
      
      if (fs.existsSync(manifestPath)) {
        execSync(`kubectl delete -f "${manifestPath}"`, { env: kubectlEnv });
        fs.unlinkSync(manifestPath);
      } else {
        // 매니페스트 파일이 없으면 직접 삭제
        if (type === 'postgresql-ha') {
          execSync(`kubectl delete cluster ${name}-cluster -n ${namespace}`, { env: kubectlEnv });
          execSync(`kubectl delete secret ${name}-credentials -n ${namespace}`, { env: kubectlEnv });
        } else if (type === 'mysql-ha') {
          execSync(`kubectl delete perconaxtradbcluster ${name}-cluster -n ${namespace}`, { env: kubectlEnv });
          execSync(`kubectl delete secret ${name}-secrets -n ${namespace}`, { env: kubectlEnv });
        }
      }
      
      console.log(`✅ HA cluster deleted: ${name}`);
      return { success: true };
    } catch (error) {
      console.error(`❌ Failed to delete cluster: ${error.message}`);
      throw error;
    }
  }
  
  // Failover 트리거 (테스트용)
  async triggerFailover(name, namespace, type) {
    try {
      const kubectlEnv = this.getKubectlEnv();
      
      if (type === 'postgresql-ha') {
        // Primary Pod 삭제로 Failover 트리거
        const statusCmd = `kubectl get cluster ${name}-cluster -n ${namespace} -o jsonpath='{.status.currentPrimary}'`;
        const currentPrimary = execSync(statusCmd, { encoding: 'utf8', env: kubectlEnv });
        
        execSync(`kubectl delete pod ${currentPrimary} -n ${namespace}`, { env: kubectlEnv });
        console.log(`🔄 Triggered failover by deleting primary: ${currentPrimary}`);
        
        return {
          success: true,
          action: 'failover_triggered',
          deletedPrimary: currentPrimary,
          message: 'New primary will be elected automatically'
        };
      } else {
        throw new Error(`Failover not supported for type: ${type}`);
      }
    } catch (error) {
      console.error(`❌ Failed to trigger failover: ${error.message}`);
      throw error;
    }
  }

  // 모든 클러스터 조회 (Kubernetes에서 직접)
  async getAllClusters(type = 'postgresql-ha') {
    try {
      if (type === 'postgresql-ha') {
        // CloudNativePG 클러스터 조회
        const result = execSync('kubectl get clusters.postgresql.cnpg.io -A -o json', { 
          env: this.getKubectlEnv(),
          encoding: 'utf8'
        });
        
        const data = JSON.parse(result);
        return data.items.map(cluster => ({
          name: cluster.metadata.name.replace('-cluster', ''),
          namespace: cluster.metadata.namespace,
          type: 'postgresql-ha',
          status: cluster.status?.phase || 'Unknown',
          replicas: cluster.spec?.instances || 3,
          metadata: {
            clusterType: 'postgresql-ha',
            operator: 'cloudnativepg'
          }
        }));
      }
      
      return [];
    } catch (error) {
      console.error(`❌ Failed to get all clusters: ${error.message}`);
      return [];
    }
  }
}

module.exports = new OperatorService(); 