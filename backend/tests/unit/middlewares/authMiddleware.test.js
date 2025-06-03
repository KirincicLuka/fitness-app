const jwt = require('jsonwebtoken');
const { TestHelpers } = require('../../utils/testHelpers');

const authMiddleware = {

  requireRole: (roles) => {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({ message: 'Neautorizirano' });
      }

      if (!roles.includes(req.user.role)) {
        return res.status(403).json({ message: 'Nedozvoljeno - nemate potrebnu ulogu' });
      }

      next();
    };
  },
};

describe('AuthMiddleware - Poslovni sloj', () => {
  let req, res, next;
  let testUser;

  beforeEach(async () => {
    req = TestHelpers.createMockRequest();
    res = TestHelpers.createMockResponse();
    next = TestHelpers.createMockNext();

    testUser = await TestHelpers.createTestUser();
  });

  describe('requireRole', () => {
    it('trebao bi dozvoliti pristup korisniku s ispravnom ulogom', () => {
      req.user = { id_korisnika: 1, role: 'client' };
      const middleware = authMiddleware.requireRole(['client', 'trainer']);

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('trebao bi dozvoliti pristup za jednu od dozvoljenih uloga', () => {
      req.user = { id_korisnika: 1, role: 'trainer' };
      const middleware = authMiddleware.requireRole(['client', 'trainer', 'admin']);

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('trebao bi odbaciti korisnika s neispravnom ulogom', () => {
      req.user = { id_korisnika: 1, role: 'client' };
      const middleware = authMiddleware.requireRole(['admin']);

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Nedozvoljeno - nemate potrebnu ulogu' });
      expect(next).not.toHaveBeenCalled();
    });

    it('trebao bi odbaciti neautorizirane korisnike', () => {
      req.user = null;
      const middleware = authMiddleware.requireRole(['client']);

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Neautorizirano' });
      expect(next).not.toHaveBeenCalled();
    });

    it('trebao bi raditi s praznim nizom dozvoljenih uloga', () => {
      req.user = { id_korisnika: 1, role: 'client' };
      const middleware = authMiddleware.requireRole([]);

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Nedozvoljeno - nemate potrebnu ulogu' });
      expect(next).not.toHaveBeenCalled();
    });
  });

});