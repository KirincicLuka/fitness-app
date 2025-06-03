const { TestHelpers } = require('../../utils/testHelpers');

const zahtjevController = {
  create: async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Neautorizirano. Potrebna prijava.' });
      }

      const id_klijenta = req.user.id_korisnika;
      const id_termina = req.body.id_termina;

      const terminResult = await global.testDb.query(
        'SELECT * FROM termin WHERE id_termina = $1',
        [id_termina]
      );

      if (terminResult.rows.length === 0) {
        return res.status(404).json({ message: 'Termin ne postoji.' });
      }

      const termin = terminResult.rows[0];

      if (termin.id_trenera === id_klijenta) {
        return res.status(403).json({ message: 'Trener ne može rezervirati vlastiti termin.' });
      }

      const terminDateTime = new Date(`${termin.datum}T${termin.vrijeme_termina}`);
      if (terminDateTime < new Date()) {
        return res.status(400).json({ message: 'Ne možete rezervirati termin u prošlosti.' });
      }

      const existingReservation = await global.testDb.query(
        'SELECT * FROM zahtjev_za_rezervaciju WHERE id_klijenta = $1 AND id_termina = $2',
        [id_klijenta, id_termina]
      );

      if (existingReservation.rows.length > 0) {
        return res.status(400).json({ message: 'Već imate rezervaciju za ovaj termin.' });
      }

      const reservationResult = await global.testDb.query(
        'INSERT INTO zahtjev_za_rezervaciju (id_klijenta, id_termina, status_rezervacije) VALUES ($1, $2, $3) RETURNING *',
        [id_klijenta, id_termina, 'reserved']
      );

      return res.status(201).json(reservationResult.rows[0]);

    } catch (error) {
      console.error('Greška u create:', error);
      return res.status(500).json({ error: 'Greška pri kreiranju rezervacije' });
    }
  },

  getUserReservations: async (req, res) => {
    try {
      const id_klijenta = req.user.id_korisnika;
      
      const result = await global.testDb.query(
        `SELECT zr.*, t.datum, t.vrijeme_termina 
         FROM zahtjev_za_rezervaciju zr 
         JOIN termin t ON zr.id_termina = t.id_termina 
         WHERE zr.id_klijenta = $1`,
        [id_klijenta]
      );

      return res.status(200).json(result.rows);
    } catch (error) {
      return res.status(500).json({ error: 'Greška pri dohvaćanju rezervacija' });
    }
  }
};

describe('ZahtjevController - Prezentacijski sloj', () => {
  let req, res, next;
  let testClient, testTrainer, testTermin, testTraining;

  beforeEach(async () => {
    await TestHelpers.cleanupTestData();
    
    req = TestHelpers.createMockRequest();
    res = TestHelpers.createMockResponse();
    next = TestHelpers.createMockNext();

    const scenario = await TestHelpers.createFitnessScenario();
    testClient = scenario.client;
    testTrainer = scenario.trainer;
    testTraining = scenario.training;
    testTermin = scenario.termin;
  });

  afterEach(async () => {
    await TestHelpers.cleanupTestData();
  });

  describe('create - Kreiranje rezervacije', () => {
    it('trebao bi uspješno kreirati rezervaciju za valjan termin', async () => {
      req.body = { id_termina: testTermin.id_termina };
      req.user = {
        id_korisnika: testClient.user.id_korisnika,
        role: 'client'
      };

      await zahtjevController.create(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          id_klijenta: testClient.user.id_korisnika,
          id_termina: testTermin.id_termina,
          status_rezervacije: 'reserved'
        })
      );

      const reservations = await global.testDb.query(
        'SELECT * FROM zahtjev_za_rezervaciju WHERE id_klijenta = $1 AND id_termina = $2',
        [testClient.user.id_korisnika, testTermin.id_termina]
      );
      expect(reservations.rows).toHaveLength(1);
    });
  });

  describe('getUserReservations - Dohvaćanje korisničkih rezervacija', () => {
    it('trebao bi dohvatiti sve rezervacije korisnika', async () => {
      await TestHelpers.createTestReservation(
        testClient.user.id_korisnika,
        testTermin.id_termina
      );

      req.user = {
        id_korisnika: testClient.user.id_korisnika,
        role: 'client'
      };

      await zahtjevController.getUserReservations(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id_klijenta: testClient.user.id_korisnika,
            id_termina: testTermin.id_termina
          })
        ])
      );
    });

    it('trebao bi vratiti prazan niz za korisnika bez rezervacija', async () => {
      const newClient = await TestHelpers.createTestScenario('client');

      req.user = {
        id_korisnika: newClient.user.id_korisnika,
        role: 'client'
      };

      await zahtjevController.getUserReservations(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([]);
    });
  });
});