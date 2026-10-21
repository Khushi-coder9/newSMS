const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Appointment = require('../models/Appointment');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
const { sendCounsellorNotification, sendStudentConfirmation, sendStudentDeclinedNotification } = require('../utils/emailService');

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://studentmindsupport.duckdns.org';

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
 * GET /api/appointments/by-token/:token
 * Returns appointment details (no auth needed) — used by confirm.html frontend
 */
router.get('/by-token/:token', async (req, res) => {
  try {
    const appointment = await Appointment.findOne({ confirmationToken: req.params.token }).lean();
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found or link expired.' });
    }
    res.json({ success: true, appointment });
  } catch (error) {
    console.error('Error fetching appointment by token:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

/**
 * GET /api/appointments/confirm/:token
 * Counsellor confirms the appointment.
 * Supports:
 * 1. Direct browser clicks from email (redirects to confirm.html)
 * 2. AJAX fetch calls from confirm.html (returns JSON)
 */
router.get('/confirm/:token', async (req, res) => {
  const { token } = req.params;
  const isHtml = req.headers.accept && req.headers.accept.includes('text/html');

  try {
    const appointment = await Appointment.findOne({ confirmationToken: token });

    if (!appointment) {
      if (isHtml) {
        return res.redirect(`/confirm.html?status=not_found&token=${token}`);
      }
      return res.status(404).json({ error: 'Appointment not found or link expired.' });
    }

    if (appointment.status === 'confirmed') {
      if (isHtml) {
        return res.redirect(`/confirm.html?status=already&token=${token}`);
      }
      return res.status(200).json({
        success: true,
        alreadyConfirmed: true,
        message: 'This appointment was already confirmed.',
        appointment
      });
    }

    // Mark as confirmed
    appointment.status = 'confirmed';
    appointment.confirmedAt = new Date();
    await appointment.save();

    // Send confirmation email to student
    try {
      const studentMailResult = await sendStudentConfirmation(appointment);
      if (studentMailResult && studentMailResult.success) {
        appointment.mailSentToStudent = true;
        await appointment.save();
      }
    } catch (err) {
      console.error('Error sending confirmation email to student:', err);
    }

    if (isHtml) {
      return res.redirect(`/confirm.html?status=success&token=${token}`);
    }

    return res.json({
      success: true,
      message: 'Appointment confirmed! Confirmation email sent to student.',
      appointment
    });
  } catch (error) {
    console.error('Error in appointment confirmation:', error);
    if (isHtml) {
      return res.redirect(`/confirm.html?status=error&msg=${encodeURIComponent('Internal server error during confirmation.')}`);
    }
    res.status(500).json({ error: 'Internal server error during confirmation.' });
  }
});

/**
 * GET /api/appointments/decline/:token
 * Counsellor declines the appointment.
 * Supports direct browser clicks and AJAX calls.
 */
router.get('/decline/:token', async (req, res) => {
  const { token } = req.params;
  const isHtml = req.headers.accept && req.headers.accept.includes('text/html');

  try {
    const appointment = await Appointment.findOne({ confirmationToken: token });

    if (!appointment) {
      if (isHtml) {
        return res.redirect(`/confirm.html?status=not_found&token=${token}`);
      }
      return res.status(404).json({ error: 'Appointment not found or link expired.' });
    }

    if (appointment.status === 'cancelled') {
      if (isHtml) {
        return res.redirect(`/confirm.html?status=declined&token=${token}`);
      }
      return res.status(200).json({
        success: true,
        message: 'Appointment was already declined.',
        appointment
      });
    }

    appointment.status = 'cancelled';
    await appointment.save();

    // Send decline notification email to student
    try {
      await sendStudentDeclinedNotification(appointment);
    } catch (err) {
      console.error('Error sending decline email to student:', err);
    }

    if (isHtml) {
      return res.redirect(`/confirm.html?status=declined&token=${token}`);
    }

    res.json({
      success: true,
      message: 'Appointment has been declined.',
      appointment
    });
  } catch (error) {
    console.error('Error declining appointment:', error);
    if (isHtml) {
      return res.redirect(`/confirm.html?status=error&msg=${encodeURIComponent('Server error during decline.')}`);
    }
    res.status(500).json({ error: 'Server error.' });
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
 * PATCH /api/appointments/:id/decline
 * Counsellor declines directly from the dashboard/UI
 */
router.patch('/:id/decline', authMiddleware, async (req, res) => {
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

    appointment.status = 'cancelled';
    await appointment.save();

    // Send decline notification email to student
    try {
      await sendStudentDeclinedNotification(appointment);
    } catch (mailErr) {
      console.error('Error sending decline email to student:', mailErr);
    }

    res.json({
      success: true,
      message: 'Appointment declined.',
      appointment
    });
  } catch (error) {
    console.error('Error declining appointment from UI:', error);
    res.status(500).json({ error: 'Failed to decline appointment.' });
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
