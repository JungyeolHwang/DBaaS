const { execSync, exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const os = require('os');
const portForwardService = require('./portforward');

// kubectl 환경변수 설정
const execAsync = promisify(exec);
const kubeconfigPath = path.join(os.homedir(), '.kube', 'config');

// 환경변수 확인 및 설정
console.log('KUBECONFIG Path:', kubeconfigPath);
console.log('Home Directory:', os.homedir());

const execOptions = {
  env: {
    ...process.env,
    KUBECONFIG: kubeconfigPath,
    PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin'
  },
  cwd: process.cwd(),
  shell: true
};

class K8sService {
  constructor() {
    this.namespace = 'dbaas';
    this.helmRepo = 'bitnami';
  }

  // Helm을 사용하여 DB 인스턴스 생성
  async createInstance(instance) {
    const { name, type, namespace } = instance;
    
    try {
      console.log(`Creating instance: ${name} (${type})`);
      
      // 네임스페이스 생성
      await this.createNamespace(namespace);
      
      // Helm 차트에 따른 설치 명령 생성
      const helmCommand = this.generateHelmCommand(instance);
      
      console.log(`Executing: ${helmCommand}`);
      const { stdout, stderr } = await execAsync(helmCommand, execOptions);
      
      if (stderr && !stderr.includes('WARNING')) {
        throw new Error(`Helm deployment failed: ${stderr}`);
      }
      
      console.log(`Instance ${name} created successfully`);
      return { success: true, output: stdout };
    } catch (error) {
      console.error(`Failed to create instance ${name}:`, error.message);
      throw error;
    }
  }

  // Helm 명령어 생성
  generateHelmCommand(instance) {
    const { name, type, namespace, config = {} } = instance;
    
    let chartPath;
    let values = [];
    
    // 로컬 차트 경로 설정
    const chartBasePath = path.join(__dirname, '../../helm-charts');
    
    switch (type) {
      case 'postgresql':
        chartPath = path.join(chartBasePath, 'postgresql-local');
        values = [
          `--set auth.postgresPassword=${config.password || 'defaultpassword'}`,
          `--set auth.database=${config.database || name}`,
          `--set persistence.size=${config.storage || '1Gi'}`,
          `--set resources.requests.memory=${config.memory || '256Mi'}`,
          `--set resources.requests.cpu=${config.cpu || '250m'}`
        ];
        break;
        
      case 'mysql':
        chartPath = path.join(chartBasePath, 'mysql-local');
        values = [
          `--set auth.rootPassword=${config.password || 'defaultpassword'}`,
          `--set auth.database=${config.database || name}`,
          `--set persistence.size=${config.storage || '1Gi'}`,
          `--set resources.requests.memory=${config.memory || '256Mi'}`,
          `--set resources.requests.cpu=${config.cpu || '250m'}`
        ];
        break;
        
      case 'mariadb':
        chartPath = path.join(chartBasePath, 'mariadb-local');
        values = [
          `--set auth.rootPassword=${config.password || 'defaultpassword'}`,
          `--set auth.database=${config.database || name}`,
          `--set persistence.size=${config.storage || '1Gi'}`,
          `--set resources.requests.memory=${config.memory || '256Mi'}`,
          `--set resources.requests.cpu=${config.cpu || '250m'}`
        ];
        break;
        
      default:
        throw new Error(`Unsupported database type: ${type}`);
    }
    
    const valuesString = values.join(' ');
    return `helm install ${name} "${chartPath}" --namespace ${namespace} --create-namespace ${valuesString}`;
  }

  // 네임스페이스 생성
  async createNamespace(namespace) {
      try {
        // 먼저 네임스페이스가 존재하는지 확인
        const checkCommand = `kubectl get namespace ${namespace}`;
        await execAsync(checkCommand, execOptions);
        console.log(`Namespace ${namespace} already exists`);
      } catch (error) {
        // 네임스페이스가 없으면 생성
        try {
          const createCommand = `kubectl create namespace ${namespace}`;
          await execAsync(createCommand, execOptions);
          console.log(`Namespace ${namespace} created successfully`);
        } catch (createError) {
          if (!createError.message.includes('already exists')) {
            throw createError;
          }
        }
      }
  }

  // 인스턴스 삭제
  async deleteInstance(name) {
    try {
      console.log(`Deleting instance: ${name}`);
      
      const namespace = `dbaas-${name}`;
      
      // Helm 릴리스 삭제
      const helmCommand = `helm uninstall ${name} --namespace ${namespace}`;
      await execAsync(helmCommand, execOptions);
      
      // 네임스페이스 삭제 (선택사항)
      const nsCommand = `kubectl delete namespace ${namespace} --ignore-not-found=true`;
      await execAsync(nsCommand, execOptions);
      
      console.log(`Instance ${name} deleted successfully`);
      return { success: true };
    } catch (error) {
      console.error(`Failed to delete instance ${name}:`, error.message);
      throw error;
    }
  }

  // 인스턴스 상태 조회
  async getInstanceStatus(name) {
    try {
      const namespace = `dbaas-${name}`;
      
      // Helm 릴리스 상태 확인
      const helmCommand = `helm status ${name} --namespace ${namespace} -o json`;
      const { stdout } = await execAsync(helmCommand, execOptions);
      const helmStatus = JSON.parse(stdout);
      
      // Pod 상태 확인
      const podCommand = `kubectl get pods -n ${namespace} -l app.kubernetes.io/instance=${name} -o json`;
      const { stdout: podOutput } = await execAsync(podCommand, execOptions);
      const podStatus = JSON.parse(podOutput);
      
      return {
        helmStatus: helmStatus.info.status,
        podCount: podStatus.items.length,
        pods: podStatus.items.map(pod => ({
          name: pod.metadata.name,
          status: pod.status.phase,
          ready: pod.status.conditions?.find(c => c.type === 'Ready')?.status === 'True'
        }))
      };
    } catch (error) {
      console.error(`Failed to get status for instance ${name}:`, error.message);
      return {
        helmStatus: 'unknown',
        error: error.message
      };
    }
  }

  // 연결 정보 조회 (자동 포트 포워딩 포함)
  async getConnectionInfo(name) {
    try {
      const namespace = `dbaas-${name}`;
      
      // 서비스 정보 조회
      const serviceCommand = `kubectl get svc -n ${namespace} -l app.kubernetes.io/instance=${name} -o json`;
      const { stdout } = await execAsync(serviceCommand, execOptions);
      const services = JSON.parse(stdout);
      
      if (services.items.length === 0) {
        throw new Error('No services found for instance');
      }
      
      const service = services.items[0];
      const serviceName = service.metadata.name;
      const targetPort = service.spec.ports[0].port;
      
      // 기존 포트 포워딩이 있는지 확인
      let portInfo = portForwardService.getConnectionInfo(name);
      
      if (!portInfo) {
        // 포트 포워딩이 없으면 새로 시작
        console.log(`Starting automatic port forwarding for ${name}...`);
        const forwardInfo = await portForwardService.startPortForward(name, namespace, serviceName, targetPort);
        portInfo = {
          host: 'localhost',
          port: forwardInfo.localPort,
          targetPort: targetPort,
          namespace: namespace,
          serviceName: serviceName,
          status: 'active'
        };
      }
      
      return {
        type: 'AutoPortForward',
        host: portInfo.host,
        port: portInfo.port,
        targetPort: portInfo.targetPort,
        serviceName: serviceName,
        namespace: namespace,
        status: portInfo.status,
        note: `Automatically port forwarded to localhost:${portInfo.port}. Ready for DBeaver connection!`
      };
    } catch (error) {
      console.error(`Failed to get connection info for instance ${name}:`, error.message);
      throw error;
    }
  }

  // Helm 레포지토리 초기화 (로컬 차트 사용 시 필요 없음)
  async initHelmRepos() {
    try {
      console.log('Using local Helm charts - no remote repository setup needed');
      
      // 로컬 차트 경로 확인
      const chartBasePath = path.join(__dirname, '../../helm-charts');
      const chartPaths = ['postgresql-local', 'mysql-local', 'mariadb-local'];
      
      for (const chartName of chartPaths) {
        const chartPath = path.join(chartBasePath, chartName);
        try {
          // 차트가 존재하는지 확인
          await execAsync(`ls "${chartPath}/Chart.yaml"`, execOptions);
          console.log(`✓ Local chart found: ${chartName}`);
        } catch (error) {
          console.warn(`⚠ Local chart missing: ${chartName}`);
        }
      }
      
      console.log('Local Helm charts verification completed');
    } catch (error) {
      console.error('Failed to verify local Helm charts:', error.message);
      throw error;
    }
  }

  // 기존 PVC를 사용하여 인스턴스 생성 (복구용)
  async createInstanceFromPVC(instance, existingPVCName) {
    try {
      const { name, type, namespace, config = {} } = instance;
      
      console.log(`Creating instance ${name} from existing PVC: ${existingPVCName}`);
      
      // 1. 네임스페이스가 존재하는지 확인
      await this.ensureNamespace(namespace);
      
      // 2. Helm 차트 배포 (기존 PVC 사용)
      const helmCommand = this.generateHelmCommandWithPVC(instance, existingPVCName);
      console.log(`Executing: ${helmCommand}`);
      
      const output = execSync(helmCommand, execOptions);
      console.log(`Helm install output: ${output}`);
      
      console.log(`✅ Instance ${name} created from existing PVC successfully`);
      return { success: true, message: `Instance ${name} restored` };
      
    } catch (error) {
      console.error(`Failed to create instance ${instance.name} from PVC:`, error.message);
      throw error;
    }
  }

  // 기존 PVC를 사용하는 Helm 명령어 생성
  generateHelmCommandWithPVC(instance, existingPVCName) {
    const { name, type, namespace, config = {} } = instance;
    
    let chartPath;
    let values = [];
    
    // 로컬 차트 경로 설정
    const chartBasePath = path.join(__dirname, '../../helm-charts');
    
    switch (type) {
      case 'postgresql':
        chartPath = path.join(chartBasePath, 'postgresql-local');
        values = [
          `--set auth.postgresPassword=${config.password || 'defaultpassword'}`,
          `--set auth.database=${config.database || name}`,
          `--set persistence.enabled=false`,  // PVC 자동 생성 비활성화
          `--set persistence.existingClaim=${existingPVCName}`,  // 기존 PVC 사용
          `--set resources.requests.memory=${config.memory || '256Mi'}`,
          `--set resources.requests.cpu=${config.cpu || '250m'}`
        ];
        break;
        
      case 'mysql':
        chartPath = path.join(chartBasePath, 'mysql-local');
        values = [
          `--set auth.rootPassword=${config.password || 'defaultpassword'}`,
          `--set auth.database=${config.database || name}`,
          `--set persistence.enabled=false`,  // PVC 자동 생성 비활성화
          `--set persistence.existingClaim=${existingPVCName}`,  // 기존 PVC 사용
          `--set resources.requests.memory=${config.memory || '256Mi'}`,
          `--set resources.requests.cpu=${config.cpu || '250m'}`
        ];
        break;
        
      case 'mariadb':
        chartPath = path.join(chartBasePath, 'mariadb-local');
        values = [
          `--set auth.rootPassword=${config.password || 'defaultpassword'}`,
          `--set auth.database=${config.database || name}`,
          `--set persistence.enabled=false`,  // PVC 자동 생성 비활성화
          `--set persistence.existingClaim=${existingPVCName}`,  // 기존 PVC 사용
          `--set resources.requests.memory=${config.memory || '256Mi'}`,
          `--set resources.requests.cpu=${config.cpu || '250m'}`
        ];
        break;
        
      default:
        throw new Error(`Unsupported database type: ${type}`);
    }
    
    const valuesString = values.join(' ');
    return `helm install ${name} "${chartPath}" --namespace ${namespace} --create-namespace ${valuesString}`;
  }

  // 네임스페이스 존재 확인 및 생성
  async ensureNamespace(namespace) {
    try {
      // 네임스페이스 존재 확인
      execSync(`kubectl get namespace ${namespace}`, execOptions);
      console.log(`✅ Namespace ${namespace} already exists`);
    } catch (error) {
      // 네임스페이스가 없으면 생성
      console.log(`Creating namespace: ${namespace}`);
      execSync(`kubectl create namespace ${namespace}`, execOptions);
      console.log(`✅ Namespace ${namespace} created`);
    }
  }

  /**
   * Helm 릴리스 상태를 확인합니다
   */
  async getHelmReleaseStatus(releaseName, namespace) {
    try {
      const command = `helm status ${releaseName} -n ${namespace} --output json`;
      const output = execSync(command, execOptions);
      const status = JSON.parse(output.toString());
      return status;
    } catch (error) {
      console.warn(`Helm release ${releaseName} not found in namespace ${namespace}`);
      return null;
    }
  }
}

module.exports = K8sService; 