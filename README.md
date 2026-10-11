# Aquagen Farm Management Platform

A robust, offline-capable Progressive Web App (PWA) and Node.js backend engineered for Recirculating Aquaculture Systems (RAS). This platform manages daily farm operations, biological triage, accounting, and automated IoT feeder telemetry.

## 🏗 System Architecture

The repository is structured as a decoupled monorepo:

*   **`aquagen-farm/` (Frontend):** A React-based PWA built with Vite, Tailwind CSS, and shadcn/ui. Designed for offline resilience in the field, pushing real-time state to Firebase.
*   **`aquagen-server/` (Backend):** A Node.js/Express REST API handling complex domain logic (biological modeling, accounting ledgers) and secure IoT telemetry ingestion.
*   **Hardware Layer (IoT):** ESP32 nodes communicating over a local LoRa network, bridged to the web app via a Node B Wi-Fi Gateway.

## ✨ Key Features

*   **Offline-First PWA:** Ensures farm operators can log triage data, complete tasks, and manage inventory even during network outages.
*   **Automated Feeder Integration:** REST endpoints ingest hopper feed levels and confirm autonomous feeding events from hardware nodes.
*   **Real-Time Synchronization:** Firebase Firestore provides instant UI updates across all authenticated devices.
*   **Enterprise Security:** Custom Express middlewares (`rbac.js`, `auditStamper.js`) enforce strict role-based access control and maintain immutable audit trails for farm operations.

## 🛠 Tech Stack

*   **Frontend:** React, TypeScript, Vite, Tailwind CSS, shadcn/ui
*   **Backend:** Node.js, Express
*   **Database:** Firebase Firestore
*   **Authentication:** Firebase Auth
*   **IoT Communication:** HTTP REST Polling (ESP32 / LoRa Gateway)

## 🚀 Getting Started

### Prerequisites
*   [Node.js](https://nodejs.org/) (v18 or higher)
*   [Bun](https://bun.sh/) (Optional, but recommended for faster frontend dependency resolution)
*   Firebase CLI (`npm install -g firebase-tools`)

### 1. Frontend Setup (`aquagen-farm`)

Navigate to the frontend directory, install dependencies, and start the development server:

```bash
cd aquagen-farm
npm install  # or `bun install`
npm run dev

```

**Environment Variables (`aquagen-farm/.env`):**

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_API_BASE_URL=http://localhost:3000/api/v1

```

### 2. Backend Setup (`aquagen-server`)

Navigate to the server directory, install dependencies, and start the API:

```bash
cd aquagen-server
npm install
npm run dev

```

**Environment Variables (`aquagen-server/.env`):**

```env
PORT=3000
FIREBASE_SERVICE_ACCOUNT_KEY=./path/to/serviceAccountKey.json
IOT_SECRET_KEY=generate_a_secure_random_string_here

```

## 📡 IoT Hardware API (Node B Gateway)

The backend provides secured endpoints for the automated feeder network. All hardware requests must include the `IOT_SECRET_KEY` in the authorization header.

### `POST /api/v1/feeders/telemetry`

Ingests hardware telemetry from the pond.
**Payload:**

```json
{
  "pond_id": "POND_01",
  "distance_cm": 78.5,
  "feed_triggered": true,
  "hardware_timestamp": 123456789
}

```

### `GET /api/v1/feeders/status?pond=`

Allows the gateway to poll for manual feed commands and sync its Real-Time Clock (RTC) to East Africa Time (EAT).
**Response:**

```json
{
  "current_hour": 14,
  "pending_command": "CMD:FEED" 
}

```

## 🔐 Security & Access Control

* **UI Access:** Managed via Firebase Auth.
* **Backend Routes:** Protected by `middlewares/rbac.js` ensuring that standard operators cannot access administrative or financial (`controllers/accounting.js`) endpoints.
* **Hardware Access:** Hardware endpoints bypass standard JWT validation but require a hardcoded hardware secret key.

## 🚢 Deployment

* **Frontend:** Configured for Vercel/Firebase Hosting. Deploy via the included GitHub Actions workflows (`.github/workflows/firebase-hosting-merge.yml`).
* **Backend:** Configured for Vercel Serverless Functions (`vercel.json`).

## 🤝 Contributing

1. Create a feature branch (`git checkout -b feature/AmazingFeature`)
2. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
3. Push to the branch (`git push origin feature/AmazingFeature`)
4. Open a Pull Request

---

*Built for the future of sustainable aquaculture.*

```

```
