# Student Mind Support - Complete Setup Guide

This guide will help you set up the entire Student Mind Support project with authentication.

## Prerequisites

- Node.js installed (https://nodejs.org/)
- MongoDB Atlas account (free tier available at https://www.mongodb.com/cloud/atlas)
- Git installed

## Project Structure

```
StudentMS/
├── backend/              # Authentication server
│   ├── models/          # MongoDB models
│   ├── routes/          # API routes
│   ├── server.js        # Main server file
│   ├── package.json     # Dependencies
│   └── .env             # Environment variables (create this)
├── index.html           # Main landing page with auth modals
├── chat.html            # AI chatbot page
├── config.example.js    # API key template
└── config.js            # Your actual API key (create this, don't commit)
```

## Step 1: Setup Backend Authentication

### 1.1 Get MongoDB Atlas Connection String

Follow the detailed guide in `backend/README.md` to:
- Create a MongoDB Atlas cluster (free tier)
- Configure database access
- Configure network access
- Get your connection string

### 1.2 Configure Backend Environment Variables

1. Navigate to the `backend` folder
2. Copy `.env.example` to `.env`:
   ```bash
   cd backend
   cp .env.example .env
   ```
3. Edit `.env` and add your values:
   ```
   MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/studentms?retryWrites=true&w=majority
   JWT_SECRET=your-random-secret-key-here
   PORT=5000
   ```

### 1.3 Install Dependencies

```bash
cd backend
npm install
```

### 1.4 Start the Backend Server

```bash
npm start
```

The server will run on `http://localhost:5000`

## Step 2: Setup Gemini API for Chatbot

### 2.1 Get Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Create a new project (if needed to avoid quota issues)
3. Generate an API key
4. Copy the API key

### 2.2 Configure Chatbot

1. Copy `config.example.js` to `config.js`:
   ```bash
   cp config.example.js config.js
   ```
2. Edit `config.js` and add your API key:
   ```javascript
   window.SMS_CONFIG = {
     GEMINI_API_KEY: "YOUR_GEMINI_API_KEY_HERE",
     MODEL: "gemini-3.5-flash-lite"
   };
   ```

## Step 3: Run the Application

### Option A: Run Backend Only (Development)

1. Start the backend server:
   ```bash
   cd backend
   npm start
   ```

2. Open `index.html` in your browser (double-click or drag to browser)

### Option B: Run with Live Server (Recommended)

If you have VS Code with Live Server extension:
1. Install Live Server extension in VS Code
2. Right-click on `index.html` and select "Open with Live Server"
3. Start the backend server in a separate terminal:
   ```bash
   cd backend
   npm start
   ```

## Step 4: Test Authentication

1. Open `index.html` in your browser
2. Click "Sign Up" in the top right
3. Enter your email and password (min 6 characters)
4. Click "Sign Up"
5. You should see "Account created successfully!"
6. The button should change to "Logout"

## Step 5: Test Chatbot

1. Navigate to `chat.html`
2. The AI chatbot should load with your Gemini API key
3. Try sending a message
4. Click the "🔊 Sound" button to enable voice responses
5. Click the "🎤" button to use speech-to-text input

## Features

### Authentication
- User signup with email and password
- User login with JWT tokens
- Session persistence using localStorage
- Password hashing with bcrypt
- MongoDB for user data storage

### Chatbot
- AI-powered mental health first aid companion
- Text-to-speech for audio responses
- Speech-to-text for voice input
- Crisis detection and emergency resources
- Multi-language support (Hindi, Tamil, Telugu, Marathi)
- Offline fallback mode

## Deployment

### Backend Deployment (Cloud)

1. Push your code to GitHub
2. Sign up for a cloud platform (Render, Railway, or Heroku)
3. Connect your GitHub repository
4. Add environment variables in the platform settings:
   - `MONGODB_URI` - Your MongoDB connection string
   - `JWT_SECRET` - Your JWT secret key
   - `PORT` - Usually set automatically (5000)
5. Deploy!

### Frontend Deployment

You can deploy the frontend to:
- **GitHub Pages** (free, static hosting)
- **Netlify** (free, static hosting)
- **Vercel** (free, static hosting)

When deploying, update the `API_BASE` variable in `index.html` to point to your deployed backend URL.

## Security Notes

- **Never commit `config.js`** - it contains your API key
- **Never commit `.env`** - it contains your database credentials
- Use strong passwords for MongoDB and JWT secret
- In production, restrict MongoDB network access to specific IPs
- Enable HTTPS for production deployments

## Troubleshooting

### Backend won't start
- Check that MongoDB Atlas cluster is running
- Verify your connection string is correct
- Ensure all dependencies are installed (`npm install`)

### Authentication not working
- Check that backend server is running on port 5000
- Open browser console to see error messages
- Verify MongoDB connection string in `.env`

### Chatbot not working
- Verify your Gemini API key is valid
- Check that you're using `gemini-3.5-flash-lite` model
- Look for quota errors in browser console
- Ensure `config.js` exists and has your API key

### CORS errors
- If you deploy backend to a different domain, update CORS settings in `backend/server.js`

## Support

For issues or questions:
- Check the MongoDB Atlas dashboard for cluster status
- Review the browser console for frontend errors
- Check the backend terminal for server errors
