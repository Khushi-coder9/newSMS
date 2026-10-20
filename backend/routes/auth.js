const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Signup
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, role = 'student', age, designation } = req.body;

    // Validate role
    const validRoles = ['student', 'counsellor', 'admin'];
    const normalizedRole = (role || '').toLowerCase().trim();
    if (!validRoles.includes(normalizedRole)) {
      return res.status(400).json({ error: 'Invalid role. Must be student, counsellor, or admin' });
    }

    // Validate common fields
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Email is required' });
    }

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Validate role-specific fields
    if (normalizedRole === 'student') {
      if (age === undefined || age === null || age === '' || isNaN(Number(age)) || Number(age) < 1) {
        return res.status(400).json({ error: 'Valid age is required for student registration' });
      }
    }

    if (normalizedRole === 'counsellor') {
      if (!designation || !designation.trim()) {
        return res.status(400).json({ error: 'Designation is required for counsellor registration' });
      }
    }

    // Check if user already exists
    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Build user object
    const userData = {
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: normalizedRole
    };

    if (normalizedRole === 'student') {
      userData.age = Number(age);
    } else if (normalizedRole === 'counsellor') {
      userData.designation = designation.trim();
    }

    // Create user
    const user = new User(userData);
    await user.save();

    // Generate token
    const token = jwt.sign(
      { userId: user._id, role: user.role, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        age: user.age,
        designation: user.designation
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Server error during signup' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate token
    const token = jwt.sign(
      { userId: user._id, role: user.role || 'student', email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name || 'User',
        email: user.email,
        role: user.role || 'student',
        age: user.age,
        designation: user.designation
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

module.exports = router;

