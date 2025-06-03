const request = require('supertest');
const express = require('express');
const { TestHelpers } = require('../utils/testHelpers');

const app = express();
app.use(express.json());

const authRoutes = {
  register: async (req, res) => {
    try {
      const { ime, prezime, email, lozinka, telefon, role } = req.body;

      if (!ime || !prezime || !email || !lozinka) {
        return res.status(400).json({ message: 'Nedostaju obavezni podaci' });
      }

      const existingUser = await global.testDb.query(
        'SELECT * FROM korisnik WHERE email = $1',
        [email]
      );

      if (existingUser.rows.length > 0) {
        return res.status(409).json({ message: 'Korisnik s tim emailom već postoji' });
      }

      const newUser = await global.testDb.query(
        'INSERT INTO korisnik (ime, prezime, email, lozinka, telefon) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [ime, prezime, email, lozinka, telefon]
      );

      const userId = newUser.rows[0].id_korisnika;

      if (role === 'client') {
        await global.testDb.query(
          'INSERT INTO klijent (id_korisnika) VALUES ($1)',
          [userId]
        );
      } else if (role === 'trainer') {
        await global.testDb.query(
          'INSERT INTO trener (id_korisnika) VALUES ($1)',
          [userId]
        );
      }

      return res.status(201).json({
        message: 'Uspješno registriran korisnik',
        user: { ...newUser.rows[0], role }
      });

    } catch (error) {
      console.error('Register error:', error);
      return res.status(500).json({ error: 'Greška pri registraciji' });
    }
  },

  login: async (req, res) => {
    try {
      const { email, lozinka } = req.body;

      if (!email || !lozinka) {
        return res.status(400).json({ message: 'Email i lozinka su obavezni' });
      }

      const userResult = await global.testDb.query(
        'SELECT * FROM korisnik WHERE email = $1',
        [email]
      );

      if (userResult.rows.length === 0) {
        return res.status(401).json({ message: 'Neispravan email ili lozinka' });
      }

      const user = userResult.rows[0];

      if (user.lozinka !== lozinka) {
        return res.status(401).json({ message: 'Neispravan email ili lozinka' });
      }

      const clientCheck = await global.testDb.query(
        'SELECT * FROM klijent WHERE id_korisnika = $1',
        [user.id_korisnika]
      );

      const trainerCheck = await global.testDb.query(
        'SELECT * FROM trener WHERE id_korisnika = $1',
        [user.id_korisnika]
      );

      let role = 'user';
      if (clientCheck.rows.length > 0) role = 'client';
      else if (trainerCheck.rows.length > 0) role = 'trainer';

      const token = TestHelpers.generateTestToken(user, role);

      return res.status(200).json({
        message: 'Login uspješan',
        user: { ...user, role },
        token
      });

    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({ error: 'Greška pri prijavi' });
    }
  }
};

const terminRoutes = {
  getAll: async (req, res) => {
    try {
      const result = await global.testDb.query(`
        SELECT t.*, tr.naziv as trening_naziv, k.ime, k.prezime
        FROM termin t
        LEFT JOIN trening tr ON t.id_treninga = tr.id_treninga
        LEFT JOIN korisnik k ON t.id_trenera = k.id_korisnika
        ORDER BY t.datum, t.vrijeme_termina
      `);

      return res.status(200).json(result.rows);
    } catch (error) {
      return res.status(500).json({ error: 'Greška pri dohvaćanju termina' });
    }
  },

  create: async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Neautorizirano' });
      }

      if (req.user.role !== 'trainer') {
        return res.status(403).json({ message: 'Samo treneri mogu kreirati termine' });
      }

      const { datum, vrijeme_termina, trajanje, mjesto, id_treninga } = req.body;
      const id_trenera = req.user.id_korisnika;

      if (!datum || !vrijeme_termina || !trajanje) {
        return res.status(400).json({ message: 'Nedostaju obavezni podaci' });
      }

      const terminDateTime = new Date(`${datum}T${vrijeme_termina}`);
      if (terminDateTime < new Date()) {
        return res.status(400).json({ message: 'Termin ne može biti u prošlosti' });
      }

      const overlapCheck = await global.testDb.query(
        `SELECT * FROM termin 
         WHERE id_trenera = $1 AND datum = $2 
         AND ((vrijeme_termina <= $3 AND (vrijeme_termina + trajanje) > $3)
         OR (vrijeme_termina < ($3::time + $4::interval) AND (vrijeme_termina + trajanje) >= ($3::time + $4::interval)))`,
        [id_trenera, datum, vrijeme_termina, `${trajanje} minutes`]
      );

      if (overlapCheck.rows.length > 0) {
        return res.status(409).json({ message: 'Postoji preklapanje s drugim terminom' });
      }

      const result = await global.testDb.query(
        'INSERT INTO termin (id_trenera, id_treninga, datum, vrijeme_termina, trajanje, mjesto) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [id_trenera, id_treninga, datum, vrijeme_termina, `${trajanje} minutes`, mjesto]
      );

      return res.status(201).json(result.rows[0]);

    } catch (error) {
      console.error('Create termin error:', error);
      return res.status(500).json({ error: 'Greška pri kreiranju termina' });
    }
  }
};

