const express = require('express');
const Absence = require('../models/absence');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', authMiddleware(['employee']), async (req, res) => {
  const { date, reason, document } = req.body;

  try {
    const absence = new Absence({
      employee: req.employee.id,
      company: req.employee.company,
      date,
      reason,
      document
    });

    await absence.save();
    res.status(201).json({ message: 'Absence justification submitted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/', authMiddleware(['admin', 'rh', 'employee']), async (req, res) => {
  try {
    let query;
    if (req.employee.role === 'employee') {
      query = { employee: req.employee.id, company: req.employee.company };
    } else {
      query = { company: req.employee.company };
    }

    const absences = await Absence.find(query).sort({ date: -1 });
    res.json(absences);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.patch('/:id/status', authMiddleware(['admin', 'rh']), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const absence = await Absence.findOne({
      _id: id,
      company: req.employee.company
    });

    if (!absence) {
      return res.status(404).json({ message: 'Absence not found' });
    }

    absence.status = status;
    await absence.save();

    res.json({ message: 'Status updated successfully', absence });
  } catch (error) {
    console.error('Error updating absence status:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;