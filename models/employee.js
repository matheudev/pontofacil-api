const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  cpf: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  position: { type: String, required: true },
  department: { type: String, required: true },
  role: { type: String, enum: ['admin', 'rh', 'employee'], default: 'employee' },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Employee', employeeSchema);