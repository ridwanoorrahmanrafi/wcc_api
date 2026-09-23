import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  // Ignore in environments where setServers is unsupported
}
import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';

let isMongoConnected = false;

export const isDatabaseConnected = () => isMongoConnected;

export const connectDB = async () => {
  if (isMongoConnected || mongoose.connection.readyState === 1) {
    return;
  }
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/wcc_db';
  try {
    console.log(`[MongoDB] Attempting connection to: ${mongoUri.replace(/:([^:@]{4})[^:@]*@/, ':****@')}`);
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000
    });
    isMongoConnected = true;
    console.log(`[MongoDB] Connected successfully: ${conn.connection.host}`);
  } catch (error) {
    isMongoConnected = false;
    console.warn(`[MongoDB] Connection notice: ${error.message}`);
    console.warn('[MongoDB] Running with in-memory resilient data store so API works immediately.');
    console.warn('[MongoDB] To connect MongoDB Atlas, set MONGO_URI in wcc_api/.env');
  }
};

export const seedDatabase = async () => {
  try {
    const { runComprehensiveSeed } = await import('../scripts/comprehensiveSeed.js');
    await runComprehensiveSeed();
  } catch (err) {
    console.error('[Seed Error]', err.message);
  }
};
