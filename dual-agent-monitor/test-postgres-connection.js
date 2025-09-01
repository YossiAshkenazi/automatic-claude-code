#!/usr/bin/env node

/**
 * PostgreSQL Connection Test Script
 * Tests the database connection and performs basic operations
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.postgres' });

// Database configuration
const config = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT) || 5434,
  database: process.env.POSTGRES_DB || 'dual_agent_monitor',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'dual_agent_secure_pass_2025',
  ssl: process.env.POSTGRES_SSL === 'true',
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
};

async function testConnection() {
  console.log('🔍 Testing PostgreSQL connection...');
  console.log(`Connection config: ${config.host}:${config.port}/${config.database}`);
  
  const pool = new Pool(config);
  
  try {
    // Test basic connection
    console.log('📡 Attempting to connect...');
    const client = await pool.connect();
    console.log('✅ Database connection established!');
    
    // Test PostgreSQL version
    const versionResult = await client.query('SELECT version()');
    console.log(`📊 PostgreSQL Version: ${versionResult.rows[0].version.split(',')[0]}`);
    
    // Test database exists and accessible
    const dbResult = await client.query('SELECT current_database()');
    console.log(`🗄️  Current Database: ${dbResult.rows[0].current_database}`);
    
    // Test tables exist
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    console.log(`📋 Tables found: ${tablesResult.rows.length}`);
    tablesResult.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.table_name}`);
    });
    
    // Test data exists
    const usersResult = await client.query('SELECT COUNT(*) as count FROM users');
    const permissionsResult = await client.query('SELECT COUNT(*) as count FROM permissions');
    const sessionsResult = await client.query('SELECT COUNT(*) as count FROM sessions');
    
    console.log(`👥 Users: ${usersResult.rows[0].count}`);
    console.log(`🔑 Permissions: ${permissionsResult.rows[0].count}`);
    console.log(`💬 Sessions: ${sessionsResult.rows[0].count}`);
    
    // Test admin user exists
    const adminResult = await client.query(`
      SELECT u.username, u.role, up.display_name 
      FROM users u
      LEFT JOIN user_profiles up ON u.id = up.user_id
      WHERE u.username = 'admin'
    `);
    
    if (adminResult.rows.length > 0) {
      const admin = adminResult.rows[0];
      console.log(`👑 Admin User: ${admin.username} (${admin.role}) - ${admin.display_name || 'No profile'}`);
    } else {
      console.log('⚠️  No admin user found');
    }
    
    // Test permissions work
    const adminPermissions = await client.query(`
      SELECT p.name, p.description
      FROM permissions p
      JOIN user_permissions up ON p.id = up.permission_id
      JOIN users u ON up.user_id = u.id
      WHERE u.username = 'admin'
    `);
    
    console.log(`🛡️  Admin Permissions: ${adminPermissions.rows.length}`);
    adminPermissions.rows.forEach((perm) => {
      console.log(`   - ${perm.name}: ${perm.description}`);
    });
    
    // Test write capability with a simple insert/delete
    console.log('✍️  Testing write capabilities...');
    const { v4: uuidv4 } = require('uuid');
    const testSessionId = uuidv4();
    
    await client.query(`
      INSERT INTO sessions (id, status, initial_task, work_dir)
      VALUES ($1, 'running', 'Test connection', '/tmp/test')
    `, [testSessionId]);
    console.log('   ✅ Insert test passed');
    
    const selectResult = await client.query(
      'SELECT * FROM sessions WHERE id = $1', 
      [testSessionId]
    );
    console.log('   ✅ Select test passed');
    
    await client.query('DELETE FROM sessions WHERE id = $1', [testSessionId]);
    console.log('   ✅ Delete test passed');
    
    client.release();
    
    console.log('\n🎉 All PostgreSQL tests passed!');
    console.log('✅ Database is ready for the dual-agent monitoring system');
    
    return true;
    
  } catch (error) {
    console.error('\n❌ PostgreSQL connection test failed:');
    console.error(`Error: ${error.message}`);
    
    if (error.code) {
      console.error(`Error Code: ${error.code}`);
    }
    
    console.error('\n🔧 Troubleshooting:');
    console.error('1. Check if PostgreSQL container is running:');
    console.error('   docker-compose -f docker-compose.postgres.yml ps');
    console.error('2. Check container logs:');
    console.error('   docker-compose -f docker-compose.postgres.yml logs postgres');
    console.error('3. Verify environment variables in .env.postgres');
    console.error('4. Test direct connection:');
    console.error(`   docker-compose -f docker-compose.postgres.yml exec postgres psql -U ${config.user} -d ${config.database}`);
    
    return false;
  } finally {
    try {
      await pool.end();
    } catch (error) {
      console.error('Error closing pool:', error.message);
    }
  }
}

// Run the test
if (require.main === module) {
  testConnection().then((success) => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { testConnection };