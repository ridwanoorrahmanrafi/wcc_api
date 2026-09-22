import dotenv from 'dotenv';
import { connectDB, seedDatabase } from '../config/db.js';
import mongoose from 'mongoose';

dotenv.config();

const run = async () => {
  console.log('[Manual Seed] Connecting to MongoDB...');
  await connectDB();
  console.log('[Manual Seed] Running seed...');
  await seedDatabase();
  console.log('[Manual Seed] Done.');
  process.exit(0);
};

run();