const rezervacijaRoutes = {
  create: async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Neautorizirano' });
      }

      if (req.user.role !== 'client') {
        return res.status(403).json({ message: 'Samo klijenti mogu kreirati rezervacije' });
      }

      const { id_termina } = req.body;
      const id_klijenta = req.user.id_korisnika;

      const terminCheck = await global.testDb.query(
        'SELECT * FROM termin WHERE id_termina = $1',
        [id_termina]
      );

      if (terminCheck.rows.length === 0) {
        return res.status(404).json({ message: 'Termin ne postoji' });
      }

      const existingReservation = await global.testDb.query(
        'SELECT * FROM zahtjev_za_rezervaciju WHERE id_klijenta = $1 AND id_termina = $2',
        [id_klijenta, id_termina]
      );

      if (existingReservation.rows.length > 0) {
        return res.status(400).json({ message: 'Već imate rezervaciju za ovaj termin' });
      }

      const result = await global.testDb.query(
        'INSERT INTO zahtjev_za_rezervaciju (id_klijenta, id_termina) VALUES ($1, $2) RETURNING *',
        [id_klijenta, id_termina]
      );

      return res.status(201).json(result.rows[0]);

    } catch (error) {
      console.error('Create reservation error:', error);
      return res.status(500).json({ error: 'Greška pri kreiranju rezervacije' });
    }
  },

  getUserReservations: async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Neautorizirano' });
      }

      const result = await global.testDb.query(
        `SELECT zr.*, t.datum, t.vrijeme_termina, tr.naziv as trening_naziv
         FROM zahtjev_za_rezervaciju zr
         JOIN termin t ON zr.id_termina = t.id_termina
         LEFT JOIN trening tr ON t.id_treninga = tr.id_treninga
         WHERE zr.id_klijenta = $1
         ORDER BY t.datum, t.vrijeme_termina`,
        [req.user.id_korisnika]
      );

      return res.status(200).json(result.rows);

    } catch (error) {
      return res.status(500).json({ error: 'Greška pri dohvaćanju rezervacija' });
    }
  }
};

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Token nije pronađen' });
  }

  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Nevaljan token' });
  }
};

app.post('/api/auth/register', authRoutes.register);
app.post('/api/auth/login', authRoutes.login);
app.get('/api/termini', terminRoutes.getAll);
app.post('/api/termini', authMiddleware, terminRoutes.create);
app.post('/api/rezervacije', authMiddleware, rezervacijaRoutes.create);
app.get('/api/rezervacije/my', authMiddleware, rezervacijaRoutes.getUserReservations);

describe('API Integration Tests - End-to-End', () => {
  let clientUser, trainerUser, clientToken, trainerToken;

  beforeEach(async () => {
    await TestHelpers.cleanupTestData();
    
    const clientScenario = await TestHelpers.createTestScenario('client');
    const trainerScenario = await TestHelpers.createTestScenario('trainer');
    
    clientUser = clientScenario.user;
    trainerUser = trainerScenario.user;
    clientToken = clientScenario.token;
    trainerToken = trainerScenario.token;
  });

  afterEach(async () => {
    await TestHelpers.cleanupTestData();
  });

  describe('POST /api/auth/login', () => {
    it('trebao bi uspješno prijaviti klijenta', async () => {
      const loginData = {
        email: clientUser.email,
        lozinka: clientUser.lozinka
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body.message).toBe('Login uspješan');
      expect(response.body.user.role).toBe('client');
      expect(response.body.token).toBeDefined();
    });

    it('trebao bi uspješno prijaviti trenera', async () => {
      const loginData = {
        email: trainerUser.email,
        lozinka: trainerUser.lozinka
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body.user.role).toBe('trainer');
    });
  });

  describe('POST /api/termini', () => {
    it('trebao bi dozvoliti treneru kreiranje termina', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const terminData = {
        datum: TestHelpers.formatDate(tomorrow),
        vrijeme_termina: '10:00:00',
        trajanje: 60,
        mjesto: 'Sala 1'
      };

      const response = await request(app)
        .post('/api/termini')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send(terminData)
        .expect(201);

      expect(response.body.id_termina).toBeDefined();
      expect(response.body.datum).toBeDefined();
      expect(response.body.vrijeme_termina).toBe('10:00:00');
    });

    it('trebao bi odbaciti klijente od kreiranja termina', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const terminData = {
        datum: TestHelpers.formatDate(tomorrow),
        vrijeme_termina: '10:00:00',
        trajanje: 60
      };

      const response = await request(app)
        .post('/api/termini')
        .set('Authorization', `Bearer ${clientToken}`)
        .send(terminData)
        .expect(403);

      expect(response.body.message).toBe('Samo treneri mogu kreirati termine');
    });
  });

  describe('POST /api/rezervacije', () => {
    let testTermin;

    beforeEach(async () => {
      testTermin = await TestHelpers.createTestTermin(trainerUser.id_korisnika);
    });

    it('trebao bi dozvoliti klijentu kreiranje rezervacije', async () => {
      const rezervacijaData = {
        id_termina: testTermin.id_termina
      };

      const response = await request(app)
        .post('/api/rezervacije')
        .set('Authorization', `Bearer ${clientToken}`)
        .send(rezervacijaData)
        .expect(201);

      expect(response.body.id_klijenta).toBe(clientUser.id_korisnika);
      expect(response.body.id_termina).toBe(testTermin.id_termina);
    });
  });
});