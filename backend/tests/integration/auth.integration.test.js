const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const { TestHelpers } = require('../utils/testHelpers');

const app = express();
app.use(express.json());

const authController = {
  register: async (req, res) => {
    try {
      const { ime, prezime, email, lozinka, telefon, role, spol, datum_rodenja, aktivnost, specijalizacija, biografija } = req.body;

      if (!ime || !prezime || !email || !lozinka) {
        return res.status(400).json({ message: 'Nedostaju obavezni podaci' });
      }

      if (lozinka.length < 6) {
        return res.status(400).json({ message: 'Lozinka mora imati najmanje 6 znakova' });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: 'Neispravan format emaila' });
      }

      const existingUser = await global.testDb.query(
        'SELECT id_korisnika FROM korisnik WHERE email = $1',
        [email]
      );

      if (existingUser.rows.length > 0) {
        return res.status(409).json({ message: 'Korisnik s tim emailom već postoji' });
      }

      const userResult = await global.testDb.query(
        'INSERT INTO korisnik (ime, prezime, email, lozinka, telefon) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [ime, prezime, email, lozinka, telefon]
      );

      const user = userResult.rows[0];
      let roleData = null;

      if (role === 'client') {
        const clientResult = await global.testDb.query(
          'INSERT INTO klijent (id_korisnika, spol, datum_rodenja, aktivnost) VALUES ($1, $2, $3, $4) RETURNING *',
          [user.id_korisnika, spol, datum_rodenja, aktivnost]
        );
        roleData = clientResult.rows[0];
      } else if (role === 'trainer') {
        const trainerResult = await global.testDb.query(
          'INSERT INTO trener (id_korisnika, specijalizacija, biografija) VALUES ($1, $2, $3) RETURNING *',
          [user.id_korisnika, specijalizacija, biografija]
        );
        roleData = trainerResult.rows[0];
      }

      return res.status(201).json({
        message: 'Uspješno registriran korisnik',
        user: {
          id_korisnika: user.id_korisnika,
          ime: user.ime,
          prezime: user.prezime,
          email: user.email,
          role: role || 'user'
        },
        roleData
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
      let roleData = null;

      if (clientCheck.rows.length > 0) {
        role = 'client';
        roleData = clientCheck.rows[0];
      } else if (trainerCheck.rows.length > 0) {
        role = 'trainer';
        roleData = trainerCheck.rows[0];
      }

      const token = jwt.sign(
        {
          id_korisnika: user.id_korisnika,
          ime: user.ime,
          prezime: user.prezime,
          email: user.email,
          role: role
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      return res.status(200).json({
        message: 'Login uspješan',
        user: {
          id_korisnika: user.id_korisnika,
          ime: user.ime,
          prezime: user.prezime,
          email: user.email,
          role: role
        },
        token,
        roleData
      });

    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({ error: 'Greška pri prijavi' });
    }
  },

  me: async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Neautorizirano' });
      }

      const userResult = await global.testDb.query(
        'SELECT * FROM korisnik WHERE id_korisnika = $1',
        [req.user.id_korisnika]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({ message: 'Korisnik nije pronađen' });
      }

      const user = userResult.rows[0];
      
      return res.status(200).json({
        user: {
          id_korisnika: user.id_korisnika,
          ime: user.ime,
          prezime: user.prezime,
          email: user.email,
          role: req.user.role
        }
      });

    } catch (error) {
      return res.status(500).json({ error: 'Greška pri dohvaćanju korisnika' });
    }
  },

  logout: async (req, res) => {
    return res.status(200).json({ message: 'Uspješno odjavljen' });
  }
};

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Token nije pronađen' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token je istekao' });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ message: 'Nevaljan token' });
    }
    return res.status(403).json({ message: 'Greška pri validaciji tokena' });
  }
};

app.post('/api/auth/register', authController.register);
app.post('/api/auth/login', authController.login);
app.get('/api/auth/me', authMiddleware, authController.me);
app.post('/api/auth/logout', authController.logout);

describe('Auth Integration Tests - Autentifikacija End-to-End', () => {
  
  beforeEach(async () => {
    await TestHelpers.cleanupTestData();
  });

  afterEach(async () => {
    await TestHelpers.cleanupTestData();
  });

  describe('Complex Auth Flows - Složeni tokovi autentifikacije', () => {

    it('trebao bi spriječiti pristup s invalidnim tokenima kroz kompletan flow', async () => {
      const scenario = await TestHelpers.createTestScenario('trainer');
      const token = scenario.token;

      await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer nevaljan_token')
        .expect(403);

      await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}extra`)
        .expect(403);

      await request(app)
        .get('/api/auth/me')
        .expect(401);
    });
  });
});