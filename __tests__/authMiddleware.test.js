const jwt = require('jsonwebtoken');
const Employee = require('../models/employee');
const authMiddleware = require('../middleware/authMiddleware');

jest.mock('jsonwebtoken');
jest.mock('../models/employee');

describe('Auth Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      header: jest.fn()
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
  });

  it('should call next() for a valid token and role', async () => {
    req.header.mockReturnValue('validToken');
    jwt.verify.mockReturnValue({ id: 'employee123' });
    Employee.findById.mockResolvedValue({ _id: 'employee123', role: 'admin' });

    await authMiddleware(['admin'])(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.employee).toBeDefined();
  });

  it('should return 401 for missing token', async () => {
    req.header.mockReturnValue(null);

    await authMiddleware(['admin'])(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'No token, authorization denied' });
  });

  it('should return 403 for insufficient role', async () => {
    req.header.mockReturnValue('validToken');
    jwt.verify.mockReturnValue({ id: 'employee123' });
    Employee.findById.mockResolvedValue({ _id: 'employee123', role: 'employee' });

    await authMiddleware(['admin'])(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Access denied' });
  });
});