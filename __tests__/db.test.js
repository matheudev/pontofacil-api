const mongoose = require('mongoose');
const connectDB = require('../config/db');

jest.mock('mongoose');

describe('Database Connection', () => {
  it('should connect to the database successfully', async () => {
    mongoose.connect.mockResolvedValue();
    console.log = jest.fn();

    await connectDB();

    expect(mongoose.connect).toHaveBeenCalledWith(process.env.MONGO_URI);
    expect(console.log).toHaveBeenCalledWith('MongoDB conectado com sucesso');
  });

  it('should handle connection errors', async () => {
    const mockError = new Error('Connection failed');
    mongoose.connect.mockRejectedValue(mockError);
    console.error = jest.fn();
    process.exit = jest.fn();

    await connectDB();

    expect(console.error).toHaveBeenCalledWith('Erro na conexão com o MongoDB:', mockError);
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});