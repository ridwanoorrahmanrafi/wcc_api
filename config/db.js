import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  // Ignore in environments where setServers is unsupported
}
import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';

let isMongoConnected = false;

export const isDatabaseConnected = () => isMongoConnected;

export const ensureCleanAuthAccounts = async () => {
  try {
    const defaultAccounts = [
      {
        name: 'WCC Administrator',
        email: 'admin@wecanchange.org',
        password: 'wccadmin2026',
        role: 'admin',
        phone: '+880 1711-000000',
        memberId: 'WCC-ADM-0001',
        status: 'active'
      }
    ];

    for (const acc of defaultAccounts) {
      const existing = await User.findOne({ email: acc.email });
      if (!existing) {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(acc.password, salt);
        await User.create({ ...acc, password: hashedPassword });
        console.log(`[Auth Init] Created default ${acc.role} account: ${acc.email}`);
      }
    }
  } catch (err) {
    console.error('[Auth Init Error]', err.message);
  }
};

export const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/wcc_db';
  try {
    console.log(`[MongoDB] Attempting connection to: ${mongoUri.replace(/:([^:@]{4})[^:@]*@/, ':****@')}`);
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000
    });
    isMongoConnected = true;
    console.log(`[MongoDB] Connected successfully: ${conn.connection.host}`);

    // Ensure clean primary test users exist
    await ensureCleanAuthAccounts();
  } catch (error) {
    isMongoConnected = false;
    console.warn(`[MongoDB] Connection notice: ${error.message}`);
    console.warn('[MongoDB] Running with in-memory resilient data store so API works immediately.');
    console.warn('[MongoDB] To connect MongoDB Atlas, set MONGO_URI in wcc_api/.env');
  }
};
