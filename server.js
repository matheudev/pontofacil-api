const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

// Load environment variables
dotenv.config();

const app = express();

// CORS configuration
app.use(cors({
  origin: ['http://localhost:3000', 'https://pontofacil-web.vercel.app'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-auth-token', 'authorization'],
  credentials: true
}));

// Middleware
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/employees', require('./routes/employee'));
app.use('/api/timetracking', require('./routes/timeTracking'));
app.use('/api/absences', require('./routes/absence'));
app.use('/api/report', require('./routes/report'));

if (process.env.NODE_ENV !== 'test') {
    const PORT = process.env.PORT || 3001;
    connectDB().then(() => {
      app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    });
}

module.exports = { app, connectDB };