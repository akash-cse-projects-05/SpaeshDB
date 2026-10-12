const nodemailer = require('nodemailer');

exports.sendAppointmentNotification = async (doctorEmail, doctorName, patientName, date, time, mode, reason) => {
  try {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT || 587;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const fromEmail = process.env.EMAIL_FROM || '"Sparsh Care Notifications" <no-reply@sparsh.org>';

    // Build the email body
    const emailSubject = `📅 New Appointment Scheduled: ${patientName}`;
    const emailHtml = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background: #ffffff;">
        <h2 style="color: #0f766e; margin-bottom: 20px; border-bottom: 2px solid #f0fdfa; padding-bottom: 10px;">New Consultation Booked</h2>
        <p>Dear <strong>Dr. ${doctorName}</strong>,</p>
        <p>A patient has scheduled a new consultation session with you. Here are the appointment details:</p>
        
        <table style="width: 100%; margin: 20px 0; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #475569; width: 140px;">Patient Name:</td>
            <td style="padding: 8px 0; color: #0f172a;">${patientName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #475569;">Date &amp; Time:</td>
            <td style="padding: 8px 0; color: #0f172a;">${date} at ${time}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #475569;">Consultation Mode:</td>
            <td style="padding: 8px 0; color: #0f172a;"><span style="background: #f0fdfa; color: #0f766e; padding: 3px 8px; border-radius: 4px; font-size: 0.85em; font-weight: 600;">${mode}</span></td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #475569;">Reason:</td>
            <td style="padding: 8px 0; color: #0f172a; font-style: italic;">${reason || 'Not specified'}</td>
          </tr>
        </table>
        
        <div style="margin-top: 30px; padding: 15px; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0; text-align: center;">
          <p style="font-size: 0.9em; color: #64748b; margin: 0 0 12px 0;">Please log in to your dashboard to review patient details and start the secure chat.</p>
          <a href="${process.env.APP_URL || 'http://localhost:3001'}/auth/login" style="background: #0d9488; color: #ffffff; text-decoration: none; padding: 8px 16px; border-radius: 6px; font-weight: 600; display: inline-block; font-size: 0.9em;">Go to Dashboard</a>
        </div>
        
        <p style="font-size: 0.8em; color: #94a3b8; margin-top: 30px; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 15px;">
          This is an automated notification from Sparsh. Please do not reply directly to this email.
        </p>
      </div>
    `;

    if (!smtpHost || !smtpUser || !smtpPass) {
      console.log('----------------------------------------------------');
      console.log('📧 EMAIL SIMULATION (SMTP configuration missing in .env)');
      console.log(`To: ${doctorEmail}`);
      console.log(`Subject: ${emailSubject}`);
      console.log(`Details: Patient ${patientName} has booked a ${mode} session for ${date} at ${time}.`);
      console.log('----------------------------------------------------');
      return true;
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort == 465,
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });

    await transporter.sendMail({
      from: fromEmail,
      to: doctorEmail,
      subject: emailSubject,
      html: emailHtml
    });

    console.log(`📧 Notification email successfully sent to doctor ${doctorEmail}`);
    return true;
  } catch (err) {
    console.error('❌ Failed to send doctor notification email:', err);
    return false;
  }
};
