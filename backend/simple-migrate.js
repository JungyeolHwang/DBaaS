require('dotenv').config();
const DatabaseService = require('./services/database');

async function simpleMigrate() {
  const dbService = new DatabaseService();
  
  try {
    console.log('🔄 Starting simple migration...');
    
    // 메타데이터 DB 인스턴스 정보를 직접 생성
    const metadataInstance = {
      name: 'dbaas-metadata',
      type: 'postgresql',
      config: {
        password: 'dbaas123',
        database: 'dbaas_metadata',
        storage: '1Gi',
        memory: '256Mi',
        cpu: '250m'
      },
      status: 'running',
      namespace: 'dbaas-dbaas-metadata',
      metadata: {
        migrated: true,
        migratedAt: new Date().toISOString(),
        isMetadataDB: true
      }
    };
    
    // DB에 저장
    console.log('📝 Creating metadata DB instance in database...');
    await dbService.createInstance(metadataInstance);
    console.log('✅ Metadata DB instance migrated successfully');
    
    // 결과 확인
    const allInstances = await dbService.getAllInstances();
    console.log('📊 Current instances in database:');
    console.table(allInstances.map(instance => ({
      name: instance.name,
      type: instance.type,
      status: instance.status,
      namespace: instance.namespace,
      migrated: instance.metadata?.migrated || false
    })));
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  } finally {
    await dbService.disconnect();
  }
}

simpleMigrate(); 