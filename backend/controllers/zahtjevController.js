const Zahtjev = require("../models/zahtjev");
const db = require("../db");

exports.create = async (req, res) => {
  const id_klijenta = req.user.id_korisnika;
  const id_termina = req.body.id_termina;

  try {
    // validacija
    const terminRes = await db.query(
      `SELECT datum, vrijeme_termina, trajanje, id_trenera 
       FROM termin 
       WHERE id_termina = $1`,
      [id_termina]
    );

    if (terminRes.rows.length === 0) {
      return res.status(404).json({ message: "Termin ne postoji." });
    }

    const { datum, vrijeme_termina, trajanje, id_trenera } = terminRes.rows[0];

    // validacija
    if (id_trenera === id_klijenta) {
      return res.status(403).json({ message: "Trener ne može rezervirati vlastiti termin." });
    }

    const [h, m, s] = vrijeme_termina.split(":").map(Number);
    const vrijemePocetka = new Date(datum);
    vrijemePocetka.setHours(h, m, s || 0, 0);

    const sada = new Date();
    if (vrijemePocetka < sada) {
      return res.status(400).json({ message: "Ne možeš rezervirati termin u prošlosti." });
    }

    // validacija
    const vecPostoji = await db.query(
      `SELECT * FROM zahtjev_za_rezervaciju 
       WHERE id_klijenta = $1 AND id_termina = $2`,
      [id_klijenta, id_termina]
    );

    if (vecPostoji.rows.length > 0) {
      return res.status(409).json({ message: "Već si rezervirao ovaj termin." });
    }

    // validacija
    const terminVecRezerviran = await db.query(
      `SELECT * FROM zahtjev_za_rezervaciju 
       WHERE id_termina = $1 AND status_rezervacije = 'reserved'`,
      [id_termina]
    );

    if (terminVecRezerviran.rows.length > 0) {
      return res.status(409).json({ message: "Ovaj termin je već rezerviran." });
    }

    const zahtjev = await Zahtjev.create({
      id_klijenta,
      id_termina,
      vrijeme_zahtjeva: new Date(),
      status_rezervacije: "reserved",
    });

    res.status(201).json(zahtjev);
  } catch (err) {
    console.error("Greška prilikom rezervacije:", err);
    res.status(500).json({ error: err.message });
  }

};

exports.getMyReservations = async (req, res) => {
  try {
    const id_klijenta = req.user.id_korisnika;
    
    const result = await db.query(`
      SELECT z.*, t.datum, t.vrijeme_termina, t.id_trenera
      FROM zahtjev_za_rezervaciju z
      JOIN termin t ON z.id_termina = t.id_termina
      WHERE z.id_klijenta = $1
    `, [id_klijenta]);
    
    res.json(result.rows);
  } catch (err) {
    console.error("Greška:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.getReservationsForTrainer = async (req, res) => {
  try {
    const id_trenera = req.user.id_korisnika;
    
    const result = await db.query(`
      SELECT z.*, t.datum, t.vrijeme_termina, k.ime, k.prezime
      FROM zahtjev_za_rezervaciju z
      JOIN termin t ON z.id_termina = t.id_termina
      JOIN korisnik k ON z.id_klijenta = k.id_korisnika
      WHERE t.id_trenera = $1 AND z.status_rezervacije = 'reserved'
    `, [id_trenera]);
    
    res.json(result.rows);
  } catch (err) {
    console.error("Greška:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.cancel = async (req, res) => {
  try {
    const id_klijenta = req.user.id_korisnika;
    const id_termina = req.params.id; // ID termina iz URL-a
    
    // Provjeri postoji li rezervacija
    const rezervacija = await db.query(`
      SELECT z.*, t.datum, t.vrijeme_termina 
      FROM zahtjev_za_rezervaciju z
      JOIN termin t ON z.id_termina = t.id_termina
      WHERE z.id_klijenta = $1 AND z.id_termina = $2 AND z.status_rezervacije = 'reserved'
    `, [id_klijenta, id_termina]);

    if (rezervacija.rows.length === 0) {
      return res.status(404).json({ message: "Rezervacija ne postoji ili već je otkazana." });
    }

    // Provjeri može li se otkazati (npr. samo ako je termin u budućnosti)
    const { datum, vrijeme_termina } = rezervacija.rows[0];
    const [h, m, s] = vrijeme_termina.split(":").map(Number);
    const vrijemeTermina = new Date(datum);
    vrijemeTermina.setHours(h, m, s || 0, 0);

    const sada = new Date();
    if (vrijemeTermina < sada) {
      return res.status(400).json({ message: "Ne možeš otkazati termin koji je već prošao." });
    }

    // Obriši rezervaciju
    const result = await db.query(`
      DELETE FROM zahtjev_za_rezervaciju 
      WHERE id_klijenta = $1 AND id_termina = $2 AND status_rezervacije = 'reserved'
      RETURNING *
    `, [id_klijenta, id_termina]);

    if (result.rows.length === 0) {
      return res.status(500).json({ message: "Greška prilikom otkazivanja rezervacije." });
    }

    res.json({ 
      message: "Rezervacija je uspješno otkazana.",
      otkazana_rezervacija: result.rows[0]
    });

  } catch (err) {
    console.error("Greška prilikom otkazivanja rezervacije:", err);
    res.status(500).json({ error: err.message });
  }
};