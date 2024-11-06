const express = require('express');
const TimeEntry = require('../models/timeEntry');
const authMiddleware = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

const router = express.Router();

router.post('/', authMiddleware(['admin', 'rh', 'employee']), async (req, res) => {
  const { type, timestamp } = req.body;
  
  logger.info('Time entry creation attempt', {
    employeeId: req.employee.id,
    type,
    timestamp
  });

  try {
    const timeEntry = new TimeEntry({
      employee: req.employee.id,
      company: req.employee.company,
      type,
      timestamp
    });

    await timeEntry.save();
    
    logger.info('Time entry created successfully', {
      entryId: timeEntry._id,
      employeeId: req.employee.id
    });
    
    res.status(201).json({ message: 'Time entry recorded successfully' });
  } catch (error) {
    logger.error('Error creating time entry', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/', authMiddleware(['admin', 'rh', 'employee']), async (req, res) => {
  const { month, year, userId } = req.query;
  
  logger.info('Fetching time entries', {
    requestedBy: req.employee.id,
    filters: { month, year, userId }
  });

  try {
    let query = { company: req.employee.company };

    if (req.employee.role === 'employee') {
      query.employee = req.employee.id;
    } else if (userId) {
      query.employee = userId;
    }

    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      query.timestamp = { $gte: startDate, $lte: endDate };
    }

    const timeEntries = await TimeEntry.find(query)
      .sort({ timestamp: -1 })
      .populate('employee', 'name email');

    logger.info('Time entries fetched successfully', {
      count: timeEntries.length
    });

    res.json(timeEntries);
  } catch (error) {
    logger.error('Error fetching time entries', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;