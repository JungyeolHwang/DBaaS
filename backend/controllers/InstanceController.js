const K8sService = require('../services/k8s');
const DatabaseService = require('../services/database');

class InstanceController {
  constructor() {
    this.k8sService = new K8sService();
    this.dbService = new DatabaseService();
    this.metadataEnabled = false; // 임시로 메타데이터 DB 비활성화
  }

  /**
   * 인스턴스 상태 업데이트
   */
  async updateInstanceStatus(instance) {
    try {
      const status = await this.k8sService.getInstanceStatus(instance.name, instance.namespace);
      
      const updatedData = {
        status: status.status,
        metadata: { 
          ...instance.metadata, 
          pods: status.pods,
          services: status.services 
        }
      };
      
      await this.dbService.updateInstance(instance.name, updatedData);
      
      // 인스턴스 객체에 업데이트된 정보 반영
      Object.assign(instance, updatedData);
      
      return instance;
    } catch (error) {
      console.warn(`Failed to get status for ${instance.name}:`, error.message);
      return instance;
    }
  }

  /**
   * 인스턴스 정리 (생성 실패 시)
   */
  async cleanupFailedInstance(instanceName) {
    try {
      await this.dbService.deleteInstance(instanceName);
      console.log(`✅ Cleaned up failed instance: ${instanceName}`);
    } catch (deleteError) {
      console.warn(`Failed to cleanup instance ${instanceName}:`, deleteError.message);
    }
  }

  /**
   * 모든 인스턴스 목록 조회 (안전한 처리)
   */
  async getAllInstances() {
    let instanceList = [];
    
    try {
      instanceList = await this.dbService.getAllInstances();
    } catch (dbError) {
      console.warn('⚠️ Failed to retrieve instances from metadata DB:', dbError.message);
      console.log('🔄 Retrieving instances directly from Kubernetes...');
      
      // 메타데이터 DB가 없어도 Kubernetes에서 직접 조회
      try {
        instanceList = await this.k8sService.getAllInstances();
      } catch (k8sError) {
        console.error('❌ Failed to retrieve instances from Kubernetes:', k8sError.message);
        instanceList = [];
      }
    }
    
    // 상태 업데이트 병렬 처리
    await Promise.allSettled(
      instanceList.map(instance => this.updateInstanceStatus(instance))
    );

    return {
      count: instanceList.length,
      instances: instanceList
    };
  }

  /**
   * 새 인스턴스 생성
   */
  async createInstance(instanceData) {
    const { type, name, config } = instanceData;
    
    // 중복 인스턴스 확인 (안전한 처리)
    try {
      const existingInstance = await this.dbService.getInstance(name);
      if (existingInstance) {
        throw new Error('Instance name already exists');
      }
    } catch (dbError) {
      console.warn('⚠️ Failed to check existing instance in metadata DB:', dbError.message);
      console.log('🔄 Proceeding with instance creation...');
    }

    const instance = {
      name,
      type,
      config,
      status: 'creating',
      namespace: `dbaas-${name}`,
      metadata: {}
    };

    try {
      // Kubernetes에 배포 (우선 실행)
      await this.k8sService.createInstance(instance);

      // 인스턴스 정보를 DB에 저장 (안전한 처리)
      try {
        await this.dbService.createInstance(instance);
        console.log('✅ Instance metadata saved successfully');
      } catch (dbError) {
        console.warn('⚠️ Failed to save instance metadata:', dbError.message);
        console.log('🔄 Instance created successfully, metadata storage skipped');
      }

      return instance;
    } catch (error) {
      // 실패 시 인스턴스 정보 제거 (안전한 처리)
      try {
        await this.cleanupFailedInstance(name);
      } catch (cleanupError) {
        console.warn('Failed to cleanup failed instance:', cleanupError.message);
      }
      throw error;
    }
  }

  /**
   * 특정 인스턴스 상태 조회
   */
  async getInstanceById(name) {
    const instance = await this.dbService.getInstance(name);
    
    if (!instance) {
      throw new Error('Instance not found');
    }
    
    // 실시간 상태 조회 및 업데이트
    await this.updateInstanceStatus(instance);

    return instance;
  }

  /**
   * 인스턴스 연결 정보 조회
   */
  async getInstanceConnection(name) {
    const instance = await this.dbService.getInstance(name);
    
    if (!instance) {
      throw new Error('Instance not found');
    }

    const connectionInfo = await this.k8sService.getConnectionInfo(name, instance.namespace, instance.type);
    
    return connectionInfo;
  }

  /**
   * 인스턴스 삭제
   */
  async deleteInstance(name) {
    const instance = await this.dbService.getInstance(name);
    
    if (!instance) {
      throw new Error('Instance not found');
    }

    // Kubernetes에서 삭제
    await this.k8sService.deleteInstance(instance);
    
    // DB에서 제거
    await this.dbService.deleteInstance(name);

    return { message: 'Instance deleted successfully' };
  }

  /**
   * 기존 Helm 릴리스에서 인스턴스 정보 복구
   */
  async recoverInstance(recoveryData) {
    const { name, namespace } = recoveryData;
    
    if (!name || !namespace) {
      throw new Error('Name and namespace are required');
    }

    // Helm 릴리스가 존재하는지 확인
    const helmStatus = await this.k8sService.getHelmReleaseStatus(name, namespace);
    if (!helmStatus) {
      throw new Error('Helm release not found');
    }

    // 인스턴스 타입 감지 (현재는 PostgreSQL만 지원)
    const type = 'postgresql';

    const instance = {
      name,
      type,
      config: {
        password: 'recovered', // 실제 비밀번호는 보안상 표시하지 않음
        storage: '2Gi' // 기본값
      },
      status: 'running',
      namespace,
      metadata: {
        recovered: true
      }
    };

    // DB에 등록
    await this.dbService.createInstance(instance);

    return instance;
  }
}

module.exports = InstanceController; 