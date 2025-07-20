const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');
const os = require('os');

class BackupService {
  constructor() {
    const kubeconfigPath = path.join(os.homedir(), '.kube', 'config');
    this.execOptions = {
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf8',
      timeout: 300000, // 5분 타임아웃
      env: {
        ...process.env,
        KUBECONFIG: kubeconfigPath,
        PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin'
      },
      cwd: process.cwd(),
      shell: true
    };
  }

  /**
   * 인스턴스의 백업을 생성합니다
   * @param {string} instanceName - 인스턴스 이름
   * @param {string} namespace - 네임스페이스
   * @param {Object} options - 백업 옵션
   * @returns {Object} 백업 정보
   */
  async createBackup(instanceName, namespace, options = {}) {
    try {
      const backupName = options.backupName || `${instanceName}-backup-${Date.now()}`;
      const instanceType = options.instanceType || this.detectInstanceType(instanceName, namespace);
      const pvcName = this.getPVCName(instanceName, instanceType);
      
      console.log(`Creating backup for instance: ${instanceName} (${instanceType}) in namespace: ${namespace}`);
      
      // PVC가 존재하는지 확인
      await this.verifyPVCExists(pvcName, namespace);
      
      // VolumeSnapshot 생성
      const snapshotManifest = this.createVolumeSnapshotManifest(
        backupName,
        namespace,
        pvcName,
        options
      );
      
      // 임시 YAML 파일 생성
      const tempFile = `/tmp/${backupName}-snapshot.yaml`;
      fs.writeFileSync(tempFile, yaml.dump(snapshotManifest));
      
      try {
        // VolumeSnapshot 생성
        execSync(`kubectl apply -f "${tempFile}"`, this.execOptions);
        console.log(`✅ VolumeSnapshot created: ${backupName}`);
        
        // 스냅샷이 Ready 상태가 될 때까지 대기
        await this.waitForSnapshotReady(backupName, namespace);
        
        // 백업 정보 반환
        const backupInfo = await this.getBackupInfo(backupName, namespace);
        
        return {
          success: true,
          backupName,
          namespace,
          pvcName,
          instanceType,
          status: 'completed',
          createdAt: new Date().toISOString(),
          size: backupInfo.restoreSize || 'unknown',
          snapshotHandle: backupInfo.snapshotHandle
        };
        
      } finally {
        // 임시 파일 정리
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      }
      
    } catch (error) {
      console.error(`Failed to create backup for ${instanceName}:`, error.message);
      throw new Error(`Backup creation failed: ${error.message}`);
    }
  }

  /**
   * 백업에서 새 인스턴스로 복구합니다
   * @param {string} backupName - 백업 이름
   * @param {string} sourceNamespace - 원본 네임스페이스  
   * @param {string} newInstanceName - 새 인스턴스 이름
   * @param {Object} options - 복구 옵션
   * @returns {Object} 복구 정보
   */
  async restoreFromBackup(backupName, sourceNamespace, newInstanceName, options = {}) {
    try {
      // 같은 네임스페이스에서 복구 (VolumeSnapshot 크로스 네임스페이스 제한 때문)
      const targetNamespace = options.targetNamespace || sourceNamespace;
      const newPVCName = `data-${newInstanceName}-postgresql-local-0`;
      
      console.log(`Restoring from backup: ${backupName} to new instance: ${newInstanceName}`);
      
      // 백업이 존재하고 Ready 상태인지 확인
      await this.verifyBackupExists(backupName, sourceNamespace);
      
      // 새 네임스페이스 생성 (필요한 경우)
      await this.ensureNamespaceExists(targetNamespace);
      
      // 복구용 PVC 생성
      const restorePVCManifest = this.createRestorePVCManifest(
        newPVCName,
        targetNamespace,
        backupName,
        sourceNamespace,
        options
      );
      
      // 임시 YAML 파일 생성
      const tempFile = `/tmp/${newInstanceName}-restore.yaml`;
      fs.writeFileSync(tempFile, yaml.dump(restorePVCManifest));
      
      try {
        // 복구 PVC 생성
        execSync(`kubectl apply -f "${tempFile}"`, this.execOptions);
        console.log(`✅ Restore PVC created: ${newPVCName}`);
        
        // PVC가 Bound 상태가 될 때까지 대기
        await this.waitForPVCBound(newPVCName, targetNamespace);
        
        return {
          success: true,
          restoredInstanceName: newInstanceName,
          namespace: targetNamespace,
          pvcName: newPVCName,
          sourceBackup: backupName,
          status: 'completed',
          restoredAt: new Date().toISOString()
        };
        
      } finally {
        // 임시 파일 정리
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      }
      
    } catch (error) {
      console.error(`Failed to restore from backup ${backupName}:`, error.message);
      throw new Error(`Restore failed: ${error.message}`);
    }
  }

