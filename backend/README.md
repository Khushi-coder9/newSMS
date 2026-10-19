# Backend Setup Guide

This guide will help you set up the authentication backend with MongoDB Atlas.

## Step 1: Get MongoDB Atlas Connection String

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and log in
2. Click "Build a Database" (if you don't have one) or select your existing cluster
3. Choose "Free" tier (M0) for development
4. Select a region closest to you
5. Give your cluster a name (e.g., "studentms-cluster")
6. Click "Create"
7. Wait for the cluster to be created (2-5 minutes)

## Step 2: Configure Database Access

1. In MongoDB Atlas, go to "Database Access" in the left sidebar
2. Click "Add New Database User"
3. Choose "Password" authentication
4. Enter a username (e.g., "studentms-admin")
5. Enter a strong password (save this - you'll need it!)
6. Select "Read and write to any database"
7. Click "Add User"

## Step 3: Configure Network Access

1. Go to "Network Access" in the left sidebar
2. Click "Add IP Address"
3. Choose "Allow Access from Anywhere" (0.0.0.0/0) for development
   - Note: For production, you should restrict this to specific IPs
4. Click "Confirm"

## Step 4: Get Connection String

1. Go to "Database" in the left sidebar
2. Click "Connect" on your cluster
3. Choose "Connect your application"
4. Select "Node.js" and version 4.1 or later
5. Copy the connection string - it will look like:
   ```
   mongodb+srv://<username>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
   ```

## Step 5: Configure Backend Environment Variables

1. In the `backend` folder, create a file named `.env`
2. Copy the content from `.env.example`
3. Replace the MongoDB connection string with your actual connection string:
   ```
   MONGODB_URI=mongodb+srv://studentms-admin:YOUR_PASSWORD@studentms-cluster.xxxxx.mongodb.net/studentms?retryWrites=true&w=majority
   ```
4. Generate a random JWT secret key (you can use: https://www.random.org/strings/)
   ```
   JWT_SECRET=your-random-secret-key-here
   ```
5. Set the port (default is 5000):
   ```
   PORT=5000
   ```

## Step 6: Install Dependencies

```bash
cd backend
npm install
```

## Step 7: Run the Backend Server

```bash
npm start
```

Or for development with auto-reload:
```bash
npm run dev
```

The server will start on `http://localhost:5000`

## Step 8: Test the API

You can test the endpoints using Postman or curl:

**Signup:**
```bash
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

**Login:**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

**Health Check:**
```bash
curl http://localhost:5000/api/health
```

## API Endpoints

- `POST /api/auth/signup` - Create a new user account
- `POST /api/auth/login` - Login with email and password
- `GET /api/health` - Health check endpoint

## Frontend Configuration

The frontend in `index.html` is configured to connect to `http://localhost:5000/api`. If you deploy the backend to a different URL, update the `API_BASE` variable in the `<script>` section.

## Deployment

For cloud deployment, you can use:
- **Render** (recommended for Node.js): https://render.com
- **Railway**: https://railway.app
- **Heroku**: https://heroku.com

When deploying, you'll need to add the environment variables (MONGODB_URI, JWT_SECRET, PORT) in the deployment platform's settings.
