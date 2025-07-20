const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

class ZalandoOperatorService {
  constructor() {
    this.kubectl = 'kubectl';
  }

  getKubectlEnv() {
    return {
      ...process.env,
      KUBECONFIG: process.env.KUBECONFIG || `${process.env.HOME}/.kube/config`
    };
  }

  async createPostgreSQLHA(name, namespace, config) {
    console.log(`🐘 Creating Zalando PostgreSQL HA cluster: ${name}`);
    
    try {
      // Zalando PostgreSQL 클러스터 매니페스트
      const manifest = {
        apiVersion: 'acid.zalan.do/v1',
        kind: 'postgresql',
        metadata: {
          name: `${name}-cluster`,
          namespace: namespace
        },
        spec: {
          teamId: 'dbaas',
          volume: {
            size: config.storage || '1Gi'
          },
          numberOfInstances: config.replicas || 3,
          users: {
            [config.username || 'admin']: ['superuser', 'createdb']
          },
          databases: {
            [config.database || name]: config.username || 'admin'
          },
          postgresql: {
            version: "15",
            parameters: {
              max_connections: (config.maxConnections || 200).toString(),
              shared_buffers: config.sharedBuffers || "128MB",
              effective_cache_size: config.effectiveCacheSize || "512MB"
            }
          },
          resources: {
            requests: {
              cpu: config.cpu || "250m",
              memory: config.memory || "256Mi"
            },
            limits: {
              cpu: config.cpuLimit || "500m", 
              memory: config.memoryLimit || "512Mi"
            }
          }
        }
      };

      // Secret for password
      const secret = {
        apiVersion: 'v1',
        kind: 'Secret',
        metadata: {
          name: `${config.username || 'admin'}.${name}-cluster.credentials.postgresql.acid.zalan.do`,
          namespace: namespace
        },
        type: 'Opaque',
        data: {
          username: Buffer.from(config.username || 'admin').toString('base64'),
          password: Buffer.from(config.password || 'defaultpass').toString('base64')
        }
      };

      // YAML 파일 생성
      const manifestsDir = path.join(__dirname, '../../k8s/operators');
      if (!fs.existsSync(manifestsDir)) {
        fs.mkdirSync(manifestsDir, { recursive: true });
      }

      const manifestPath = path.join(manifestsDir, `${name}-zalando-cluster.yaml`);
      const combinedYaml = yaml.dump(secret) + '---\n' + yaml.dump(manifest);
      fs.writeFileSync(manifestPath, combinedYaml);

      const kubectlEnv = this.getKubectlEnv();
      
      // 네임스페이스 생성
      execSync(`kubectl create namespace ${namespace} --dry-run=client -o yaml | kubectl apply -f -`, { env: kubectlEnv });
      
      // 클러스터 배포
      execSync(`kubectl apply -f "${manifestPath}"`, { env: kubectlEnv });
      
      console.log(`✅ Zalando PostgreSQL HA cluster created: ${name}`);
      return {
        success: true,
        type: 'zalando-postgresql-ha',
        name: `${name}-cluster`,
        namespace: namespace,
        nodes: config.replicas || 3,
        services: {
          master: `${name}-cluster`,
          replica: `${name}-cluster-repl`
        }
      };

    } catch (error) {
      console.error(`❌ Failed to create Zalando PostgreSQL HA cluster:`, error.message);
      throw error;
    }
  }

  async deletePostgreSQLHA(name, namespace) {
    console.log(`🗑️ Deleting Zalando PostgreSQL HA cluster: ${name}`);
    
    try {
      const kubectlEnv = this.getKubectlEnv();
      
      // 클러스터 삭제
      execSync(`kubectl delete postgresql ${name}-cluster -n ${namespace}`, { env: kubectlEnv });
      
      // Secret 삭제
      try {
        execSync(`kubectl delete secret -l cluster-name=${name}-cluster -n ${namespace}`, { env: kubectlEnv });
      } catch (e) {
        // Secret이 없어도 계속 진행
      }
      
      console.log(`✅ Zalando PostgreSQL HA cluster deleted: ${name}`);
      return { success: true };
      
    } catch (error) {
      console.error(`❌ Failed to delete Zalando PostgreSQL HA cluster:`, error.message);
      throw error;
    }
  }

  async getClusterStatus(name, namespace) {
    try {
      const kubectlEnv = this.getKubectlEnv();
      const output = execSync(`kubectl get postgresql ${name}-cluster -n ${namespace} -o json`, { 
        env: kubectlEnv,
        encoding: 'utf8' 
      });
      
      const cluster = JSON.parse(output);
      return {
        name: cluster.metadata.name,
        namespace: cluster.metadata.namespace,
        status: cluster.status?.PostgresClusterStatus || 'Unknown',
        replicas: cluster.spec.numberOfInstances,
        ready: cluster.status?.instances || 0
      };
      
    } catch (error) {
      console.error(`❌ Failed to get cluster status:`, error.message);
      return null;
    }
  }

  async getAllClusters() {
    try {
      const kubectlEnv = this.getKubectlEnv();
      const output = execSync('kubectl get postgresql --all-namespaces -o json', { 
        env: kubectlEnv,
        encoding: 'utf8' 
      });
      
      const result = JSON.parse(output);
      return result.items.map(cluster => ({
        name: cluster.metadata.name,
        namespace: cluster.metadata.namespace,
        status: cluster.status?.PostgresClusterStatus || 'Unknown',
        replicas: cluster.spec.numberOfInstances,
        ready: cluster.status?.instances || 0
      }));
      
    } catch (error) {
      console.error(`❌ Failed to get all clusters:`, error.message);
      return [];
    }
  }
}

module.exports = ZalandoOperatorService; 