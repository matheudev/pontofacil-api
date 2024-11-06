const request = require('supertest');
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Employee = require('../models/employee');
const authRoutes = require('../routes/auth');

const app = express();
app.use(express.json());
app.use('/auth', authRoutes);

jest.mock('../models/employee');
jest.mock('bcrypt');
jest.mock('jsonwebtoken');

describe('Auth Routes', () => {
  it('should login successfully with valid credentials', async () => {
    const mockEmployee = {
      _id: 'employee123',
      email: 'test@example.com',
      password: 'hashedPassword',
      role: 'employee'
    };

    Employee.findOne.mockResolvedValue(mockEmployee);
    bcrypt.compare.mockResolvedValue(true);
    jwt.sign.mockReturnValue('fakeToken');

    const response = await request(app)
      .post('/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('token', 'fakeToken');
    expect(response.body).toHaveProperty('employeeId', 'employee123');
    expect(response.body).toHaveProperty('role', 'employee');
  });

  it('should return 400 for invalid credentials', async () => {
    Employee.findOne.mockResolvedValue(null);

    const response = await request(app)
      .post('/auth/login')
      .send({ email: 'wrong@example.com', password: 'wrongpassword' });

    expect(response.statusCode).toBe(400);
    expect(response.body).toHaveProperty('message', 'Invalid email or password');
  });
});