const jwt = require('jsonwebtoken');

class TestHelpers {
  
  static async createTestUser(userData = {}) {
    const defaultUser = {
      ime: 'Test',
      prezime: 'User',
      email: `test${Date.now()}${Math.random().toString(36).substring(7)}@example.com`, 
      lozinka: 'password123',
      telefon: '091234567'
    };
    
    const user = { ...defaultUser, ...userData };
    
    const result = await global.testDb.query(
      'INSERT INTO korisnik (ime, prezime, email, lozinka, telefon) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [user.ime, user.prezime, user.email, user.lozinka, user.telefon]
    );
    
    return result.rows[0];
  }

  static async createTestClient(userId, clientData = {}) {
    const userCheck = await global.testDb.query(
      'SELECT id_korisnika FROM korisnik WHERE id_korisnika = $1',
      [userId]
    );
    
    if (userCheck.rows.length === 0) {
      throw new Error(`User with id ${userId} does not exist`);
    }

    const defaultClient = {
      spol: 'M',
      datum_rodenja: '1990-01-01',
      aktivnost: 'Početnik',
      zdravstveni_problemi: null,
      lijekovi: null,
      fizicka_ogranicenja: null
    };
    
    const client = { ...defaultClient, ...clientData };
    
    const result = await global.testDb.query(
      `INSERT INTO klijent (id_korisnika, spol, datum_rodenja, aktivnost, 
       zdravstveni_problemi, lijekovi, fizicka_ogranicenja) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [userId, client.spol, client.datum_rodenja, client.aktivnost,
       client.zdravstveni_problemi, client.lijekovi, client.fizicka_ogranicenja]
    );
    
    return result.rows[0];
  }

  static async createTestTrainer(userId, trainerData = {}) {
    const userCheck = await global.testDb.query(
      'SELECT id_korisnika FROM korisnik WHERE id_korisnika = $1',
      [userId]
    );
    
    if (userCheck.rows.length === 0) {
      throw new Error(`User with id ${userId} does not exist`);
    }

    const defaultTrainer = {
      specijalizacija: 'Fitness',
      biografija: 'Iskusan trener',
      certifikat: null,
      slika: null,
      id_poslovnice: null
    };
    
    const trainer = { ...defaultTrainer, ...trainerData };
    
    const result = await global.testDb.query(
      `INSERT INTO trener (id_korisnika, specijalizacija, biografija, 
       certifikat, slika, id_poslovnice) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [userId, trainer.specijalizacija, trainer.biografija,
       trainer.certifikat, trainer.slika, trainer.id_poslovnice]
    );
    
    return result.rows[0];
  }

  static async createTestTraining(trainerId, trainingData = {}) {
    const trainerCheck = await global.testDb.query(
      'SELECT id_korisnika FROM trener WHERE id_korisnika = $1',
      [trainerId]
    );
    
    if (trainerCheck.rows.length === 0) {
      throw new Error(`Trainer with id ${trainerId} does not exist`);
    }

    const defaultTraining = {
      naziv: `Test Trening ${Date.now()}`,
      opis: 'Opis test treninga'
    };
    
    const training = { ...defaultTraining, ...trainingData };
    
    const result = await global.testDb.query(
      'INSERT INTO trening (naziv, opis, id_trenera) VALUES ($1, $2, $3) RETURNING *',
      [training.naziv, training.opis, trainerId]
    );
    
    return result.rows[0];
  }

