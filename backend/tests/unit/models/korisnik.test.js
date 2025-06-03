const { TestHelpers } = require('../../utils/testHelpers');

const korisnikModel = {
  async create(userData) {
    const { ime, prezime, email, lozinka, telefon } = userData;
    
    const result = await global.testDb.query(
      'INSERT INTO korisnik (ime, prezime, email, lozinka, telefon) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [ime, prezime, email, lozinka, telefon]
    );
    
    return result.rows[0];
  },

  async findById(id) {
    try {
      if (!id || isNaN(id)) {
        return null;
      }
      
      const result = await global.testDb.query(
        'SELECT * FROM korisnik WHERE id_korisnika = $1',
        [parseInt(id)]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      return null;
    }
  },

  async findByEmail(email) {
    const result = await global.testDb.query(
      'SELECT * FROM korisnik WHERE email = $1',
      [email]
    );
    
    return result.rows[0] || null;
  },

  async update(id, userData) {
    const { ime, prezime, email, telefon } = userData;
    
    if (email) {
      const emailCheck = await global.testDb.query(
        'SELECT id_korisnika FROM korisnik WHERE email = $1 AND id_korisnika != $2',
        [email, id]
      );
      
      if (emailCheck.rows.length > 0) {
        throw new Error('Email already exists');
      }
    }
    
    const result = await global.testDb.query(
      'UPDATE korisnik SET ime = $1, prezime = $2, email = $3, telefon = $4 WHERE id_korisnika = $5 RETURNING *',
      [ime, prezime, email, telefon, id]
    );
    
    return result.rows[0] || null;
  },

  async delete(id) {
    const result = await global.testDb.query(
      'DELETE FROM korisnik WHERE id_korisnika = $1 RETURNING *',
      [id]
    );
    
    return result.rows[0] || null;
  },

  async getAll() {
    const result = await global.testDb.query('SELECT * FROM korisnik ORDER BY id_korisnika');
    return result.rows;
  },

  async searchByName(searchTerm) {
    const result = await global.testDb.query(
      `SELECT * FROM korisnik 
       WHERE LOWER(ime) LIKE LOWER($1) OR LOWER(prezime) LIKE LOWER($1) 
       ORDER BY ime, prezime`,
      [`%${searchTerm}%`]
    );
    
    return result.rows;
  },

  async updatePassword(id, newPassword) {
    const result = await global.testDb.query(
      'UPDATE korisnik SET lozinka = $1 WHERE id_korisnika = $2 RETURNING id_korisnika',
      [newPassword, id]
    );
    
    return result.rows[0] || null;
  },

  async getUserWithRole(id) {
    const result = await global.testDb.query(
      `SELECT k.*, 
              CASE 
                WHEN kl.id_korisnika IS NOT NULL THEN 'client'
                WHEN tr.id_korisnika IS NOT NULL THEN 'trainer'
                ELSE 'user'
              END as role
       FROM korisnik k
       LEFT JOIN klijent kl ON k.id_korisnika = kl.id_korisnika
       LEFT JOIN trener tr ON k.id_korisnika = tr.id_korisnika
       WHERE k.id_korisnika = $1`,
      [id]
    );
    
    return result.rows[0] || null;
  },

  async validateEmailUnique(email, excludeId = null) {
    let query = 'SELECT id_korisnika FROM korisnik WHERE email = $1';
    let params = [email];
    
    if (excludeId) {
      query += ' AND id_korisnika != $2';
      params.push(excludeId);
    }
    
    const result = await global.testDb.query(query, params);
    return result.rows.length === 0;
  }
};

describe('KorisnikModel - Sloj pristupa podacima', () => {
  let testUser;

  beforeEach(async () => {
    await TestHelpers.cleanupTestData();
    
    testUser = {
      ime: 'John',
      prezime: 'Doe',
      email: `john.doe.${Date.now()}@example.com`,
      lozinka: 'password123',
      telefon: '091234567'
    };
  });

  afterEach(async () => {
    await TestHelpers.cleanupTestData();
  });

  describe('create', () => {
    it('trebao bi uspješno kreirati novog korisnika', async () => {
      const createdUser = await korisnikModel.create(testUser);

      expect(createdUser).toBeDefined();
      expect(createdUser.id_korisnika).toBeDefined();
      expect(createdUser.ime).toBe(testUser.ime);
      expect(createdUser.prezime).toBe(testUser.prezime);
      expect(createdUser.email).toBe(testUser.email);
      expect(createdUser.lozinka).toBe(testUser.lozinka);
      expect(createdUser.telefon).toBe(testUser.telefon);
      expect(createdUser.created_at).toBeDefined();
    });

    it('trebao bi odbaciti korisnika s duplikatnim emailom', async () => {
      await korisnikModel.create(testUser);

      await expect(korisnikModel.create(testUser)).rejects.toThrow();
    });

    it('trebao bi odbaciti korisnika bez obaveznih polja', async () => {
      const incompleteUser = { ime: 'John' };

      await expect(korisnikModel.create(incompleteUser)).rejects.toThrow();
    });
  });

  describe('getAll', () => {
    it('trebao bi dohvatiti sve korisnike', async () => {
      await korisnikModel.create(testUser);
      await korisnikModel.create({
        ...testUser,
        email: `user2.${Date.now()}@example.com`
      });

      const allUsers = await korisnikModel.getAll();

      expect(allUsers).toHaveLength(2);
      expect(allUsers[0].id_korisnika).toBeLessThan(allUsers[1].id_korisnika);
    });
  });
});