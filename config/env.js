import dotenv from 'dotenv';
dotenv.config();

export const validateEnv = () => {
  if (!process.env.JWT_SECRET || !process.env.JWT_SECRET.trim()) {
    throw new Error('JWT_SECRET environment variable is required');
  }
};
