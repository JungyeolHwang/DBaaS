#!/usr/bin/env node

require('dotenv').config();
const DatabaseService = require('../services/database');
const { execSync } = require('child_process');

async function migrateExistingInstances() {
  const dbService = new DatabaseService();
  
  try {
    console.log('🔄 Starting instance migration...');
    
    // 1. 기존 DB 연결 테스트
    console.log('📊 Testing database connection...');
    const isHealthy = await dbService.healthCheck();
    if (!isHealthy) {
      throw new Error('Database connection failed');
    }
    console.log('✅ Database connection successful');
    
    // 2. 모든 DBaaS 네임스페이스 조회
    console.log('🔍 Finding existing DBaaS instances...');
    const namespacesOutput = execSync('kubectl get namespaces -o name', { 
      encoding: 'utf8',
      env: {
        ...process.env,
        KUBECONFIG: process.env.KUBECONFIG || `${require('os').homedir()}/.kube/config`
      }
    });
    const dbaasNamespaces = namespacesOutput
      .split('\n')
      .filter(ns => ns.includes('dbaas-'))
      .map(ns => ns.replace('namespace/', ''));
      
    console.log(`Found ${dbaasNamespaces.length} DBaaS namespaces:`, dbaasNamespaces);
    
    // 3. 각 네임스페이스에서 Helm 릴리스 조회
    for (const namespace of dbaasNamespaces) {
      try {
        console.log(`\n🔍 Processing namespace: ${namespace}`);
        
        // Helm 릴리스 조회
        const helmListOutput = execSync(
          `helm list -n ${namespace} -o json`, 
          { encoding: 'utf8' }
        );
        const releases = JSON.parse(helmListOutput);
        
        for (const release of releases) {
          const instanceName = release.name;
          
          // 이미 DB에 존재하는지 확인
          const existingInstance = await dbService.getInstance(instanceName);
          if (existingInstance) {
            console.log(`⏭️ Instance ${instanceName} already exists in database, skipping`);
            continue;
          }
          
          console.log(`➕ Migrating instance: ${instanceName}`);
          
          // 인스턴스 타입 감지 (차트 이름에서)
          let type = 'postgresql'; // 기본값
          if (release.chart && release.chart.includes('mysql')) {
            type = 'mysql';
          } else if (release.chart && release.chart.includes('mariadb')) {
            type = 'mariadb';
          }
          
          // Pod 정보 조회하여 상태 확인
          let status = 'unknown';
          try {
            const podOutput = execSync(
              `kubectl get pods -n ${namespace} -l app.kubernetes.io/instance=${instanceName} -o json`,
              { encoding: 'utf8' }
            );
            const podData = JSON.parse(podOutput);
            
            if (podData.items && podData.items.length > 0) {
              const pod = podData.items[0];
              status = pod.status.phase === 'Running' ? 'running' : pod.status.phase.toLowerCase();
            }
          } catch (podError) {
            console.warn(`⚠️ Could not get pod status for ${instanceName}:`, podError.message);
          }
          
          // 기본 설정 생성
          const instance = {
            name: instanceName,
            type: type,
            config: {
              password: 'migrated', // 실제 비밀번호는 Kubernetes Secret에 저장되어 있음
              storage: '2Gi', // 기본값
              memory: '256Mi',
              cpu: '250m'
            },
            status: status,
            namespace: namespace,
            metadata: {
              migrated: true,
              migratedAt: new Date().toISOString(),
              helmRelease: release.name,
              helmChart: release.chart,
              helmStatus: release.status
            }
          };
          
          // DB에 저장
          try {
            await dbService.createInstance(instance);
            console.log(`✅ Successfully migrated instance: ${instanceName} (${type})`);
          } catch (dbError) {
            console.error(`❌ Failed to migrate instance ${instanceName}:`, dbError.message);
          }
        }
      } catch (error) {
        console.error(`❌ Error processing namespace ${namespace}:`, error.message);
      }
    }
    
    // 4. 마이그레이션 결과 출력
    console.log('\n📊 Migration complete! Current instances in database:');
    const allInstances = await dbService.getAllInstances();
    console.table(allInstances.map(instance => ({
      name: instance.name,
      type: instance.type,
      status: instance.status,
      namespace: instance.namespace,
      migrated: instance.metadata?.migrated || false
    })));
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await dbService.disconnect();
  }
}

// 스크립트가 직접 실행된 경우에만 마이그레이션 수행
if (require.main === module) {
  migrateExistingInstances()
    .then(() => {
      console.log('🎉 Migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error.message);
      process.exit(1);
    });
}

module.exports = { migrateExistingInstances }; 