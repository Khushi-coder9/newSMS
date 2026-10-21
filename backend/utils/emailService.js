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
    : `${FRONTEND_URL}/session-chat.html?appointmentId=${appointment._id}&token=${appointment.confirmationToken}`;

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

// In-memory cooldown tracking per student to prevent spamming volunteers (3-minute cooldown)
const lastAlertTimestamp = new Map();
const ALERT_COOLDOWN_MS = 3 * 60 * 1000;

/**
 * 4. Send Emergency Crisis Alert Email to all registered Campus Volunteers
 * Triggered when an AI chat encounters severe distress keywords (suicide, kill, self-destruction, etc.)
 */
async function sendVolunteerEmergencyAlert({
  studentName = 'Anonymous Student',
  studentEmail = 'Not provided / Anonymous',
  studentId = null,
  detectedKeywords = [],
  messageSnippet = '',
  timestamp = new Date(),
  force = false
}) {
  const Volunteer = require('../models/Volunteer');

  // Cooldown check per student email / id
  const studentKey = (studentEmail || studentId || studentName).toLowerCase().trim();
  const now = Date.now();
  const lastSent = lastAlertTimestamp.get(studentKey);

  if (!force && lastSent && (now - lastSent) < ALERT_COOLDOWN_MS) {
    const remainingSec = Math.round((ALERT_COOLDOWN_MS - (now - lastSent)) / 1000);
    console.log(`[Volunteer Alert] Emergency alert debounced for ${studentKey} (${remainingSec}s remaining in cooldown).`);
    return { success: true, debounced: true, remainingCooldownSec: remainingSec };
  }

  // 1. Fetch all registered volunteers from database
  const volunteers = await Volunteer.find({}).lean();
  if (!volunteers || volunteers.length === 0) {
    console.warn('[Volunteer Alert] No volunteers currently registered in database to receive crisis alert.');
    return { success: false, reason: 'no_volunteers', count: 0 };
  }

  const volunteerList = volunteers.filter(v => v.email && v.email.includes('@'));
  if (volunteerList.length === 0) {
    console.warn('[Volunteer Alert] No volunteers with valid email addresses found.');
    return { success: false, reason: 'no_valid_emails', count: 0 };
  }

  // Update last sent timestamp
  lastAlertTimestamp.set(studentKey, now);

  const senderEmail = process.env.BREVO_SENDER_EMAIL || process.env.BREVO_SMTP_USER || 'crisis-alert@studentmindsupport.com';
  const senderName = process.env.BREVO_SENDER_NAME || 'Student Mind Support';

  const formattedTime = new Date(timestamp).toLocaleString('en-US', {
    dateStyle: 'full',
    timeStyle: 'medium',
    timeZone: 'Asia/Kolkata'
  });

  const keywordsDisplay = detectedKeywords && detectedKeywords.length > 0
    ? detectedKeywords.map(k => `<span style="display:inline-block; background:#fee2e2; color:#991b1b; padding:4px 10px; border-radius:999px; font-weight:700; font-size:12px; margin:2px 4px 2px 0; border:1px solid #fecaca;">⚠️ ${k}</span>`).join(' ')
    : '<span style="color:#b91c1c; font-weight:700;">Severe Distress Keywords Detected</span>';

  const safeSnippet = String(messageSnippet || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const bodyContent = `
    <div style="background: #fef2f2; border: 2px solid #ef4444; border-radius: 14px; padding: 18px 20px; margin-bottom: 24px;">
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
        <span style="font-size: 24px;">🚨</span>
        <h2 style="font-size: 18px; color: #991b1b; margin: 0; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">
          CRITICAL CRISIS ALERT: Immediate Volunteer Action Required
        </h2>
      </div>
      <p style="font-size: 14px; color: #7f1d1d; margin: 0; line-height: 1.5; font-weight: 600;">
        An AI mental health chat on Student Mind Support has just encountered an active, high-severity self-harm / suicide trigger. As a registered campus volunteer, your prompt attention and intervention protocol are urgently requested.
      </p>
    </div>

    <!-- Student & Trigger Incident Details -->
    <div class="card" style="background:#ffffff; border:1.5px solid #fecaca; box-shadow:0 4px 12px rgba(239,68,68,0.08); margin-bottom: 24px;">
      <div style="font-size: 13px; font-weight: 800; color: #991b1b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">
        📋 Incident Summary & Student Details
      </div>
      <div class="row">
        <span class="row-label">Student Name:</span>
        <span class="row-val" style="color: #111827;">${studentName}</span>
      </div>
      <div class="row">
        <span class="row-label">Student Email:</span>
        <span class="row-val"><a href="mailto:${studentEmail}" style="color:#dc2626; text-decoration:none;">${studentEmail}</a></span>
      </div>
      <div class="row">
        <span class="row-label">Alert Timestamp:</span>
        <span class="row-val">${formattedTime}</span>
      </div>
      <div class="row" style="flex-direction: column; align-items: flex-start; gap: 6px; padding: 10px 0;">
        <span class="row-label">Trigger Keywords Flagged:</span>
        <div>${keywordsDisplay}</div>
      </div>
      <div class="row" style="flex-direction: column; align-items: flex-start; gap: 6px; padding: 10px 0; border-bottom: none;">
        <span class="row-label">Reported Distress Message:</span>
        <div style="background: #fff5f5; border-left: 4px solid #ef4444; padding: 10px 14px; border-radius: 6px; font-style: italic; color: #374151; font-size: 13.5px; line-height: 1.5; width: 100%; box-sizing: border-box; margin-top: 4px;">
          "${safeSnippet}"
        </div>
      </div>
    </div>

    <!-- Mandatory Immediate Actions Protocol -->
    <div style="background: #fffbeb; border: 1.5px solid #fde68a; border-radius: 14px; padding: 20px; margin-bottom: 24px;">
      <h3 style="font-size: 16px; color: #92400e; margin-top: 0; margin-bottom: 12px; font-weight: 800; display: flex; align-items: center; gap: 8px;">
        <span>⚡</span> MANDATORY IMMEDIATE ACTION PROTOCOL
      </h3>
      <ol style="margin: 0; padding-left: 20px; font-size: 13.5px; color: #78350f; line-height: 1.7;">
        <li><strong>Reach Out Promptly:</strong> Contact the student immediately via secure campus channels or their registered email to establish a supportive, non-judgmental human presence.</li>
        <li><strong>Alert Campus Emergency & Counselling Team:</strong> Notify the duty campus psychologist, counsellor, or medical center about this urgent alert immediately.</li>
        <li><strong>Ensure Continuous Support:</strong> If the student is reachable, do not leave them unattended until professional or emergency help arrives.</li>
        <li><strong>Deploy 24/7 National Emergency Helplines:</strong>
          <ul style="margin-top: 6px; padding-left: 18px;">
            <li><strong>KIRAN Helpline (Govt. of India):</strong> <a href="tel:18005990019" style="color:#b45309; font-weight:700;">1800-599-0019</a> (Toll-Free, 24/7)</li>
            <li><strong>Tele-MANAS:</strong> <a href="tel:14416" style="color:#b45309; font-weight:700;">14416</a> or <a href="tel:18008914416" style="color:#b45309; font-weight:700;">1800-891-4416</a></li>
            <li><strong>iCall Psychosocial Helpline:</strong> <a href="tel:9152987821" style="color:#b45309; font-weight:700;">9152987821</a></li>
            <li><strong>US / International:</strong> <a href="tel:988" style="color:#b45309; font-weight:700;">988 Suicide & Crisis Lifeline</a></li>
          </ul>
        </li>
      </ol>
    </div>

    <div class="cta-container">
      <a href="${FRONTEND_URL}/dashboard.html" class="btn" style="background:#dc2626 !important; box-shadow: 0 4px 14px rgba(220, 38, 38, 0.4);">
        🚨 Open Emergency Crisis Center in Dashboard
      </a>
    </div>

    <p style="font-size: 12px; color: #9ca3af; text-align: center; margin-top: 24px;">
      This is an automated high-priority emergency notification dispatched to all certified campus volunteers registered on Student Mind Support.
    </p>
  `;

  const html = wrapEmailHtml('CRITICAL CRISIS ALERT', 'Immediate volunteer intervention requested for severe distress case', bodyContent);
  const subject = `🚨 URGENT: Mental Health Crisis Alert - Immediate Action Required (${studentName})`;

  const transporter = getBrevoTransporter();
  if (transporter) {
    const sendPromises = volunteerList.map(vol => {
      const mailOptions = {
        from: `"${senderName} [EMERGENCY]" <${senderEmail}>`,
        to: vol.email,
        subject,
        html,
        priority: 'high',
        headers: {
          'X-Priority': '1',
          'X-MSMail-Priority': 'High',
          'Importance': 'high'
        }
      };

      return transporter.sendMail(mailOptions)
        .then(info => {
          console.log(`[Brevo SMTP Emergency] Crisis email delivered to volunteer ${vol.name} (${vol.email}). ID: ${info.messageId}`);
          return { email: vol.email, messageId: info.messageId, success: true };
        })
        .catch(err => {
          console.error(`[Brevo SMTP Emergency Error] Failed to send to volunteer (${vol.email}):`, err.message);
          return { email: vol.email, error: err.message, success: false };
        });
    });

    const results = await Promise.all(sendPromises);
    const sentCount = results.filter(r => r.success).length;

    return {
      success: sentCount > 0,
      totalVolunteers: volunteerList.length,
      sentCount,
      mode: 'brevo_smtp',
      results
    };
  } else {
    console.log(`[SIMULATED VOLUNTEER EMERGENCY ALERT]`);
    console.log(`Broadcasting to ${volunteerList.length} volunteers: ${volunteerList.map(v => v.email).join(', ')}`);
    console.log(`Student: ${studentName} (${studentEmail})`);
    console.log(`Keywords: ${(detectedKeywords || []).join(', ')}`);
    console.log(`Snippet: ${messageSnippet}`);
    return {
      success: true,
      totalVolunteers: volunteerList.length,
      sentCount: volunteerList.length,
      mode: 'simulated_logged'
    };
  }
}

module.exports = {
  sendCounsellorNotification,
  sendStudentConfirmation,
  sendStudentDeclinedNotification,
  sendVolunteerEmergencyAlert
};
