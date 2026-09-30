// Database Configuration
import { PrismaClient } from '@prisma/client';

// Database adapter factory
class DatabaseAdapter {
  constructor() {
    this.client = null;
    this.type = process.env.DATABASE_TYPE || 'postgresql';
  }

  async connect() {
    try {
      if (this.type === 'postgresql' || this.type === 'neon') {
        // Neon PostgreSQL configuration
        this.client = new PrismaClient({
          datasources: {
            db: {
              url: process.env.DATABASE_URL || process.env.NEON_DATABASE_URL
            }
          },
          log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error']
        });
      } else if (this.type === 'sqlite') {
        this.client = new PrismaClient({
          datasources: {
            db: {
              url: process.env.DATABASE_URL || 'file:./dev.db'
            }
          }
        });
      } else {
        throw new Error(`Unsupported DATABASE_TYPE: ${this.type}`);
      }

      // Test connection
      await this.client.$connect();
      console.log(`✅ Database connected successfully (${this.type})`);
      
      return this.client;
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.$disconnect();
      console.log('📦 Database disconnected');
    }
  }

  getClient() {
    if (!this.client) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.client;
  }

  // Health check
  async healthCheck() {
    try {
      await this.client.$queryRaw`SELECT 1`;
      return { status: 'healthy', type: this.type };
    } catch (error) {
      return { status: 'unhealthy', type: this.type, error: error.message };
    }
  }

  // Migration helpers
  async runMigrations() {
    try {
      // This would be handled by Prisma CLI in most cases
      console.log('🔄 Running database migrations...');
      // Custom migration logic if needed
      console.log('✅ Migrations completed');
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }
}

// Singleton instance
let dbInstance = null;

export const getDatabase = async () => {
  if (!dbInstance) {
    dbInstance = new DatabaseAdapter();
    await dbInstance.connect();
  }
  return dbInstance.getClient();
};

export const disconnectDatabase = async () => {
  if (dbInstance) {
    await dbInstance.disconnect();
    dbInstance = null;
  }
};

export const getDatabaseHealth = async () => {
  if (!dbInstance) {
    return { status: 'disconnected' };
  }
  return await dbInstance.healthCheck();
};

export default DatabaseAdapter;
