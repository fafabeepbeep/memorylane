# 🎓 MemoryLane — GradMemory: The Last Night Archive

> A QR-based real-time photo sharing system built for FCSIT UNIMAS graduation events.  
> Stack: **Node.js + Express · MongoDB · Firebase Storage · WebSocket · Vanilla JS**

---

## 📁 Folder Structure

```
memorylane/
├── backend/
│   ├── config/
│   │   ├── db.js                         ← MongoDB connection
│   │   ├── firebase.js                   ← Firebase Admin SDK
│   │   └── firebase-service-account.json ← 🔒 YOU MUST ADD THIS
│   ├── middleware/
│   │   └── upload.js                     ← Multer file handler
│   ├── models/
│   │   ├── Event.js                      ← Event schema
│   │   ├── User.js                       ← User schema
│   │   └── Photo.js                      ← Photo + comments schema
│   ├── routes/
│   │   ├── events.js                     ← Event CRUD API
│   │   ├── users.js                      ← Join event API
│   │   └── photos.js                     ← Upload / like / comment API
│   ├── sockets/
│   │   └── wsServer.js                   ← WebSocket broadcast server
│   ├── .env.example                      ← Copy to .env and fill in
│   ├── .gitignore
│   ├── package.json
│   └── server.js                         ← Express entry point
│
└── frontend/
    ├── css/
    │   └── style.css                     ← Full design system
    ├── js/
    │   ├── config.js                     ← API URLs + Firebase web config
    │   └── utils.js                      ← Shared helpers (toast, API, compress)
    ├── index.html                        ← Landing / Join Event
    ├── gallery.html                      ← Main photo gallery (upload + view)
    ├── admin.html                        ← Admin dashboard
    ├── screen.html                       ← Projector slideshow display
    └── serve.js                          ← Local dev static server
```

---

## 🚀 Quick Start (Local Development)

### Prerequisites

| Tool | Min Version | Install |
|------|-------------|---------|
| Node.js | 18+ | https://nodejs.org |
| MongoDB | 6+ (or Atlas) | https://mongodb.com |
| Firebase project | — | https://console.firebase.google.com |

---

## ⚙️ Step 1 — Firebase Setup

### 1a. Create Firebase Project

1. Go to https://console.firebase.google.com
2. Click **"Add project"** → name it (e.g. `memorylane-fcsit`)
3. Disable Google Analytics (optional for prototype)

### 1b. Enable Firebase Storage

1. In your Firebase project → **Build → Storage**
2. Click **"Get started"** → Choose **"Start in test mode"** (for prototype)
3. Select a region (e.g. `asia-southeast1`)
4. Note your **Storage bucket name**: `your-project-id.appspot.com`

### 1c. Get Service Account Key (Backend)

1. Firebase Console → ⚙️ Project Settings → **Service Accounts**
2. Click **"Generate new private key"** → Download JSON
3. **Rename** it to `firebase-service-account.json`
4. **Place it at**: `backend/config/firebase-service-account.json`

### 1d. Get Web App Config (Frontend)

1. Firebase Console → ⚙️ Project Settings → **Your apps**
2. Click the **`</>`** icon to add a Web app
3. Register the app (no hosting needed)
4. Copy the `firebaseConfig` object
5. Paste the values into `frontend/js/config.js` under `FIREBASE:`

### 1e. Set Storage Rules (Development)

In Firebase Console → Storage → **Rules**, replace with:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read: if true;
      allow write: if true;
    }
  }
}
```

> ⚠️ This is for development only. Tighten rules before going to production.

---

## ⚙️ Step 2 — Backend Setup

```bash
cd memorylane/backend

# Install dependencies
npm install

# Copy and edit environment file
cp .env.example .env
```

Edit `.env`:

```env
PORT=3001
MONGODB_URI=mongodb://localhost:27017/memorylane
ADMIN_SECRET=your_strong_secret_here
FIREBASE_SERVICE_ACCOUNT_PATH=./config/firebase-service-account.json
FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
CORS_ORIGIN=http://localhost:5500
```

Start the backend:

```bash
# Development (auto-restart on changes)
npm run dev

# Or production
npm start
```

You should see:
```
✅ MongoDB connected: localhost
✅ Firebase Admin initialized
✅ WebSocket server ready at /ws
🚀 MemoryLane server running on http://localhost:3001
```

---

## ⚙️ Step 3 — Frontend Setup

```bash
cd memorylane/frontend

# Edit config.js with your values:
# - API_URL (default: http://localhost:3001/api)
# - WS_URL  (default: ws://localhost:3001/ws)  
# - FIREBASE config object (from Step 1d)
# - ADMIN_SECRET (must match backend .env)

# Start local server
node serve.js
```

You should see:
```
🌐 MemoryLane frontend running at:
   http://localhost:5500           → Landing (Join Event)
   http://localhost:5500/gallery   → Photo Gallery
   http://localhost:5500/admin     → Admin Panel
   http://localhost:5500/screen    → Projector Screen
```

---

## 📋 Step 4 — Create Your First Event

1. Open http://localhost:5500/admin
2. Enter your `ADMIN_SECRET` from `.env`
3. Navigate to **Create Event**
4. Fill in:
   - **Event Name**: `GradNight 2025 – FCSIT UNIMAS`
   - **Event Code**: `GRADMEM25`
5. Click **Create Event**
6. A **QR Code** and shareable link will appear

---

## 📋 Step 5 — Guest Flow

1. Guest scans QR code or opens `http://localhost:5500?event=GRADMEM25`
2. Enters their **name** and **event code**
3. Clicks **"Enter the Gallery"**
4. Arrives at the live gallery
5. Taps **"Add Your Photo"** → selects image → uploads
6. Photo appears in real-time for everyone

