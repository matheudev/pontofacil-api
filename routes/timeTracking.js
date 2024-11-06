const express = require('express');
const TimeEntry = require('../models/timeEntry');
const authMiddleware = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

const router = express.Router();

router.post('/', authMiddleware(['admin', 'rh', 'employee']), async (req, res) => {
  const { type, timestamp } = req.body;
  
  try {
    // Get employee ID from the JWT token
    const employeeId = req.employee?._id || req.employee?.id;
    const company = req.employee?.company;

    // Input validation
    if (!type || !['in', 'out'].includes(type)) {
      return res.status(400).json({ message: 'Invalid type. Must be "in" or "out"' });
    }

    if (!timestamp || isNaN(new Date(timestamp).getTime())) {
      return res.status(400).json({ message: 'Invalid timestamp' });
    }

    if (!employeeId) {
      return res.status(401).json({ message: 'Employee ID not found in token' });
    }

    // Create and save time entry
    const timeEntry = new TimeEntry({
      employee: employeeId,
      company: company,
      type,
      timestamp: new Date(timestamp)
    });

    const savedEntry = await timeEntry.save();
    
    logger.info('Time entry created successfully', {
      entryId: savedEntry._id,
      employeeId: employeeId,
      type: savedEntry.type,
      timestamp: savedEntry.timestamp
    });
    
    return res.status(201).json({ 
      message: 'Time entry recorded successfully',
      entry: savedEntry
    });

  } catch (error) {
    logger.error('Error creating time entry', {
      error: error.message,
      stack: error.stack,
      employeeId: req.employee?._id || req.employee?.id,
      requestBody: req.body
    });

    return res.status(500).json({ 
      message: 'Error creating time entry: ' + error.message
    });
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
      const endDate = new Date(year, month, 0, 23, 59, 59);
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