  /**
   * 백업 목록을 조회합니다
   * @param {string} namespace - 네임스페이스 (선택사항)
   * @returns {Array} 백업 목록
   */
  async listBackups(namespace = null) {
    try {
      const namespaceFlag = namespace ? `-n ${namespace}` : '--all-namespaces';
      const output = execSync(
        `kubectl get volumesnapshots ${namespaceFlag} -o json`,
        this.execOptions
      );
      
      const result = JSON.parse(output);
      const backups = result.items.map(item => ({
        name: item.metadata.name,
        namespace: item.metadata.namespace,
        status: item.status?.readyToUse ? 'ready' : 'pending',
        restoreSize: item.status?.restoreSize,
        creationTime: item.metadata.creationTimestamp,
        snapshotHandle: item.status?.snapshotHandle,
        sourcePVC: item.spec.source?.persistentVolumeClaimName
      }));
      
      return backups;
      
    } catch (error) {
      console.error('Failed to list backups:', error.message);
      return [];
    }
  }

  /**
   * 백업을 삭제합니다
   * @param {string} backupName - 백업 이름
   * @param {string} namespace - 네임스페이스
   */
  async deleteBackup(backupName, namespace) {
    try {
      console.log(`Deleting backup: ${backupName} in namespace: ${namespace}`);
      
      execSync(
        `kubectl delete volumesnapshot ${backupName} -n ${namespace}`,
        this.execOptions
      );
      
      console.log(`✅ Backup deleted: ${backupName}`);
      return { success: true, message: 'Backup deleted successfully' };
      
    } catch (error) {
      console.error(`Failed to delete backup ${backupName}:`, error.message);
      throw new Error(`Backup deletion failed: ${error.message}`);
    }
  }

  // === Helper Methods ===

  /**
   * 인스턴스 타입을 감지합니다
   */
  detectInstanceType(instanceName, namespace) {
    try {
      // PVC 이름을 보고 타입 추측
      const output = execSync(`kubectl get pvc -n ${namespace} -o json`, this.execOptions);
      const pvcs = JSON.parse(output);
      
      for (const pvc of pvcs.items) {
        if (pvc.metadata.name.includes(instanceName)) {
          if (pvc.metadata.name.includes('postgresql')) return 'postgresql';
          if (pvc.metadata.name.includes('mysql')) return 'mysql';  
          if (pvc.metadata.name.includes('mariadb')) return 'mariadb';
        }
      }
      
      // 기본값은 postgresql
      return 'postgresql';
    } catch (error) {
      console.warn(`Could not detect instance type for ${instanceName}, defaulting to postgresql`);
      return 'postgresql';
    }
  }

  /**
   * 인스턴스 이름에서 PVC 이름을 생성합니다
   */
  getPVCName(instanceName, instanceType = 'postgresql') {
    // Helm 차트에서 생성되는 실제 PVC 이름 패턴
    switch (instanceType) {
      case 'postgresql':
        return `data-${instanceName}-postgresql-local-0`;
      case 'mysql':
        return `data-${instanceName}-mysql-local-0`;
      case 'mariadb':
        return `data-${instanceName}-mariadb-local-0`;
      default:
        return `data-${instanceName}-postgresql-local-0`;
    }
  }

  /**
   * VolumeSnapshot 매니페스트를 생성합니다
   */
  createVolumeSnapshotManifest(backupName, namespace, pvcName, options) {
    return {
      apiVersion: 'snapshot.storage.k8s.io/v1',
      kind: 'VolumeSnapshot',
      metadata: {
        name: backupName,
        namespace: namespace,
        labels: {
          'app.kubernetes.io/managed-by': 'dbaas',
          'dbaas.io/backup-source': pvcName,
          'dbaas.io/backup-type': 'volumesnapshot'
        },
        annotations: {
          'dbaas.io/created-by': 'dbaas-backup-service',
          'dbaas.io/retention-days': options.retentionDays || '7'
        }
      },
      spec: {
        volumeSnapshotClassName: 'csi-hostpath-snapclass',
        source: {
          persistentVolumeClaimName: pvcName
        }
      }
    };
  }

