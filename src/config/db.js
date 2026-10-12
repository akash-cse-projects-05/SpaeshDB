const mongoose = require('mongoose');

const connectDB = async () => {
  const primaryURI = process.env.MONGODB_URI;
  const fallbackURI = 'mongodb://127.0.0.1:27017/sparsh';

  try {
    const conn = await mongoose.connect(primaryURI || fallbackURI, {
      serverSelectionTimeoutMS: 4000
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    if (primaryURI && primaryURI !== fallbackURI) {
      console.warn(`⚠️ Primary Database connection failed: ${error.message}. Retrying with local fallback: ${fallbackURI}`);
      try {
        const conn = await mongoose.connect(fallbackURI, {
          serverSelectionTimeoutMS: 3000
        });
        console.log(`✅ MongoDB Connected (Fallback): ${conn.connection.host}`);
        return conn;
      } catch (fallbackError) {
        console.error(`❌ Database Connection Error (Fallback also failed): ${fallbackError.message}`);
        process.exit(1);
      }
    } else {
      console.error(`❌ Database Connection Error: ${error.message}`);
      process.exit(1);
    }
  }
};

module.exports = connectDB;