  static async createTestTermin(trainerId, terminData = {}) {
    const trainerCheck = await global.testDb.query(
      'SELECT id_korisnika FROM trener WHERE id_korisnika = $1',
      [trainerId]
    );
    
    if (trainerCheck.rows.length === 0) {
      throw new Error(`Trainer with id ${trainerId} does not exist`);
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const defaultTermin = {
      datum: tomorrow.toISOString().split('T')[0],
      vrijeme_termina: '10:00:00',
      trajanje: '60 minutes',
      mjesto: 'Sala 1',
      dostupnost: 'available'
    };
    
    const termin = { ...defaultTermin, ...terminData };
    
    if (termin.id_treninga) {
      const trainingCheck = await global.testDb.query(
        'SELECT id_treninga FROM trening WHERE id_treninga = $1',
        [termin.id_treninga]
      );
      
      if (trainingCheck.rows.length === 0) {
        throw new Error(`Training with id ${termin.id_treninga} does not exist`);
      }
    }
    
    const result = await global.testDb.query(
      `INSERT INTO termin (id_trenera, id_treninga, datum, vrijeme_termina, 
       trajanje, mjesto, dostupnost) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [trainerId, termin.id_treninga, termin.datum, termin.vrijeme_termina,
       termin.trajanje, termin.mjesto, termin.dostupnost]
    );
    
    return result.rows[0];
  }

  static async createTestReservation(clientId, terminId, reservationData = {}) {
    const clientCheck = await global.testDb.query(
      'SELECT id_korisnika FROM klijent WHERE id_korisnika = $1',
      [clientId]
    );
    
    if (clientCheck.rows.length === 0) {
      throw new Error(`Client with id ${clientId} does not exist`);
    }

    const terminCheck = await global.testDb.query(
      'SELECT id_termina FROM termin WHERE id_termina = $1',
      [terminId]
    );
    
    if (terminCheck.rows.length === 0) {
      throw new Error(`Termin with id ${terminId} does not exist`);
    }

    const defaultReservation = {
      status_rezervacije: 'reserved'
    };
    
    const reservation = { ...defaultReservation, ...reservationData };
    
    const result = await global.testDb.query(
      `INSERT INTO zahtjev_za_rezervaciju (id_klijenta, id_termina, status_rezervacije) 
       VALUES ($1, $2, $3) RETURNING *`,
      [clientId, terminId, reservation.status_rezervacije]
    );
    
    return result.rows[0];
  }

  static async createTestExercise(exerciseData = {}) {
    const defaultExercise = {
      naziv: `Test Vježba ${Date.now()}`,
      ponavljanja: 10,
      serije: 3,
      uteg: 5.0
    };
    
    const exercise = { ...defaultExercise, ...exerciseData };
    
    const result = await global.testDb.query(
      'INSERT INTO vjezba (naziv, ponavljanja, serije, uteg) VALUES ($1, $2, $3, $4) RETURNING *',
      [exercise.naziv, exercise.ponavljanja, exercise.serije, exercise.uteg]
    );
    
    return result.rows[0];
  }

  static async linkTrainingExercise(trainingId, exerciseId) {
    const result = await global.testDb.query(
      'INSERT INTO trening_vjezba (id_treninga, id_vjezbe) VALUES ($1, $2) RETURNING *',
      [trainingId, exerciseId]
    );
    
    return result.rows[0];
  }

  static generateTestToken(user, role = 'client') {
    const payload = {
      id_korisnika: user.id_korisnika,
      ime: user.ime,
      prezime: user.prezime,
      email: user.email,
      role: role
    };
    
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
  }

  static createMockRequest(body = {}, user = null, params = {}, query = {}, headers = {}) {
    return {
      body,
      user,
      params,
      query,
      headers,
      get: jest.fn((headerName) => headers[headerName])
    };
  }

  static createMockResponse() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    res.cookie = jest.fn().mockReturnValue(res);
    res.redirect = jest.fn().mockReturnValue(res);
    return res;
  }

  static createMockNext() {
    return jest.fn();
  }

  static async createTestScenario(role = 'client') {
    const user = await this.createTestUser();
    
    let roleData = null;
    if (role === 'client') {
      roleData = await this.createTestClient(user.id_korisnika);
    } else if (role === 'trainer') {
      roleData = await this.createTestTrainer(user.id_korisnika);
    }
    
    const token = this.generateTestToken(user, role);
    
    return {
      user,
      roleData,
      token,
      role
    };
  }

  static async createFitnessScenario() {
    const trainerUser = await this.createTestUser({
      ime: 'John',
      prezime: 'Trainer',
      email: `trainer${Date.now()}${Math.random().toString(36).substring(7)}@example.com`
    });
    const trainer = await this.createTestTrainer(trainerUser.id_korisnika);
    
    const training = await this.createTestTraining(trainerUser.id_korisnika);
    
    const termin = await this.createTestTermin(trainerUser.id_korisnika, {
      id_treninga: training.id_treninga
    });
    
    const clientUser = await this.createTestUser({
      ime: 'Jane',
      prezime: 'Client',
      email: `client${Date.now()}${Math.random().toString(36).substring(7)}@example.com`
    });
    const client = await this.createTestClient(clientUser.id_korisnika);
    
    return {
      trainer: { user: trainerUser, data: trainer },
      client: { user: clientUser, data: client },
      training,
      termin
    };
  }

  static formatDate(date) {
    return date.toISOString().split('T')[0];
  }

  static formatTime(hours, minutes = 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
  }

  static async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static async cleanupTestData() {
    const client = await global.testDb.connect();
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
      await client.query('ALTER SEQUENCE IF EXISTS termin_id_termina_seq RESTART WITH 1');
      await client.query('ALTER SEQUENCE IF EXISTS trening_id_treninga_seq RESTART WITH 1');
      await client.query('ALTER SEQUENCE IF EXISTS vjezba_id_vjezbe_seq RESTART WITH 1');
      await client.query('ALTER SEQUENCE IF EXISTS zahtjev_za_rezervaciju_id_zahtjeva_seq RESTART WITH 1');
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }
}

module.exports = { TestHelpers };