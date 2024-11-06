const request = require('supertest');
const express = require('express');
const bcrypt = require('bcrypt');
const Employee = require('../models/employee');
const Company = require('../models/company');
const employeeRoutes = require('../routes/employee');
const authMiddleware = require('../middleware/authMiddleware');

const app = express();
app.use(express.json());
app.use('/employee', employeeRoutes);

jest.mock('../models/employee');
jest.mock('../models/company');
jest.mock('bcrypt');
jest.mock('../middleware/authMiddleware');

// Mock authMiddleware to pass through and set req.employee
authMiddleware.mockImplementation((roles) => (req, res, next) => {
  req.employee = { role: 'admin', company: 'company123' };
  next();
});

describe('Employee Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should register a company and admin successfully', async () => {
    Employee.findOne.mockResolvedValue(null);
    Company.prototype.save.mockResolvedValue();
    Employee.prototype.save.mockResolvedValue();
    bcrypt.genSalt.mockResolvedValue('salt');
    bcrypt.hash.mockResolvedValue('hashedPassword');

    const response = await request(app)
      .post('/employee/register-company')
      .send({
        companyName: 'Test Company',
        adminName: 'Admin User',
        email: 'admin@example.com',
        password: 'password123'
      });

    expect(response.statusCode).toBe(201);
    expect(response.body).toHaveProperty('message', 'Company and admin registered successfully');
  });

  it('should register an employee successfully', async () => {
    Employee.findOne.mockResolvedValue(null);
    Employee.prototype.save.mockResolvedValue();
    bcrypt.genSalt.mockResolvedValue('salt');
    bcrypt.hash.mockResolvedValue('hashedPassword');

    const response = await request(app)
      .post('/employee/register')
      .send({
        name: 'Test Employee',
        email: 'employee@example.com',
        password: 'password123',
        position: 'Developer',
        role: 'employee'
      });

    expect(response.statusCode).toBe(201);
    expect(response.body).toHaveProperty('message', 'Employee registered successfully');
  });

  it('should get all employees', async () => {
    authMiddleware.mockImplementation((roles) => (req, res, next) => {
      req.employee = { role: 'admin', company: 'company123' };
      next();
    });

    const mockEmployees = [
      { name: 'Employee 1', email: 'emp1@example.com' },
      { name: 'Employee 2', email: 'emp2@example.com' }
    ];

    Employee.find.mockReturnValue({
      select: jest.fn().mockResolvedValue(mockEmployees)
    });

    const response = await request(app).get('/employee');

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual(mockEmployees);
  });
});