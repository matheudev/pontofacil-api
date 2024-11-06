const request = require('supertest');
const express = require('express');
const Absence = require('../models/absence');
const absenceRoutes = require('../routes/absence');
const authMiddleware = require('../middleware/authMiddleware');

jest.mock('../models/absence');
jest.mock('../middleware/authMiddleware');

const app = express();
app.use(express.json());
app.use('/absence', absenceRoutes);

describe('Absence Routes', () => {
  beforeEach(() => {
    authMiddleware.mockImplementation(() => (req, res, next) => {
      req.employee = { id: 'employee123', company: 'company123' };
      next();
    });
  });

  it('should submit an absence justification successfully', async () => {
    Absence.prototype.save.mockResolvedValue();

    const response = await request(app)
      .post('/absence')
      .send({
        date: new Date(),
        reason: 'Sick leave',
        document: 'doctor-note.pdf'
      });

    expect(response.statusCode).toBe(201);
    expect(response.body).toHaveProperty('message', 'Absence justification submitted successfully');
  });

  // Add more tests as needed
});