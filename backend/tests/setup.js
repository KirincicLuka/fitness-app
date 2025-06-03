require('dotenv').config({ path: '.env.test' });

const { Pool } = require('pg');

const testPool = new Pool({
  connectionString: process.env.TEST_DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
  ssl: false
});

global.testDb = testPool;
global.testToken = null;
global.testUser = null;

global.setupHelpers = {
  cleanupTestData,
  resetDatabase
};

beforeAll(async () => {
  await setupTestDatabase();
  await resetDatabase(); 
});

afterAll(async () => {
  await resetDatabase(); 
  await teardownTestDatabase();
});

async function setupTestDatabase() {
  try {
    await testPool.query(`
      CREATE TABLE IF NOT EXISTS korisnik (
        id_korisnika SERIAL PRIMARY KEY,
        ime VARCHAR(50) NOT NULL,
        prezime VARCHAR(50) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        lozinka VARCHAR(255) NOT NULL,
        telefon VARCHAR(20),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await testPool.query(`
      CREATE TABLE IF NOT EXISTS klijent (
        id_korisnika INTEGER PRIMARY KEY REFERENCES korisnik(id_korisnika) ON DELETE CASCADE,
        spol VARCHAR(10),
        datum_rodenja DATE,
        aktivnost TEXT,
        zdravstveni_problemi TEXT[],
        lijekovi TEXT[],
        fizicka_ogranicenja TEXT[]
      );
    `);

    await testPool.query(`
      CREATE TABLE IF NOT EXISTS trener (
        id_korisnika INTEGER PRIMARY KEY REFERENCES korisnik(id_korisnika) ON DELETE CASCADE,
        specijalizacija VARCHAR(100),
        biografija TEXT,
        certifikat VARCHAR(255),
        slika VARCHAR(255),
        id_poslovnice INTEGER
      );
    `);

    await testPool.query(`
      CREATE TABLE IF NOT EXISTS trening (
        id_treninga SERIAL PRIMARY KEY,
        naziv VARCHAR(100) NOT NULL,
        opis TEXT,
        id_trenera INTEGER REFERENCES trener(id_korisnika) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await testPool.query(`
      CREATE TABLE IF NOT EXISTS termin (
        id_termina SERIAL PRIMARY KEY,
        id_trenera INTEGER REFERENCES trener(id_korisnika) ON DELETE CASCADE,
        id_treninga INTEGER REFERENCES trening(id_treninga) ON DELETE SET NULL,
        datum DATE NOT NULL,
        vrijeme_termina TIME NOT NULL,
        trajanje INTERVAL NOT NULL DEFAULT '60 minutes',
        mjesto VARCHAR(100),
        dostupnost VARCHAR(20) DEFAULT 'available',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await testPool.query(`
      CREATE TABLE IF NOT EXISTS zahtjev_za_rezervaciju (
        id_zahtjeva SERIAL PRIMARY KEY,
        id_klijenta INTEGER REFERENCES klijent(id_korisnika) ON DELETE CASCADE,
        id_termina INTEGER REFERENCES termin(id_termina) ON DELETE CASCADE,
        vrijeme_zahtjeva TIMESTAMP DEFAULT NOW(),
        status_rezervacije VARCHAR(20) DEFAULT 'reserved'
      );
    `);

    await testPool.query(`
      CREATE TABLE IF NOT EXISTS vjezba (
        id_vjezbe SERIAL PRIMARY KEY,
        naziv VARCHAR(100) NOT NULL,
        ponavljanja INTEGER,
        serije INTEGER,
        uteg DECIMAL(5,2),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await testPool.query(`
      CREATE TABLE IF NOT EXISTS trening_vjezba (
        id_treninga INTEGER REFERENCES trening(id_treninga) ON DELETE CASCADE,
        id_vjezbe INTEGER REFERENCES vjezba(id_vjezbe) ON DELETE CASCADE,
        PRIMARY KEY (id_treninga, id_vjezbe)
      );
    `);

  } catch (error) {
    console.error('Greška pri postavljanju test baze:', error.message);
    throw error;
  }
}

async function cleanupTestData() {
  const client = await testPool.connect();
  try {
    await client.query('BEGIN');
    
    await client.query('DELETE FROM trening_vjezba');
    await client.query('DELETE FROM zahtjev_za_rezervaciju');
    await client.query('DELETE FROM termin');
    await client.query('DELETE FROM vjezba');
    await client.query('DELETE FROM trening');
    await client.query('DELETE FROM klijent');
    await client.query('DELETE FROM trener');
    await client.query('DELETE FROM korisnik');
    
    await client.query('ALTER SEQUENCE IF EXISTS korisnik_id_korisnika_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE IF EXISTS trening_id_treninga_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE IF EXISTS termin_id_termina_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE IF EXISTS zahtjev_za_rezervaciju_id_zahtjeva_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE IF EXISTS vjezba_id_vjezbe_seq RESTART WITH 1');
    
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Greška pri čišćenju podataka:', error.message);
  } finally {
    client.release();
  }
}

async function resetDatabase() {
  const client = await testPool.connect();
  try {
    console.log('🧹 Potpuni reset test baze podataka...');
    
    await client.query('BEGIN');
    
    await client.query('DELETE FROM trening_vjezba');
    await client.query('DELETE FROM zahtjev_za_rezervaciju');
    await client.query('DELETE FROM termin');
    await client.query('DELETE FROM vjezba');
    await client.query('DELETE FROM trening');
    await client.query('DELETE FROM klijent');
    await client.query('DELETE FROM trener');
    await client.query('DELETE FROM korisnik');
    
    const sequences = [
      'korisnik_id_korisnika_seq',
      'trening_id_treninga_seq', 
      'termin_id_termina_seq',
      'zahtjev_za_rezervaciju_id_zahtjeva_seq',
      'vjezba_id_vjezbe_seq'
    ];
    
    for (const seq of sequences) {
      await client.query(`ALTER SEQUENCE IF EXISTS ${seq} RESTART WITH 1`);
    }
    
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Greška pri reset-u baze:', error.message);
  } finally {
    client.release();
  }
}

async function teardownTestDatabase() {
  try {
    await cleanupTestData();
    await testPool.end();
    console.log('Test baza zatvorena');
  } catch (error) {
    console.error('Greška pri zatvaranju test baze:', error.message);
  }
}

module.exports = {
  testPool,
  setupTestDatabase,
  cleanupTestData,
  resetDatabase,
  teardownTestDatabase
};