const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Appointment = require('../models/Appointment');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
const { sendCounsellorNotification, sendStudentConfirmation } = require('../utils/emailService');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://127.0.0.1:8080';

/**
 * Default fallback counsellors if database is empty or new
 */
const DEFAULT_COUNSELLORS = [
  {
    name: 'Dr. Sunita Sharma',
    email: 'sunita.sharma@campus.edu',
    designation: 'Senior Clinical Psychologist',
    experience: '10+ Years',
    specializations: ['Exam Anxiety', 'Academic Stress', 'Depression'],
    rating: '4.9 ★',
    availableHours: '09:00 AM - 05:00 PM'
  },
  {
    name: 'Prof. Rajesh Verma',
    email: 'rajesh.verma@campus.edu',
    designation: 'Student Life & Career Counsellor',
    experience: '8+ Years',
    specializations: ['Career Guidance', 'Burnout', 'Peer Pressure'],
    rating: '4.8 ★',
    availableHours: '10:00 AM - 04:30 PM'
  },
  {
    name: 'Ms. Ananya Roy',
    email: 'ananya.roy@campus.edu',
    designation: 'Youth Wellness & Mindfulness Mentor',
    experience: '6+ Years',
    specializations: ['Sleep Issues', 'Loneliness', 'Meditation'],
    rating: '4.9 ★',
    availableHours: '11:00 AM - 06:00 PM'
  }
];

/**
 * GET /api/appointments/counsellors
 * Returns list of registered counsellors
 */
router.get('/counsellors', async (req, res) => {
  try {
    let dbCounsellors = await User.find({ role: 'counsellor' })
      .select('name email designation role createdAt')
      .lean();

    if (!dbCounsellors || dbCounsellors.length === 0) {
      for (const def of DEFAULT_COUNSELLORS) {
        const dummyUser = new User({
          name: def.name,
          email: def.email,
          password: 'Password123!',
          role: 'counsellor',
          designation: def.designation
        });
        await dummyUser.save();
      }
      dbCounsellors = await User.find({ role: 'counsellor' })
        .select('name email designation role createdAt')
        .lean();
    }

    const counsellors = dbCounsellors.map((c, index) => {
      const fallback = DEFAULT_COUNSELLORS[index % DEFAULT_COUNSELLORS.length];
      return {
        id: c._id.toString(),
        name: c.name,
        email: c.email,
        designation: c.designation || fallback.designation,
        experience: fallback.experience,
        specializations: fallback.specializations,
        rating: fallback.rating,
        availableHours: fallback.availableHours,
        avatarInitials: c.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
      };
    });

    res.json({
      success: true,
      count: counsellors.length,
      counsellors
    });
  } catch (error) {
    console.error('Error fetching counsellors:', error);
    res.status(500).json({ error: 'Failed to retrieve counsellors.' });
  }
});

/**
 * POST /api/appointments/book
 * Student requests an appointment.
 * Sends Brevo SMTP notification email to the counsellor with a direct Confirm link!
 */
router.post('/book', authMiddleware, async (req, res) => {
  try {
    const {
      counsellorId,
      date,
      time,
      sessionType = 'chat',
      concern = 'General Mental Health Support',
      notes = ''
    } = req.body;

    if (!counsellorId || !date || !time) {
      return res.status(400).json({ error: 'Counsellor, date, and time are required.' });
    }

    if (!['chat', 'meet'].includes(sessionType)) {
      return res.status(400).json({ error: 'Invalid session type. Must be "chat" or "meet".' });
    }

    // Retrieve counsellor
    const counsellor = await User.findById(counsellorId);
    if (!counsellor) {
      return res.status(404).json({ error: 'Selected counsellor not found.' });
    }

    // Student info from authenticated user
    const studentId = req.user.userId;
    const studentUser = req.userDoc || await User.findById(studentId);
    const studentName = studentUser ? studentUser.name : 'Student';
    const studentEmail = req.user.email;

    // Generate meeting link if 'meet'
    let meetingLink = null;
    if (sessionType === 'meet') {
      const cleanCounsellor = counsellor.name.replace(/[^a-zA-Z0-9]/g, '');
      const uniqueCode = Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
      meetingLink = `https://meet.jit.si/StudentMindSupport-${cleanCounsellor}-${uniqueCode}`;
    }

    // Generate secure confirmation token
    const confirmationToken = crypto.randomBytes(24).toString('hex');

    const newAppointment = new Appointment({
      student: studentId,
      studentName,
      studentEmail,
      counsellor: counsellor._id,
      counsellorName: counsellor.name,
      counsellorEmail: counsellor.email,
      counsellorDesignation: counsellor.designation || 'Campus Counsellor',
      date,
      time,
      sessionType,
      meetingLink,
      concern,
      notes,
      status: 'pending', // Pending counsellor confirmation
      confirmationToken
    });

    const savedAppointment = await newAppointment.save();

    // Send email notification to counsellor via Brevo SMTP
    let emailResult = null;
    try {
      emailResult = await sendCounsellorNotification(savedAppointment);
      if (emailResult.success) {
        savedAppointment.mailSentToCounsellor = true;
        await savedAppointment.save();
      }
    } catch (mailErr) {
      console.error('Email sending error during booking:', mailErr);
    }

    res.status(201).json({
      success: true,
      message: 'Appointment request submitted! An email notification has been sent to the counsellor. You will receive a confirmation email once approved.',
      appointment: savedAppointment,
      emailSent: savedAppointment.mailSentToCounsellor,
      emailMode: emailResult ? emailResult.mode : 'pending'
    });
  } catch (error) {
    console.error('Error booking appointment:', error);
    res.status(500).json({ error: 'Failed to book appointment.' });
  }
});

