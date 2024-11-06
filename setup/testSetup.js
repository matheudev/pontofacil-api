const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Load environment variables from a dedicated test environment file if needed
require('dotenv').config({ path: '.env.test' });

let mongoServer;

beforeAll(async () => {
  // Set required environment variables for testing
  process.env.JWT_SECRET = 'pontofacilpuc';
  process.env.MONGO_URI = 'mongodb+srv://pontofacil:pontofacil2024@cluster-pontofacil.5e2gw.mongodb.net/?retryWrites=true&w=majority&appName=cluster-pontofacil'; // Override MONGO_URI to ensure it's not used during tests

  // Initialize in-memory MongoDB server
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  // Connect mongoose to the in-memory MongoDB
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
});

afterAll(async () => {
  // Disconnect mongoose and stop the in-memory MongoDB server
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  // Clear all collections after each test to ensure test isolation
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany();
  }
});