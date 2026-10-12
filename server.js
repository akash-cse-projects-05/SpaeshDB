const app = require('./src/app');

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`Sparsh Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  
  // Start Twilio WhatsApp Client
  const whatsappService = require('./src/services/whatsappService');
  whatsappService.initializeWhatsAppClient();

  // Start Automated Reminders
  const reminderService = require('./src/services/reminderService');
  reminderService.startReminderService();
});

const gracefulShutdown = () => {
  console.log('Received kill signal, shutting down gracefully');
  server.close(async () => {
    console.log('Closed out remaining connections');
    try {
      const mongoose = require('mongoose');
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.close(false);
        console.log('MongoDB connection closed');
      }
      process.exit(0);
    } catch (err) {
      console.error('Error closing MongoDB connection', err);
      process.exit(1);
    }
  });

  // Force close after 10 seconds
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

module.exports = server;
