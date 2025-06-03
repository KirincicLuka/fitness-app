require('dotenv').config({ path: '.env.test' });

const { Pool } = require('pg');

async function testConnection() {
  const testPool = new Pool({
    connectionString: process.env.TEST_DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
    ssl: false
  });

  try {
    console.log('Testiram konekciju na test bazu...');
    
    const result = await testPool.query('SELECT NOW()');
    console.log('Konekcija uspješna! Vrijeme:', result.rows[0].now);
    
    await testPool.query(`
      CREATE TABLE IF NOT EXISTS test_table (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50)
      );
    `);
    console.log('Test tablica stvorena');
    
    await testPool.query('DROP TABLE IF EXISTS test_table');
    console.log('Test tablica obrisana');
    
    console.log('Sve radi savršeno!');
    
  } catch (error) {
    console.error('Greška:', error.message);
    console.error('Connection string:', `postgresql://${process.env.DB_USER}:***@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
  } finally {
    await testPool.end();
    console.log('Konekcija zatvorena');
  }
}

testConnection();