---

## 🔌 API Reference

### Base URL: `http://localhost:3001/api`

#### Events

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET    | `/events` | Admin | List all events |
| POST   | `/events` | Admin | Create new event |
| GET    | `/events/validate/:code` | Public | Validate event code |
| PATCH  | `/events/:id` | Admin | Update event |
| DELETE | `/events/:id` | Admin | Delete event + all data |

#### Users

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST   | `/users/join` | Public | Join an event |

#### Photos

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST   | `/photos/upload` | Public | Upload photo (multipart/form-data) |
| GET    | `/photos/:eventCode` | Public | Get approved photos |
| GET    | `/photos/:eventCode/since/:timestamp` | Public | Poll for new photos |
| POST   | `/photos/:id/like` | Public | Toggle like |
| POST   | `/photos/:id/comment` | Public | Add comment |
| PATCH  | `/photos/:id/approve` | Admin | Approve/reject photo |
| DELETE | `/photos/:id` | Admin | Delete photo |

#### Admin Header

```
x-admin-secret: your_admin_secret
```

---

## 🔁 Real-time Architecture

```
Client (Browser)
    │
    ├─── WebSocket (ws://localhost:3001/ws?event=EVENTCODE)
    │       - NEW_PHOTO      → new photo uploaded
    │       - PHOTO_DELETED  → photo removed by admin  
    │       - LIKE_UPDATE    → like count changed
    │       - NEW_COMMENT    → comment added
    │       - EVENT_UPDATED  → event status changed
    │
    └─── HTTP Polling (fallback, every 5s)
            GET /photos/:code/since/:timestamp
```

---

## 🎨 Pages Overview

| Page | URL | Purpose |
|------|-----|---------|
| `index.html` | `/` | QR landing, event join form |
| `gallery.html` | `/gallery` | Upload + view live photos |
| `admin.html` | `/admin` | Event management + moderation |
| `screen.html` | `/screen` | Fullscreen projector slideshow |

---

## 🗄️ MongoDB Collections

```js
// Events
{ _id, event_name, event_code, is_active, moderation_enabled,
  event_end_time, photo_count, guest_count, created_at }

// Users
{ _id, name, event_id, joined_at, photo_count }

// Photos
{ _id, event_id, user_id, user_name, image_url, firebase_path,
  likes, liked_by[], approved, comments[], file_size, mime_type, timestamp }
```

---

## 🚀 Deployment Guide

### Backend → Render / Railway

1. Push backend folder to GitHub
2. On **Render**: New Web Service → connect repo
3. Set environment variables (same as `.env`)
4. Build command: `npm install`
5. Start command: `npm start`
6. Note the deployed URL (e.g. `https://memorylane-api.onrender.com`)

### Frontend → Netlify / Vercel

1. Edit `frontend/js/config.js`:
   - `API_URL`: your Render backend URL
   - `WS_URL`: `wss://your-api.onrender.com/ws`
2. Deploy `frontend/` folder to Netlify (drag & drop) or Vercel

### Database → MongoDB Atlas

1. Go to https://cloud.mongodb.com
2. Create free M0 cluster
3. Add Database User + Network Access (0.0.0.0/0 for prototype)
4. Get connection string → paste into `MONGODB_URI` env var

---

## 🧪 Testing Checklist

- [ ] Backend starts with no errors
- [ ] `GET http://localhost:3001/health` returns `{ status: "ok" }`
- [ ] Admin can create event at `http://localhost:5500/admin`
- [ ] QR code generates and is scannable
- [ ] Guest can join at `http://localhost:5500?event=YOURCODE`
- [ ] Photo uploads and appears in gallery
- [ ] Second browser tab sees photo in real-time (WebSocket)
- [ ] Like toggle works (no duplicate likes)
- [ ] Comments appear in real-time
- [ ] Screen page shows slideshow at `http://localhost:5500/screen?event=YOURCODE`
- [ ] Admin can approve/delete photos

---

## 🔐 Security Notes (Before Production)

1. Move `ADMIN_SECRET` to proper auth (JWT / session)
2. Remove `ADMIN_SECRET` from `frontend/js/config.js`
3. Tighten Firebase Storage rules per event path
4. Add HTTPS (required for camera access on mobile)
5. Set proper CORS origin (not `*`)
6. Rate limit uploads more aggressively
7. Validate file magic bytes server-side (not just MIME type)

---

## 📦 Dependencies Summary

### Backend
| Package | Purpose |
|---------|---------|
| express | Web framework |
| mongoose | MongoDB ODM |
| firebase-admin | Firebase Storage upload |
| multer | Multipart file parsing |
| ws | WebSocket server |
| helmet | Security headers |
| cors | Cross-origin requests |
| express-rate-limit | Rate limiting |
| morgan | Request logging |
| uuid | Unique file names |
| dotenv | Environment variables |

### Frontend
> Pure HTML + CSS + Vanilla JS — zero npm dependencies required  
> Google Fonts loaded via CDN

---

*Built with by FCSIT UNIMAS Students · MemoryLane 2026*