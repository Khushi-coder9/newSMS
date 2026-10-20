# AWS EC2 Deployment Guide for Student Mind Support (StudentMS)

This guide walks you step-by-step through deploying your full-stack application on an **AWS EC2** Ubuntu server using **Nginx** (Reverse Proxy & Web Server), **PM2** (Process Manager), **Node.js**, **MongoDB**, and your configured **Brevo SMTP**.

---

## Architecture Overview

- **Frontend**: Static files (`index.html`, `book.html`, `chat.html`) served directly by Nginx on Port 80.
- **Backend**: Node.js & Express server running on port 5000, managed 24/7 by PM2.
- **Reverse Proxy**: Nginx routes all `/api/*` traffic to `http://127.0.0.1:5000/api/` (no CORS issues).
- **Database**: MongoDB running locally on EC2 (or MongoDB Atlas).
- **Email Service**: Brevo SMTP delivering transactional notifications to counsellors and students.

---

## Step 1: Launch an AWS EC2 Instance

1. Log into your [AWS Management Console](https://console.aws.amazon.com/) and go to **EC2** &rarr; **Instances** &rarr; **Launch Instance**.
2. **Name**: `StudentMS-Server`
3. **Application and OS Images (AMI)**: Select **Ubuntu** (Ubuntu Server 24.04 LTS or 22.04 LTS, 64-bit x86).
4. **Instance Type**: Select **`t2.micro`** (or `t3.micro`), which is **Free Tier Eligible** (1 vCPU, 1 GB RAM).
5. **Key Pair (Login)**:
   - Click **Create new key pair**.
   - Name: `studentms-key`
   - Key pair type: `RSA`
   - Private key file format: `.pem` (for OpenSSH / PowerShell)
   - Click **Create key pair** and save the downloaded `studentms-key.pem` on your PC.
6. **Network Settings (Firewall / Security Group)**:
   - Check **Allow SSH traffic from**: `Anywhere` (or `My IP`).
   - Check **Allow HTTP traffic from the internet** (Port 80).
   - Check **Allow HTTPS traffic from the internet** (Port 443).
7. **Storage**: Keep default **8 GiB gp3** (or 15-20 GiB).
8. Click **Launch Instance**.
9. In your EC2 dashboard, note down your instance's **Public IPv4 address** (e.g., `3.84.120.45`).

---

## Step 2: Connect to your EC2 Instance via SSH

Open **PowerShell** on your computer:

```powershell
# Navigate to the folder where your .pem file is stored
cd d:\downloads  # (or wherever your key is located)

# Connect to the EC2 server (replace with your actual EC2 Public IP)
ssh -i "studentms-key.pem" ubuntu@<YOUR-EC2-PUBLIC-IP>
```

> If you get a "permissions are too open" error in PowerShell:
> ```powershell
> icacls "studentms-key.pem" /inheritance:r
> icacls "studentms-key.pem" /grant:r "$($env:USERNAME):(R)"
> ```

---

## Step 3: Install Node.js, Nginx, and PM2 on EC2

Run these commands inside your Ubuntu EC2 terminal:

```bash
# 1. Update Ubuntu packages
sudo apt update && sudo apt upgrade -y

# 2. Add Node.js 20 LTS repository & install tools
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git nginx build-essential

# 3. Verify installations
node -v    # v20.x
npm -v     # 10.x
nginx -v

# 4. Install PM2 (Process Manager) globally
sudo npm install -g pm2
```

---

## Step 4: Install MongoDB on EC2

To run MongoDB Community Edition directly on your server:

```bash
# Import MongoDB GPG key
sudo apt-get install gnupg curl -y
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
   sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

# Add repository
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Install MongoDB
sudo apt-get update
sudo apt-get install -y mongodb-org

# Start and enable MongoDB service
sudo systemctl start mongod
sudo systemctl enable mongod
sudo systemctl status mongod
```

*(Alternatively, if you use **MongoDB Atlas**, you can skip installing MongoDB and simply paste your `mongodb+srv://...` URI into `.env`)*

---

## Step 5: Clone the Repository & Configure `.env`

```bash
# Navigate to home directory
cd /home/ubuntu

# Clone the repository
git clone https://github.com/Khushi-coder9/newSMS.git

# Install backend dependencies
cd /home/ubuntu/newSMS/backend
npm install --production

# Create production .env file
nano .env
```

Paste your configuration inside `nano` (replace `<YOUR-EC2-PUBLIC-IP>` with your instance's IP):

```env
# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/studentms

# JWT Secret Key
JWT_SECRET=your-super-secure-production-jwt-key-9102004

# Server Port
PORT=5000

# URLs (Point to your EC2 Public IP or Domain)
FRONTEND_URL=http://<YOUR-EC2-PUBLIC-IP>
BACKEND_URL=http://<YOUR-EC2-PUBLIC-IP>

# Brevo (Sendinblue) SMTP Mail Configuration
BREVO_SMTP_HOST=smtp-relay.brevo.com
BREVO_SMTP_PORT=587
BREVO_SMTP_USER=96796d001@smtp-brevo.com
BREVO_SMTP_KEY=xsmtpsib-70fd7f316a1da4bf933b8a65f5aec2341e9aac6fd9ea445850b3949b2a07bbd0-dGRIqvBfubTEhj3k
BREVO_SENDER_EMAIL=kgupta09102@gmail.com
BREVO_SENDER_NAME=Student Mind Support
```

*Press `Ctrl + O`, then `Enter` to save, and `Ctrl + X` to exit.*

---

## Step 6: Start Backend with PM2

```bash
cd /home/ubuntu/newSMS/backend

# Start server with PM2
pm2 start server.js --name "studentms-backend"

# Configure PM2 to auto-start after server reboots
pm2 save
pm2 startup
# (Run the exact 'sudo env PATH=...' command that PM2 prints out)
```

Useful PM2 commands:
- `pm2 status`
- `pm2 logs studentms-backend`
- `pm2 restart studentms-backend`

---

## Step 7: Configure Nginx

```bash
# Copy pre-configured Nginx site template
sudo cp /home/ubuntu/newSMS/nginx.conf.example /etc/nginx/sites-available/studentms

# Enable the site
sudo ln -s /etc/nginx/sites-available/studentms /etc/nginx/sites-enabled/

# Remove default Nginx welcome page
sudo rm -f /etc/nginx/sites-enabled/default

# Test Nginx syntax
sudo nginx -t

# Fix file permissions so Nginx can read the repository files
chmod 755 /home/ubuntu
chmod -R 755 /home/ubuntu/newSMS

# Restart Nginx
sudo systemctl restart nginx
```

---

## Step 8: Access Your Live Application

Open your browser and navigate to:
```text
http://<YOUR-EC2-PUBLIC-IP>/
```

Your full-stack application will be live:
- **Port 80 HTTP**: Nginx serves `index.html`, `book.html`, `chat.html`.
- **API Requests**: Nginx proxies `/api/*` to the Node.js backend.
- **Brevo SMTP**: All appointment notification and confirmation emails will dispatch seamlessly.
