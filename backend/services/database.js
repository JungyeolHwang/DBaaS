const { Client } = require('pg');

class DatabaseService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.config = {
      host: process.env.METADATA_DB_HOST || 'localhost',
      port: process.env.METADATA_DB_PORT || 5435, // 포트 포워딩 기본 포트
      database: process.env.METADATA_DB_NAME || 'dbaas_metadata',
      user: process.env.METADATA_DB_USER || 'postgres',
      password: process.env.METADATA_DB_PASSWORD || 'dbaas123',
    };
    
    console.log('📊 DatabaseService initialized with config:', {
      ...this.config,
      password: '***' // 보안상 마스킹
    });
  }

  async connect() {
    if (this.isConnected && this.client) {
      return this.client;
    }

    try {
      this.client = new Client(this.config);
      await this.client.connect();
      this.isConnected = true;
      
      console.log('✅ Connected to metadata database successfully');
      await this.initDatabase();
      return this.client;
    } catch (error) {
      console.error('❌ Failed to connect to metadata database:', error.message);
      this.isConnected = false;
      throw error;
    }
  }

  async initDatabase() {
    try {
      // 인스턴스 테이블 생성
      await this.client.query(`
        CREATE TABLE IF NOT EXISTS instances (
          name VARCHAR(255) PRIMARY KEY,
          type VARCHAR(50) NOT NULL,
          config JSONB NOT NULL,
          status VARCHAR(50) DEFAULT 'creating',
          namespace VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          metadata JSONB DEFAULT '{}'::jsonb
        )
      `);

      // 백업 테이블 생성
      await this.client.query(`
        CREATE TABLE IF NOT EXISTS backups (
          id SERIAL PRIMARY KEY,
          instance_name VARCHAR(255),
          backup_name VARCHAR(255) UNIQUE NOT NULL,
          namespace VARCHAR(255) NOT NULL,
          status VARCHAR(50) DEFAULT 'creating',
          size_bytes BIGINT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          metadata JSONB DEFAULT '{}'::jsonb,
          FOREIGN KEY (instance_name) REFERENCES instances(name) ON DELETE CASCADE
        )
      `);

      // 인덱스 생성
      await this.client.query(`
        CREATE INDEX IF NOT EXISTS idx_instances_type ON instances(type);
        CREATE INDEX IF NOT EXISTS idx_instances_status ON instances(status);
        CREATE INDEX IF NOT EXISTS idx_instances_created_at ON instances(created_at);
        CREATE INDEX IF NOT EXISTS idx_backups_instance_name ON backups(instance_name);
        CREATE INDEX IF NOT EXISTS idx_backups_created_at ON backups(created_at);
      `);

      console.log('✅ Database schema initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize database schema:', error.message);
      throw error;
    }
  }

  async createInstance(instance) {
    await this.connect();
    
    const query = `
      INSERT INTO instances (name, type, config, namespace, status, metadata)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const values = [
      instance.name,
      instance.type,
      JSON.stringify(instance.config),
      instance.namespace,
      instance.status || 'creating',
      JSON.stringify(instance.metadata || {})
    ];
    
    try {
      const result = await this.client.query(query, values);
      console.log(`✅ Instance created in database: ${instance.name}`);
      return this.formatInstance(result.rows[0]);
    } catch (error) {
      console.error(`❌ Failed to create instance in database: ${instance.name}`, error.message);
      throw error;
    }
  }

  async updateInstance(name, updates) {
    await this.connect();
    
    const setParts = [];
    const values = [name];
    let paramIndex = 2;

    if (updates.config !== undefined) {
      setParts.push(`config = $${paramIndex}`);
      values.push(JSON.stringify(updates.config));
      paramIndex++;
    }

    if (updates.status !== undefined) {
      setParts.push(`status = $${paramIndex}`);
      values.push(updates.status);
      paramIndex++;
    }

    if (updates.metadata !== undefined) {
      setParts.push(`metadata = $${paramIndex}`);
      values.push(JSON.stringify(updates.metadata));
      paramIndex++;
    }

    if (setParts.length === 0) {
      // 아무것도 업데이트할 것이 없으면 기존 인스턴스 반환
      return await this.getInstance(name);
    }

    setParts.push('updated_at = CURRENT_TIMESTAMP');

    const query = `
      UPDATE instances 
      SET ${setParts.join(', ')}
      WHERE name = $1
      RETURNING *
    `;
    
    try {
      const result = await this.client.query(query, values);
      if (result.rows.length > 0) {
        console.log(`✅ Instance updated in database: ${name}`);
        return this.formatInstance(result.rows[0]);
      } else {
        console.warn(`⚠️ Instance not found for update: ${name}`);
        return null;
      }
    } catch (error) {
      console.error(`❌ Failed to update instance in database: ${name}`, error.message);
      throw error;
    }
  }

  async getInstance(name) {
    await this.connect();
    
    try {
      const result = await this.client.query(
        'SELECT * FROM instances WHERE name = $1',
        [name]
      );
      return result.rows.length > 0 ? this.formatInstance(result.rows[0]) : null;
    } catch (error) {
      console.error(`❌ Failed to get instance from database: ${name}`, error.message);
      throw error;
    }
  }

  async getAllInstances() {
    await this.connect();
    
    try {
      const result = await this.client.query('SELECT * FROM instances ORDER BY created_at DESC');
      return result.rows.map(row => this.formatInstance(row));
    } catch (error) {
      console.error('❌ Failed to get all instances from database:', error.message);
      throw error;
    }
  }

  async getInstancesByType(type) {
    await this.connect();
    
    try {
      const result = await this.client.query(
        'SELECT * FROM instances WHERE type = $1 ORDER BY created_at DESC',
        [type]
      );
      return result.rows.map(row => this.formatInstance(row));
    } catch (error) {
      console.error(`❌ Failed to get instances by type from database: ${type}`, error.message);
      throw error;
    }
  }

  async deleteInstance(name) {
    await this.connect();
    
    try {
      const result = await this.client.query(
        'DELETE FROM instances WHERE name = $1 RETURNING *',
        [name]
      );
      if (result.rowCount > 0) {
        console.log(`✅ Instance deleted from database: ${name}`);
        return true;
      } else {
        console.warn(`⚠️ Instance not found for deletion: ${name}`);
        return false;
      }
    } catch (error) {
      console.error(`❌ Failed to delete instance from database: ${name}`, error.message);
      throw error;
    }
  }

  // 백업 관련 메서드
  async createBackup(backup) {
    await this.connect();
    
    const query = `
      INSERT INTO backups (instance_name, backup_name, namespace, status, size_bytes, metadata)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const values = [
      backup.instanceName,
      backup.backupName,
      backup.namespace,
      backup.status || 'creating',
      backup.sizeBytes || null,
      JSON.stringify(backup.metadata || {})
    ];
    
    try {
      const result = await this.client.query(query, values);
      console.log(`✅ Backup created in database: ${backup.backupName}`);
      return this.formatBackup(result.rows[0]);
    } catch (error) {
      console.error(`❌ Failed to create backup in database: ${backup.backupName}`, error.message);
      throw error;
    }
  }

  async getBackupsByInstance(instanceName) {
    await this.connect();
    
    try {
      const result = await this.client.query(
        'SELECT * FROM backups WHERE instance_name = $1 ORDER BY created_at DESC',
        [instanceName]
      );
      return result.rows.map(row => this.formatBackup(row));
    } catch (error) {
      console.error(`❌ Failed to get backups for instance: ${instanceName}`, error.message);
      throw error;
    }
  }

  formatInstance(row) {
    return {
      name: row.name,
      type: row.type,
      config: typeof row.config === 'string' ? JSON.parse(row.config) : row.config,
      status: row.status,
      namespace: row.namespace,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata
    };
  }

  formatBackup(row) {
    return {
      id: row.id,
      instanceName: row.instance_name,
      backupName: row.backup_name,
      namespace: row.namespace,
      status: row.status,
      sizeBytes: row.size_bytes,
      createdAt: row.created_at.toISOString(),
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata
    };
  }

  async disconnect() {
    if (this.client && this.isConnected) {
      try {
        await this.client.end();
        this.isConnected = false;
        console.log('✅ Disconnected from metadata database');
      } catch (error) {
        console.error('❌ Error disconnecting from database:', error.message);
      }
    }
  }

  // 연결 상태 확인
  async healthCheck() {
    try {
      await this.connect();
      const result = await this.client.query('SELECT 1 as health');
      return result.rows.length > 0;
    } catch (error) {
      console.error('❌ Database health check failed:', error.message);
      return false;
    }
  }
}

module.exports = DatabaseService; 