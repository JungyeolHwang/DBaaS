const BackupService = require('../services/backup');
const K8sService = require('../services/k8s');
const DatabaseService = require('../services/database');

class BackupController {
  constructor() {
    this.backupService = new BackupService();
    this.k8sService = new K8sService();
    this.dbService = new DatabaseService();
  }

  /**
   * 인스턴스 백업 생성
   */
  async createBackup(name, instance, options) {
    // 인스턴스 상태 확인
    const status = await this.k8sService.getInstanceStatus(name, instance.namespace);
    
    if (!status.pods || status.pods.length === 0) {
      throw new Error('No pods found for instance');
    }

    console.log(`Creating backup for instance ${name}. Pod status:`, status.pods);

    const backupResult = await this.backupService.createBackup(name, instance.namespace, options);
    
    return backupResult;
  }

  /**
   * 인스턴스 백업 목록 조회
   */
  async getInstanceBackups(name, instance) {
    const backups = await this.backupService.listBackups(instance.namespace);
    
    // 해당 인스턴스의 백업만 필터링
    const instanceBackups = backups.filter(backup => 
      backup.sourcePVC && backup.sourcePVC.includes(name)
    );
    
    return {
      count: instanceBackups.length,
      backups: instanceBackups
    };
  }

  /**
   * 백업에서 새 인스턴스로 복구
   */
  async restoreFromBackup(sourceInstanceName, instance, restoreData) {
    const { backupName, newInstanceName, size } = restoreData;

    // 새 인스턴스 이름 중복 확인
    const existingNewInstance = await this.dbService.getInstance(newInstanceName);
    if (existingNewInstance) {
      throw new Error('New instance name already exists');
    }

    const options = {
      size: size || instance.config.storage || '1Gi'
    };

    try {
      // 백업에서 복구
      const restoreResult = await this.backupService.restoreFromBackup(
        backupName,
        instance.namespace,
        newInstanceName,
        options
      );

      // 새 인스턴스 정보 생성
      const newInstance = {
        name: newInstanceName,
        type: instance.type,
        config: { ...instance.config, storage: options.size },
        status: 'restoring',
        namespace: restoreResult.namespace,
        metadata: {
          restoredFrom: {
            sourceInstance: sourceInstanceName,
            backupName: backupName,
            restoredAt: restoreResult.restoredAt
          }
        }
      };

      // 인스턴스 정보를 DB에 저장
      await this.dbService.createInstance(newInstance);

      // 복구된 PVC를 사용하여 DB 인스턴스 재배포
      const deploymentConfig = {
        ...newInstance,
        config: {
          ...newInstance.config,
          useExistingPVC: restoreResult.pvcName
        }
      };

      // Kubernetes에 배포 (복구된 PVC 사용)
      await this.k8sService.createInstanceFromPVC(deploymentConfig, restoreResult.pvcName);

      return {
        instance: newInstance,
        restore: restoreResult
      };
    } catch (error) {
      // 실패 시 새 인스턴스 정보 제거
      try {
        await this.dbService.deleteInstance(newInstanceName);
        console.log(`✅ Cleaned up failed restored instance: ${newInstanceName}`);
      } catch (deleteError) {
        console.warn(`Failed to cleanup restored instance ${newInstanceName}:`, deleteError.message);
      }
      throw error;
    }
  }

  /**
   * 특정 백업 삭제
   */
  async deleteBackup(backupName, instance) {
    await this.backupService.deleteBackup(backupName, instance.namespace);
    
    return { message: 'Backup deleted successfully' };
  }

  /**
   * 전체 백업 목록 조회 (모든 네임스페이스)
   */
  async getAllBackups() {
    const backups = await this.backupService.listBackups();
    
    return {
      count: backups.length,
      backups: backups
    };
  }
}

module.exports = BackupController; 