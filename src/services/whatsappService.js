const twilio = require('twilio');

const defaultProvider = (process.env.NODE_ENV === 'production' || process.env.VERCEL) ? 'simulated' : 'web';
const provider = (process.env.WHATSAPP_PROVIDER || defaultProvider).toLowerCase(); // 'web', 'twilio', or 'simulated'
const accountSid = process.env.TWILIO_ACCOUNT_SID;

const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioNumber = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';
const contentSid = process.env.TWILIO_CONTENT_SID;

let twilioClient = null;
let webClient = null;

exports.initializeWhatsAppClient = () => {
  if (provider === 'twilio') {
    if (accountSid && authToken) {
      try {
        twilioClient = twilio(accountSid, authToken);
        console.log("✅ Twilio WhatsApp Client Initialized.");
      } catch (err) {
        console.error("⚠️ Failed to initialize Twilio client:", err.message);
      }
    } else {
      console.log("ℹ️ No Twilio credentials in .env. WhatsApp running in SIMULATED mode.");
    }
  } else if (provider === 'web') {
    initializeWebClient();
  } else {
    console.log("📱 WhatsApp service running in SIMULATED mode (Console log output).");
  }
};

function initializeWebClient() {
  if (webClient) return;
  try {
    const { Client, LocalAuth } = require('whatsapp-web.js');
    const qrcode = require('qrcode-terminal');
    const fs = require('fs');

    let chromePath = undefined;
    if (process.platform === 'darwin') {
      if (fs.existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')) {
        chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
      }
    } else if (process.platform === 'win32') {
      if (fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')) {
        chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
      } else if (fs.existsSync('C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe')) {
        chromePath = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
      }
    }

    webClient = new Client({
      authStrategy: new LocalAuth({ clientId: "sparsh-session" }),
      puppeteer: {
        headless: true,
        executablePath: chromePath,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
      }
    });

    webClient.on('qr', (qr) => {
      console.log("\n==================================================================");
      console.log("📲 SCAN THIS QR CODE WITH YOUR WHATSAPP TO CONNECT Sparsh FOR FREE:");
      console.log("==================================================================");
      qrcode.generate(qr, { small: true });
      console.log("==================================================================\n");
    });

    webClient.on('ready', () => {
      console.log("✅ WhatsApp Web Client Connected and Ready!");
    });

    webClient.on('message_create', async (msg) => {
      try {
        // 1. Ignore group chats, broadcast lists, newsletters, status updates, and @lid system messages
        if (
          !msg.from ||
          msg.from.endsWith('@g.us') ||
          msg.from.endsWith('@broadcast') ||
          msg.from.endsWith('@lid') ||
          msg.from.endsWith('@newsletter') ||
          msg.from === 'status@broadcast'
        ) return;

        const body = (msg.body || '').trim().toLowerCase();
        if (!body) return;

        // 2. Ignore messages sent by yourself UNLESS it's a test command (1, 2, accept, decline, hi, book, etc.)
        const isActionOrBookingCommand = /^(1|2|accept|approve|yes|ok|confirm|decline|reject|no|cancel|hi|hello|book|appointment|help|sparsh|doctor|slot|pep|prep|hey)/i.test(body);
        if (msg.fromMe && !isActionOrBookingCommand) return;

        // 3. Check if this is a Doctor replying to approve/reject an appointment directly in WhatsApp
        const doctorReply = await handleDoctorReply(msg.from, msg.body);
        if (doctorReply) {
          await msg.reply(doctorReply);
          console.log(`👨‍⚕️ Doctor status action processed for ${msg.from}`);
          return;
        }

        // 4. Strict Safety Check: Only trigger AI bot if message starts with booking keywords OR user has an active session
        const isTriggerKeyword = /^(hi|hello|book|appointment|help|sparsh|doctor|slot|pep|prep|hey)/i.test(body);

        let hasActiveSession = false;
        try {
          const User = require('../models/User');
          const cleanPhone = msg.from.replace(/\D/g, '');
          if (cleanPhone && cleanPhone.length >= 10) {
            const existingUser = await User.findOne({ phoneNumber: { $regex: cleanPhone.slice(-10) } });
            hasActiveSession = !!(existingUser && existingUser.whatsappSession && existingUser.whatsappSession.state && existingUser.whatsappSession.state !== 'IDLE');
          }
        } catch (e) { }

        // If it's a normal personal conversation from a friend/family, DO NOT auto-reply!
        if (!isTriggerKeyword && !hasActiveSession) {
          return;
        }

        const aiBookingService = require('./aiBookingService');
        const reply = await aiBookingService.handleIncomingMessage(msg.from, msg.body);
        if (reply) {
          await msg.reply(reply);
          console.log(`🤖 Sparsh AI Bot replied to ${msg.from}`);
        }
      } catch (err) {
        console.error("❌ Error handling web client incoming message:", err.message);
      }
    });

    async function handleDoctorReply(fromPhone, body) {
      try {
        const text = (body || '').trim().toLowerCase();
        const isApprove = /^(1|accept|approve|yes|ok|confirm)/i.test(text);
        const isReject = /^(2|decline|reject|no|cancel)/i.test(text);

        if (!isApprove && !isReject) return null;

        const Doctor = require('../models/Doctor');
        const Appointment = require('../models/Appointment');

        // Extract last 10 digits of the sender's phone number
        const digitsOnly = fromPhone.replace(/\D/g, '');
        const last10 = digitsOnly.slice(-10);

        let doctor = null;
        if (last10 && last10.length >= 10) {
          doctor = await Doctor.findOne({ phoneNumber: { $regex: last10 } });
        }

        let appointment = null;

        // 1. Try finding pending appointment for this specific doctor
        if (doctor) {
          appointment = await Appointment.findOne({
            doctorId: doctor._id,
            status: { $regex: /^pending$/i }
          }).sort({ createdAt: -1 });
        }

        // 2. Fallback: Find the latest pending appointment in the system
        if (!appointment) {
          appointment = await Appointment.findOne({ status: { $regex: /^pending$/i } }).sort({ createdAt: -1 });
          if (appointment && !doctor) {
            doctor = await Doctor.findById(appointment.doctorId);
          }
        }

        if (!appointment) {
          return `ℹ️ No pending appointment requests were found in the system to approve or decline.`;
        }

        const docName = doctor ? doctor.name : 'Practitioner';
        const patientName = appointment.patientName || 'Patient';
        const apptDate = appointment.appointmentSlot && appointment.appointmentSlot.date
          ? new Date(appointment.appointmentSlot.date).toISOString().split('T')[0]
          : 'scheduled date';
        const apptTime = (appointment.appointmentSlot && appointment.appointmentSlot.time) || appointment.time || '';

        if (isApprove) {
          appointment.status = 'Confirmed';
          await appointment.save();

          if (appointment.patientContact && appointment.patientContact.value) {
            const patientMsg = `✅ Sparsh Confirmation: Great news! Dr. ${docName} has CONFIRMED your appointment for ${apptDate} at ${apptTime}.`;
            exports.sendWhatsAppMessage(appointment.patientContact.value, patientMsg);
          }

          return `✅ Success Dr. ${docName}! Appointment for ${patientName} on ${apptDate} at ${apptTime} has been CONFIRMED.`;
        } else {
          appointment.status = 'Cancelled';
          await appointment.save();

          if (doctor && appointment.appointmentSlot && appointment.appointmentSlot.date) {
            await Doctor.findOneAndUpdate(
              {
                _id: doctor._id,
                availability: { $elemMatch: { date: new Date(appointment.appointmentSlot.date), time: appointment.appointmentSlot.time } }
              },
              { $set: { "availability.$.isBooked": false } }
            );
          }

          if (appointment.patientContact && appointment.patientContact.value) {
            const patientMsg = `⚠️ Sparsh Alert: Your appointment request with Dr. ${docName} for ${apptDate} at ${apptTime} has been declined.`;
            exports.sendWhatsAppMessage(appointment.patientContact.value, patientMsg);
          }

          return `❌ Appointment for ${patientName} on ${apptDate} at ${apptTime} has been DECLINED and the time slot is now available.`;
        }
      } catch (err) {
        console.error("Error handling doctor WhatsApp reply:", err.message);
        return null;
      }
    }

    webClient.initialize().catch(err => {
      console.error("⚠️ Failed to initialize WhatsApp Web Client:", err.message);
    });
  } catch (err) {
    console.error("⚠️ whatsapp-web.js module error:", err.message);
  }
}