  /**
   * 복구용 PVC 매니페스트를 생성합니다
   */
  createRestorePVCManifest(pvcName, namespace, backupName, sourceNamespace, options) {
    return {
      apiVersion: 'v1',
      kind: 'PersistentVolumeClaim',
      metadata: {
        name: pvcName,
        namespace: namespace,
        labels: {
          'app.kubernetes.io/managed-by': 'dbaas',
          'dbaas.io/restored-from': backupName,
          'dbaas.io/restore-type': 'volumesnapshot'
        },
        annotations: {
          'dbaas.io/restored-by': 'dbaas-backup-service',
          'dbaas.io/source-backup': `${sourceNamespace}/${backupName}`
        }
      },
      spec: {
        accessModes: ['ReadWriteOnce'],
        storageClassName: 'csi-hostpath-sc',
        dataSource: {
          name: backupName,
          kind: 'VolumeSnapshot',
          apiGroup: 'snapshot.storage.k8s.io'
        },
        resources: {
          requests: {
            storage: options.size || '1Gi'
          }
        }
      }
    };
  }

  /**
   * PVC가 존재하는지 확인합니다
   */
  async verifyPVCExists(pvcName, namespace) {
    try {
      execSync(`kubectl get pvc ${pvcName} -n ${namespace}`, this.execOptions);
    } catch (error) {
      throw new Error(`PVC ${pvcName} not found in namespace ${namespace}`);
    }
  }

  /**
   * 백업이 존재하고 Ready 상태인지 확인합니다
   */
  async verifyBackupExists(backupName, namespace) {
    try {
      const output = execSync(
        `kubectl get volumesnapshot ${backupName} -n ${namespace} -o json`,
        this.execOptions
      );
      
      const snapshot = JSON.parse(output);
      if (!snapshot.status?.readyToUse) {
        throw new Error(`Backup ${backupName} is not ready for use`);
      }
    } catch (error) {
      throw new Error(`Backup ${backupName} not found or not ready: ${error.message}`);
    }
  }

  /**
   * 네임스페이스가 존재하는지 확인하고 없으면 생성합니다
   */
  async ensureNamespaceExists(namespace) {
    try {
      execSync(`kubectl get namespace ${namespace}`, this.execOptions);
    } catch (error) {
      console.log(`Creating namespace: ${namespace}`);
      execSync(`kubectl create namespace ${namespace}`, this.execOptions);
    }
  }

  /**
   * VolumeSnapshot이 Ready 상태가 될 때까지 대기합니다
   */
  async waitForSnapshotReady(snapshotName, namespace, timeoutMs = 300000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        const output = execSync(
          `kubectl get volumesnapshot ${snapshotName} -n ${namespace} -o json`,
          this.execOptions
        );
        
        const snapshot = JSON.parse(output);
        if (snapshot.status?.readyToUse) {
          console.log(`✅ VolumeSnapshot ${snapshotName} is ready`);
          return;
        }
        
        console.log(`⏳ Waiting for VolumeSnapshot ${snapshotName} to be ready...`);
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5초 대기
        
      } catch (error) {
        console.log(`⏳ Waiting for VolumeSnapshot ${snapshotName} to be created...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    throw new Error(`Timeout waiting for VolumeSnapshot ${snapshotName} to be ready`);
  }

  /**
   * PVC가 Bound 상태가 될 때까지 대기합니다
   */
  async waitForPVCBound(pvcName, namespace, timeoutMs = 300000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        const output = execSync(
          `kubectl get pvc ${pvcName} -n ${namespace} -o json`,
          this.execOptions
        );
        
        const pvc = JSON.parse(output);
        if (pvc.status?.phase === 'Bound') {
          console.log(`✅ PVC ${pvcName} is bound`);
          return;
        }
        
        console.log(`⏳ Waiting for PVC ${pvcName} to be bound... Current phase: ${pvc.status?.phase || 'Unknown'}`);
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5초 대기
        
      } catch (error) {
        console.log(`⏳ Waiting for PVC ${pvcName} to be created...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    throw new Error(`Timeout waiting for PVC ${pvcName} to be bound`);
  }

  /**
   * 백업 정보를 가져옵니다
   */
  async getBackupInfo(backupName, namespace) {
    try {
      const output = execSync(
        `kubectl get volumesnapshot ${backupName} -n ${namespace} -o json`,
        this.execOptions
      );
      
      const snapshot = JSON.parse(output);
      return {
        name: snapshot.metadata.name,
        namespace: snapshot.metadata.namespace,
        status: snapshot.status?.readyToUse ? 'ready' : 'pending',
        restoreSize: snapshot.status?.restoreSize,
        creationTime: snapshot.metadata.creationTimestamp,
        snapshotHandle: snapshot.status?.snapshotHandle,
        sourcePVC: snapshot.spec.source?.persistentVolumeClaimName
      };
      
    } catch (error) {
      console.error(`Failed to get backup info for ${backupName}:`, error.message);
      return {};
    }
  }
}

module.exports = BackupService; 