/**
 * GET /api/appointments/confirm/:token
 * Counsellor clicks the Confirm link in their Brevo notification email.
 * Marks appointment as 'confirmed' and sends confirmation email to the student!
 */
router.get('/confirm/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const appointment = await Appointment.findOne({ confirmationToken: token });
    if (!appointment) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Appointment Not Found</title><style>body { font-family: sans-serif; display: grid; place-items: center; height: 90vh; background: #f7f4ff; color: #1c1848; } .card { background: white; padding: 36px; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.08); text-align: center; max-width: 440px; }</style></head>
        <body>
          <div class="card">
            <h2 style="color: #dc2626;">Invalid or Expired Link</h2>
            <p>This appointment confirmation link is invalid or has already been used.</p>
            <a href="${FRONTEND_URL}/book.html" style="color: #6d4dff; font-weight: 700; text-decoration: none;">Return to Appointments</a>
          </div>
        </body>
        </html>
      `);
    }

    if (appointment.status === 'confirmed') {
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Already Confirmed</title><style>body { font-family: sans-serif; display: grid; place-items: center; height: 90vh; background: #f7f4ff; color: #1c1848; } .card { background: white; padding: 36px; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.08); text-align: center; max-width: 440px; }</style></head>
        <body>
          <div class="card">
            <h2 style="color: #16a34a;">Already Confirmed ✓</h2>
            <p>This appointment with <strong>${appointment.studentName}</strong> was already confirmed on ${new Date(appointment.confirmedAt || appointment.createdAt).toLocaleDateString()}.</p>
            <a href="${FRONTEND_URL}/book.html" style="background: #6d4dff; color: white; padding: 10px 24px; border-radius: 999px; text-decoration: none; font-weight: 700; display: inline-block; margin-top: 14px;">View Appointments</a>
          </div>
        </body>
        </html>
      `);
    }

    // Update appointment status to 'confirmed'
    appointment.status = 'confirmed';
    appointment.confirmedAt = new Date();
    await appointment.save();

    // Send confirmation email to student via Brevo SMTP!
    try {
      const studentMailResult = await sendStudentConfirmation(appointment);
      if (studentMailResult.success) {
        appointment.mailSentToStudent = true;
        await appointment.save();
      }
    } catch (err) {
      console.error('Error sending confirmation email to student:', err);
    }

    // Return branded success page to counsellor
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Appointment Confirmed • Student Mind Support</title>
        <style>
          body { font-family: 'Segoe UI', sans-serif; background: #f7f4ff; margin: 0; display: grid; place-items: center; min-height: 90vh; color: #1c1848; }
          .card { background: #ffffff; padding: 38px 32px; border-radius: 24px; box-shadow: 0 20px 45px rgba(109, 77, 255, 0.12); text-align: center; max-width: 480px; width: 90%; border: 1.5px solid #ece8fc; }
          .icon { width: 64px; height: 64px; border-radius: 50%; background: #dcfce7; color: #16a34a; font-size: 30px; display: grid; place-items: center; margin: 0 auto 18px; }
          h2 { font-size: 24px; font-weight: 800; margin: 0 0 10px; color: #1c1848; }
          p { font-size: 14px; color: #5a5878; line-height: 1.55; margin: 0 0 20px; }
          .details { background: #faf9ff; border: 1.5px solid #ece8fc; border-radius: 14px; padding: 16px; text-align: left; font-size: 13.5px; margin-bottom: 24px; }
          .detail-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #ede8fc; }
          .detail-row:last-child { border-bottom: none; }
          .btn { background: #6d4dff; color: white; padding: 12px 28px; border-radius: 999px; text-decoration: none; font-weight: 700; font-size: 14px; display: inline-block; box-shadow: 0 4px 14px rgba(109, 77, 255, 0.3); }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">✓</div>
          <h2>Appointment Confirmed!</h2>
          <p>Thank you, <strong>${appointment.counsellorName}</strong>. You have confirmed the counselling session with <strong>${appointment.studentName}</strong>.</p>
          <div class="details">
            <div class="detail-row"><span>Student:</span><strong>${appointment.studentName}</strong></div>
            <div class="detail-row"><span>Date &amp; Time:</span><strong>${appointment.date} at ${appointment.time}</strong></div>
            <div class="detail-row"><span>Mode:</span><strong style="color: #6d4dff;">${appointment.sessionType === 'meet' ? '📹 Video Meet' : '💬 1-on-1 Chat'}</strong></div>
            <div class="detail-row"><span>Topic:</span><span>${appointment.concern}</span></div>
          </div>
          <p style="font-size: 12.5px; color: #16a34a; font-weight: 600;">
            📧 A confirmation email has been dispatched to <strong>${appointment.studentEmail}</strong> via Brevo SMTP.
          </p>
          <a href="${FRONTEND_URL}/book.html" class="btn">View Bookings on Portal</a>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Error in appointment confirmation:', error);
    res.status(500).send('Internal server error during confirmation.');
  }
});

/**
 * GET /api/appointments/decline/:token
 * Counsellor declines the appointment
 */
router.get('/decline/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const appointment = await Appointment.findOne({ confirmationToken: token });
    if (!appointment) {
      return res.status(404).send('Appointment not found or link expired.');
    }

    appointment.status = 'cancelled';
    await appointment.save();

    res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>Appointment Declined</title><style>body { font-family: sans-serif; display: grid; place-items: center; height: 90vh; background: #f7f4ff; color: #1c1848; } .card { background: white; padding: 36px; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.08); text-align: center; max-width: 440px; }</style></head>
      <body>
        <div class="card">
          <h2>Appointment Declined</h2>
          <p>The appointment request from <strong>${appointment.studentName}</strong> has been declined.</p>
          <a href="${FRONTEND_URL}/book.html" style="color: #6d4dff; font-weight: 700; text-decoration: none;">Return to Portal</a>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Error declining appointment:', error);
    res.status(500).send('Server error');
  }
});

/**
 * PATCH /api/appointments/:id/confirm
 * Counsellor confirms directly from the dashboard/UI
 */
router.patch('/:id/confirm', authMiddleware, async (req, res) => {
  try {
    const appointmentId = req.params.id;
    const userId = req.user.userId;

    const appointment = await Appointment.findOne({
      _id: appointmentId,
      counsellor: userId
    });

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found or unauthorized.' });
    }

    appointment.status = 'confirmed';
    appointment.confirmedAt = new Date();
    await appointment.save();

    // Send confirmation email to student
    try {
      const mailRes = await sendStudentConfirmation(appointment);
      if (mailRes.success) {
        appointment.mailSentToStudent = true;
        await appointment.save();
      }
    } catch (mailErr) {
      console.error('Error sending confirmation email to student:', mailErr);
    }

    res.json({
      success: true,
      message: 'Appointment confirmed! Confirmation email has been sent to the student.',
      appointment
    });
  } catch (error) {
    console.error('Error confirming appointment from UI:', error);
    res.status(500).json({ error: 'Failed to confirm appointment.' });
  }
});

/**
 * GET /api/appointments/my-appointments
 * Retrieves appointments for the logged-in student or counsellor
 */
router.get('/my-appointments', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    const appointments = await Appointment.find({
      $or: [{ student: userId }, { counsellor: userId }]
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      count: appointments.length,
      appointments
    });
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({ error: 'Failed to retrieve appointments.' });
  }
});

/**
 * PATCH /api/appointments/:id/cancel
 * Cancels an appointment
 */
router.patch('/:id/cancel', authMiddleware, async (req, res) => {
  try {
    const appointmentId = req.params.id;
    const userId = req.user.userId;

    const appointment = await Appointment.findOne({
      _id: appointmentId,
      $or: [{ student: userId }, { counsellor: userId }]
    });

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found or unauthorized.' });
    }

    appointment.status = 'cancelled';
    await appointment.save();

    res.json({
      success: true,
      message: 'Appointment has been cancelled.',
      appointment
    });
  } catch (error) {
    console.error('Error cancelling appointment:', error);
    res.status(500).json({ error: 'Failed to cancel appointment.' });
  }
});

module.exports = router;