exports.sendWhatsAppMessage = async (phoneNumber, message) => {
  try {
    if (!phoneNumber) {
      console.log("⚠️ Cannot send WhatsApp message: Phone number missing.");
      return false;
    }

    // 1. Send using Twilio
    if (provider === 'twilio' && twilioClient) {
      let toPhone = phoneNumber.replace(/\D/g, "");
      if (!toPhone.startsWith('+')) {
        toPhone = '+' + toPhone;
      }
      const to = `whatsapp:${toPhone}`;

      let msgPayload = { from: twilioNumber, to: to };

      // If custom template SID is provided in env, use contentSid & variables
      if (contentSid) {
        const dateMatch = message.match(/Slot:\s(.*?)\sat/);
        const timeMatch = message.match(/at\s(.*?)(?:\n|$)/);
        msgPayload.contentSid = contentSid;
        msgPayload.contentVariables = JSON.stringify({
          "1": dateMatch ? dateMatch[1].trim() : 'Date',
          "2": timeMatch ? timeMatch[1].trim() : 'Time'
        });
      } else {
        // Fall back to standard message body (Works with any Twilio account!)
        msgPayload.body = message;
      }

      const response = await twilioClient.messages.create(msgPayload);
      console.log(`✅ Twilio WhatsApp Message Sent to ${to}. SID: ${response.sid}`);
      return true;
    }

    // 2. Send using WhatsApp Web Client
    if (provider === 'web' && webClient) {
      try {
        let cleaned = phoneNumber.replace(/\D/g, "");
        cleaned = cleaned.replace('whatsapp', '');
        // If it's a 10-digit number (e.g. Indian mobile number), prepend 91
        if (cleaned.length === 10) {
          cleaned = '91' + cleaned;
        }

        if (cleaned.length < 8) {
          console.warn(`⚠️ Cannot send WhatsApp message: "${phoneNumber}" is not a valid phone number (contains fewer than 8 digits).`);
          return false;
        }

        const chatId = cleaned.endsWith('@c.us') ? cleaned : `${cleaned}@c.us`;

        await webClient.sendMessage(chatId, message);
        console.log(`✅ WhatsApp Web Message Successfully Delivered to ${chatId}`);
        return true;
      } catch (sendErr) {
        console.error(`❌ WhatsApp Web Send Error to ${phoneNumber}:`, sendErr.message);
        console.log(`📱 [WHATSAPP FALLBACK LOG] To: ${phoneNumber} | Message: ${message.substring(0, 80)}...`);
        return false;
      }
    }

    // 3. Fallback: Simulated / Console Mode (Default)
    console.log("\n---------------------------------------------------------");
    console.log(`📱 [WHATSAPP SIMULATED MESSAGE]`);
    console.log(`   To: ${phoneNumber}`);
    console.log(`   Message:\n${message}`);
    console.log("---------------------------------------------------------\n");
    return true;

  } catch (err) {
    console.error("⚠️ sendWhatsAppMessage Error (falling back to log):", err.message);
    console.log(`📱 [WHATSAPP FALLBACK LOG] To: ${phoneNumber} | Content: ${message.substring(0, 80)}...`);
    return false;
  }
};

exports.getBotStatus = () => {
  if (provider === 'web') {
    return {
      provider: 'WhatsApp Web (Baileys/Puppeteer)',
      isConnected: !!webClient,
      statusMessage: webClient ? 'Active & Listening' : 'Initializing / Waiting for Scan'
    };
  } else if (provider === 'twilio') {
    return {
      provider: 'Twilio WhatsApp API',
      isConnected: !!twilioClient,
      statusMessage: twilioClient ? 'Active (API Gateway Connected)' : 'Disconnected (Check SID/AuthToken)'
    };
  }
  return {
    provider: 'Simulated Console Gateway',
    isConnected: true,
    statusMessage: 'Operational (Simulation Mode)'
  };
};

