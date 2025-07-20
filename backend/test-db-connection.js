require('dotenv').config();
const { Client } = require('pg');

async function testConnection() {
  const config = {
    host: process.env.METADATA_DB_HOST || 'localhost',
    port: process.env.METADATA_DB_PORT || 5434,
    database: process.env.METADATA_DB_NAME || 'dbaas_metadata',
    user: process.env.METADATA_DB_USER || 'postgres',
    password: process.env.METADATA_DB_PASSWORD || 'dbaas123',
  };
  
  console.log('🔌 Testing connection with config:', {
    ...config,
    password: '***'
  });
  
  const client = new Client(config);
  
  try {
    console.log('📊 Attempting to connect...');
    await client.connect();
    console.log('✅ Connected successfully!');
    
    const result = await client.query('SELECT version()');
    console.log('📦 PostgreSQL version:', result.rows[0].version);
    
    // 테이블 생성 테스트
    await client.query(`
      CREATE TABLE IF NOT EXISTS test_table (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Test table created successfully');
    
    // 데이터 삽입 테스트
    await client.query(`
      INSERT INTO test_table (name) VALUES ('test-connection')
    `);
    console.log('✅ Test data inserted successfully');
    
    // 데이터 조회 테스트
    const testResult = await client.query('SELECT * FROM test_table');
    console.log('📋 Test data retrieved:', testResult.rows);
    
    // 테스트 테이블 정리
    await client.query('DROP TABLE test_table');
    console.log('🗑️ Test table cleaned up');
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('🔍 Error details:', error);
  } finally {
    try {
      await client.end();
      console.log('🔌 Connection closed');
    } catch (endError) {
      console.error('❌ Error closing connection:', endError.message);
    }
  }
}

testConnection(); 