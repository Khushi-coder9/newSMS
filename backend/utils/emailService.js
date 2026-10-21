const nodemailer = require('nodemailer');

/**
 * Brevo (Sendinblue) SMTP Email Service
 */

// Base URLs
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://studentmindsupport.duckdns.org';
const BACKEND_URL  = process.env.BACKEND_URL  || 'https://studentmindsupport.duckdns.org';

/**
 * Creates Nodemailer Transporter for Brevo SMTP
 */
function getBrevoTransporter() {
  const host = process.env.BREVO_SMTP_HOST || 'smtp-relay.brevo.com';
  const port = parseInt(process.env.BREVO_SMTP_PORT, 10) || 587;
  const user = process.env.BREVO_SMTP_USER;
  const pass = process.env.BREVO_SMTP_KEY;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true for 465, false for 587
    auth: {
      user,
      pass
    }
  });
}

/**
 * Common HTML wrapper with Student Mind Support branding
 */
function wrapEmailHtml(title, preheader, bodyContent) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f7f4ff; margin: 0; padding: 24px 0; color: #1f1b4d; }
    .container { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 18px; overflow: hidden; box-shadow: 0 10px 30px rgba(109, 77, 255, 0.08); border: 1.5px solid #ece8fc; }
    .header { background: linear-gradient(135deg, #1c1848 0%, #31237a 100%); padding: 28px 32px; text-align: center; color: #ffffff; }
    .brand { font-size: 20px; font-weight: 800; letter-spacing: -0.02em; margin-bottom: 4px; }
    .brand-tag { font-size: 12px; color: #c4b5fd; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
    .content { padding: 32px; }
    h1 { font-size: 20px; color: #1c1848; margin-top: 0; margin-bottom: 12px; }
    p { font-size: 14.5px; line-height: 1.6; color: #5a5878; margin-bottom: 20px; }
    .card { background: #fbf9ff; border: 1.5px solid #ece8fc; border-radius: 14px; padding: 20px; margin-bottom: 24px; }
    .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13.5px; border-bottom: 1px dashed #ede8fc; }
    .row:last-child { border-bottom: none; }
    .row-label { color: #6a6788; font-weight: 600; }
    .row-val { color: #1c1848; font-weight: 700; text-align: right; }
    .cta-container { text-align: center; margin: 28px 0 16px; }
    .btn { display: inline-block; background: #6d4dff; color: #ffffff !important; padding: 13px 28px; font-size: 14px; font-weight: 800; text-decoration: none; border-radius: 999px; box-shadow: 0 6px 18px rgba(109, 77, 255, 0.32); }
    .btn-green { background: #16a34a; box-shadow: 0 6px 18px rgba(22, 163, 74, 0.32); }
    .btn-outline { background: transparent; color: #dc2626 !important; border: 1px solid #fca5a5; padding: 8px 18px; font-size: 12.5px; margin-left: 10px; border-radius: 999px; }
    .footer { background: #faf9ff; padding: 20px 32px; text-align: center; font-size: 11.5px; color: #8a87a8; border-top: 1px solid #f0ecfc; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">Student Mind Support</div>
      <div class="brand-tag">Talk • Heal • Grow</div>
    </div>
    <div class="content">
      ${bodyContent}
    </div>
    <div class="footer">
      Student Mind Support • Campus Mental Wellness Initiative<br>
      Confidential &amp; Secure • Please do not reply directly to this automated email.
    </div>
  </div>
</body>
</html>
`;
}

/**
 * 1. Send Appointment Request Notification to Counsellor
 * Contains direct "Confirm Appointment" CTA button with confirmation token.
 */
async function sendCounsellorNotification(appointment) {
  const senderEmail = process.env.BREVO_SENDER_EMAIL || process.env.BREVO_SMTP_USER || 'appointments@studentmindsupport.com';
  const senderName = process.env.BREVO_SENDER_NAME || 'Student Mind Support';
  // Email links point to confirm.html frontend page (served by nginx) so they work on any device
  const confirmUrl = `${FRONTEND_URL}/confirm.html?action=confirm&token=${appointment.confirmationToken}`;
  const declineUrl = `${FRONTEND_URL}/confirm.html?action=decline&token=${appointment.confirmationToken}`;

  const isMeet = appointment.sessionType === 'meet';
  const modeText = isMeet ? '📹 Video Meet' : '💬 Private 1-on-1 Chat';

  const bodyContent = `
    <h1>New Counselling Appointment Request</h1>
    <p>Hello <strong>${appointment.counsellorName}</strong>,</p>
    <p>A student has requested a confidential counselling session with you on Student Mind Support. Please review the appointment details below and click <strong>Confirm Appointment</strong> to accept the booking.</p>

    <div class="card">
      <div class="row">
        <span class="row-label">Student Name:</span>
        <span class="row-val">${appointment.studentName}</span>
      </div>
      <div class="row">
        <span class="row-label">Student Email:</span>
        <span class="row-val">${appointment.studentEmail}</span>
      </div>
      <div class="row">
        <span class="row-label">Requested Date:</span>
        <span class="row-val">${appointment.date}</span>
      </div>
      <div class="row">
        <span class="row-label">Requested Time:</span>
        <span class="row-val">${appointment.time}</span>
      </div>
      <div class="row">
        <span class="row-label">Session Mode:</span>
        <span class="row-val" style="color: #6d4dff;">${modeText}</span>
      </div>
      <div class="row">
        <span class="row-label">Primary Concern:</span>
        <span class="row-val">${appointment.concern || 'General Support'}</span>
      </div>
      ${appointment.notes ? `
      <div class="row">
        <span class="row-label">Student Notes:</span>
        <span class="row-val" style="max-width: 280px;">${appointment.notes}</span>
      </div>` : ''}
    </div>

    <div class="cta-container">
      <a href="${confirmUrl}" class="btn">✓ Confirm Appointment</a>
      <a href="${declineUrl}" class="btn-outline">Decline</a>
    </div>

    <p style="font-size: 12.5px; color: #8a87a8; text-align: center; margin-top: 14px;">
      * Once confirmed, a confirmation email with session access details will automatically be dispatched to the student.
    </p>
  `;

  const html = wrapEmailHtml('New Appointment Request', 'Counselling appointment request from student', bodyContent);
  const mailOptions = {
    from: `"${senderName}" <${senderEmail}>`,
    to: appointment.counsellorEmail,
    subject: `🔔 New Appointment Request: ${appointment.studentName} (${appointment.date} at ${appointment.time})`,
    html
  };

  const transporter = getBrevoTransporter();
  if (transporter) {
    try {
      const info = await transporter.sendMail(mailOptions);
      console.log(`[Brevo SMTP] Notification sent to counsellor (${appointment.counsellorEmail}). Message ID: ${info.messageId}`);
      return { success: true, messageId: info.messageId, mode: 'brevo_smtp' };
    } catch (err) {
      console.error('[Brevo SMTP Error] Failed to send email to counsellor:', err.message);
      return { success: false, error: err.message, mode: 'fallback_logged' };
    }
  } else {
    console.log('---------------------------------------------------------');
    console.log(`[Email Simulation - Brevo SMTP credentials not configured in .env]`);
    console.log(`To: ${appointment.counsellorEmail} (Counsellor)`);
    console.log(`Subject: New Appointment Request: ${appointment.studentName}`);
    console.log(`Confirmation Link: ${confirmUrl}`);
    console.log(`Decline Link: ${declineUrl}`);
    console.log('---------------------------------------------------------');
    return { success: true, mode: 'simulated_logged', confirmUrl };
  }
}

/**
 * 2. Send Confirmation Email to Student (once Counsellor confirms)
 * Contains confirmed details, meeting link or chat link.
 */
async function sendStudentConfirmation(appointment) {
  const senderEmail = process.env.BREVO_SENDER_EMAIL || process.env.BREVO_SMTP_USER || 'appointments@studentmindsupport.com';
  const senderName = process.env.BREVO_SENDER_NAME || 'Student Mind Support';

  const isMeet = appointment.sessionType === 'meet';
  const modeText = isMeet ? '📹 Video Meet' : '💬 Private Chat';
  const accessUrl = isMeet
    ? (appointment.meetingLink || `${FRONTEND_URL}/book.html`)
    : `${FRONTEND_URL}/session-chat.html?appointmentId=${appointment._id}`;

  const bodyContent = `
    <h1>🎉 Your Appointment is Confirmed!</h1>
    <p>Hello <strong>${appointment.studentName}</strong>,</p>
    <p>Good news! Your counsellor, <strong>${appointment.counsellorName}</strong>, has confirmed your upcoming session. Here are the details:</p>

    <div class="card">
      <div class="row">
        <span class="row-label">Counsellor:</span>
        <span class="row-val">${appointment.counsellorName}</span>
      </div>
      <div class="row">
        <span class="row-label">Designation:</span>
        <span class="row-val">${appointment.counsellorDesignation || 'Campus Counsellor'}</span>
      </div>
      <div class="row">
        <span class="row-label">Confirmed Date:</span>
        <span class="row-val">${appointment.date}</span>
      </div>
      <div class="row">
        <span class="row-label">Confirmed Time:</span>
        <span class="row-val">${appointment.time}</span>
      </div>
      <div class="row">
        <span class="row-label">Session Mode:</span>
        <span class="row-val" style="color: #6d4dff;">${modeText}</span>
      </div>
      <div class="row">
        <span class="row-label">Primary Topic:</span>
        <span class="row-val">${appointment.concern || 'General Support'}</span>
      </div>
      ${isMeet && appointment.meetingLink ? `
      <div class="row">
        <span class="row-label">Meeting Link:</span>
        <span class="row-val" style="word-break: break-all;"><a href="${appointment.meetingLink}" style="color: #16a34a;">${appointment.meetingLink}</a></span>
      </div>` : ''}
    </div>

    <div class="cta-container">
      <a href="${accessUrl}" class="btn ${isMeet ? 'btn-green' : ''}">
        ${isMeet ? '📹 Join Video Meet' : '💬 Open Chat Room'}
      </a>
    </div>

    <p style="font-size: 13px; line-height: 1.5; color: #6a6788; margin-top: 18px;">
      💡 <strong>Session Preparation Tips:</strong><br>
      • Please be in a quiet, private space 5 minutes before your scheduled slot.<br>
      • Ensure a stable internet connection.<br>
      • You can also view and manage all your bookings anytime on the <a href="${FRONTEND_URL}/book.html" style="color: #6d4dff; font-weight: 700;">Appointment Booking Page</a>.
    </p>
  `;

  const html = wrapEmailHtml('Appointment Confirmed', 'Your counselling session is confirmed', bodyContent);
  const mailOptions = {
    from: `"${senderName}" <${senderEmail}>`,
    to: appointment.studentEmail,
    subject: `✅ Appointment Confirmed with ${appointment.counsellorName} (${appointment.date} at ${appointment.time})`,
    html
  };

  const transporter = getBrevoTransporter();
  if (transporter) {
    try {
      const info = await transporter.sendMail(mailOptions);
      console.log(`[Brevo SMTP] Confirmation email sent to student (${appointment.studentEmail}). Message ID: ${info.messageId}`);
      return { success: true, messageId: info.messageId, mode: 'brevo_smtp' };
    } catch (err) {
      console.error('[Brevo SMTP Error] Failed to send confirmation email to student:', err.message);
      return { success: false, error: err.message, mode: 'fallback_logged' };
    }
  } else {
    console.log('---------------------------------------------------------');
    console.log(`[Email Simulation - Brevo SMTP credentials not configured in .env]`);
    console.log(`To: ${appointment.studentEmail} (Student)`);
    console.log(`Subject: Appointment Confirmed with ${appointment.counsellorName}`);
    console.log(`Session Access URL: ${accessUrl}`);
    console.log('---------------------------------------------------------');
    return { success: true, mode: 'simulated_logged', accessUrl };
  }
}

/**
 * 3. Send Notification to Student if Counsellor declines the request
 */
async function sendStudentDeclinedNotification(appointment) {
  const senderEmail = process.env.BREVO_SENDER_EMAIL || process.env.BREVO_SMTP_USER || 'appointments@studentmindsupport.com';
  const senderName = process.env.BREVO_SENDER_NAME || 'Student Mind Support';

  const bodyContent = `
    <h1>Session Request Update</h1>
    <p>Hello <strong>${appointment.studentName}</strong>,</p>
    <p>We are reaching out to inform you that your counsellor, <strong>${appointment.counsellorName}</strong>, was unable to accept your counselling appointment request for <strong>${appointment.date} at ${appointment.time}</strong> due to an unexpected scheduling conflict.</p>

    <div class="card">
      <div class="row">
        <span class="row-label">Counsellor:</span>
        <span class="row-val">${appointment.counsellorName}</span>
      </div>
      <div class="row">
        <span class="row-label">Requested Date:</span>
        <span class="row-val">${appointment.date}</span>
      </div>
      <div class="row">
        <span class="row-label">Requested Time:</span>
        <span class="row-val">${appointment.time}</span>
      </div>
      <div class="row">
        <span class="row-label">Status:</span>
        <span class="row-val" style="color: #dc2626;">Declined / Slot Unavailable</span>
      </div>
    </div>

    <p style="font-size: 14px; color: #5a5878;">
      Please do not worry! Our team has other available campus counsellors and flexible slots ready to support you. You can easily select another convenient date or counsellor anytime.
    </p>

    <div class="cta-container">
      <a href="${FRONTEND_URL}/book.html" class="btn">
        📅 Choose Another Slot or Counsellor
      </a>
    </div>
  `;

  const html = wrapEmailHtml('Session Request Update', 'Update regarding your counselling request', bodyContent);
  const mailOptions = {
    from: `"${senderName}" <${senderEmail}>`,
    to: appointment.studentEmail,
    subject: `Update regarding your appointment request with ${appointment.counsellorName}`,
    html
  };

  const transporter = getBrevoTransporter();
  if (transporter) {
    try {
      const info = await transporter.sendMail(mailOptions);
      console.log(`[Brevo SMTP] Decline notification sent to student (${appointment.studentEmail}). Message ID: ${info.messageId}`);
      return { success: true, messageId: info.messageId, mode: 'brevo_smtp' };
    } catch (err) {
      console.error('[Brevo SMTP Error] Failed to send decline email to student:', err.message);
      return { success: false, error: err.message, mode: 'fallback_logged' };
    }
  } else {
    return { success: true, mode: 'simulated_logged' };
  }
}

module.exports = {
  sendCounsellorNotification,
  sendStudentConfirmation,
  sendStudentDeclinedNotification
};
