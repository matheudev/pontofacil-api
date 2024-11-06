const request = require('supertest');
const express = require('express');
const TimeEntry = require('../models/timeEntry');
const reportRoutes = require('../routes/reportRoutes');
const authMiddleware = require('../middleware/authMiddleware');

jest.mock('../models/timeEntry');
jest.mock('../middleware/authMiddleware');
jest.mock('pdfkit');
jest.mock('fs');

const app = express();
app.use(express.json());
app.use('/report', reportRoutes);

describe('Report Routes', () => {
  beforeEach(() => {
    authMiddleware.mockImplementation(() => (req, res, next) => {
      req.employee = { id: 'employee123', name: 'John Doe', matricula: '12345' };
      next();
    });
  });

  it('should generate a monthly report', async () => {
    const mockTimeEntries = [
      { timestamp: new Date('2023-05-01T09:00:00') },
      { timestamp: new Date('2023-05-01T17:00:00') },
      { timestamp: new Date('2023-05-02T09:00:00') },
      { timestamp: new Date('2023-05-02T17:00:00') }
    ];

    TimeEntry.find.mockReturnValue({
      sort: jest.fn().mockResolvedValue(mockTimeEntries)
    });

    const response = await request(app)
      .get('/report/monthly')
      .query({ month: 5, year: 2023 });

    expect(response.statusCode).toBe(200);
    // Add more specific expectations based on your PDF generation logic
  });
});