const mongoose = require('mongoose');

let isConnected = false;

const connectDB = async () => {
  // Reuse existing connection in serverless environment
  if (isConnected || mongoose.connection.readyState === 1) {
    return mongoose;
  }

  const primaryURI = process.env.MONGODB_URI;
  const fallbackURI = 'mongodb://127.0.0.1:27017/sparsh';

  try {
    const conn = await mongoose.connect(primaryURI || fallbackURI, {
      serverSelectionTimeoutMS: 5000
    });
    isConnected = true;
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    if (primaryURI && primaryURI !== fallbackURI) {
      console.warn(`⚠️ Primary Database connection failed: ${error.message}. Retrying with local fallback: ${fallbackURI}`);
      try {
        const conn = await mongoose.connect(fallbackURI, {
          serverSelectionTimeoutMS: 3000
        });
        isConnected = true;
        console.log(`✅ MongoDB Connected (Fallback): ${conn.connection.host}`);
        return conn;
      } catch (fallbackError) {
        console.error(`❌ Database Connection Error (Fallback also failed): ${fallbackError.message}`);
        if (!process.env.VERCEL && process.env.NODE_ENV !== 'production') {
          process.exit(1);
        }
        throw fallbackError;
      }
    } else {
      console.error(`❌ Database Connection Error: ${error.message}`);
      if (!process.env.VERCEL && process.env.NODE_ENV !== 'production') {
        process.exit(1);
      }
      throw error;
    }
  }
};

module.exports = connectDB;

