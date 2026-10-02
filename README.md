# ⚡ TruePace

> **Distraction-Free Telemetry HUD & Precision GPS Tracking for Runners.**

TruePace is a minimalist, battery-efficient mobile running tracker built with **Expo**, **React Native**, and **Tailwind CSS (NativeWind)**. 

Unlike bloated fitness apps loaded with social feeds, ads, and GPU-intensive live maps that drain your battery, TruePace strips away the clutter to focus on what matters most: **pinpoint pace accuracy, rock-solid distance measurement, and instant glanceability in the flow**.

---

## 🏃 Why TruePace?

Most mobile GPS running apps suffer from **GPS drift** and **phantom distance**:
1. When you stand still at a traffic light or walk around indoors, raw GPS coordinates flutter in a 5–15 meter radius. Naive apps count this as real distance, inflating your mileage and corrupting your average pace.
2. "Current Pace" in basic apps jumps violently between `2:30/km` and `12:00/km` every second because they simply divide noisy consecutive coordinate points.

**TruePace solves this at the sensor level with a custom precision tracking engine.**

---

## ✨ Key Features

### 1. 🎯 Precision Tracking Engine
* **GPS Noise Filtering**: Rejects inaccurate coordinate readings with estimated error greater than $25\text{m}$.
* **Stationary Drift Suppression**: Only accumulates distance when movement speed $\ge 0.5\text{ m/s}$ ($\approx 1.8\text{ km/h}$) and positional delta $> 2.0\text{m}$, preventing ghost miles when standing still.
* **Native Hardware Doppler Pace**: Computes instantaneous pace ($1000 / \text{speed}$) directly from native satellite Doppler velocity (`coords.speed` in m/s), falling back to a rolling 10-second window if speed is unavailable. Displays `--'--"` cleanly when stationary.
* **Earth-Curvature Distance**: Calculates step distance between verified coordinates using the mathematical **Haversine formula**.
* **Active Moving Time**: Stopwatch counts active moving time, pausing instantly when paused so traffic stops and breaks never skew your average pace.
* **Milestone Haptics**: Delivers a tactile vibration alert when crossing each 1-kilometer milestone.

### 2. 🛡️ GPS Gatekeeper
* **Lock Protection**: "START RUN" is hard-locked in the **`WAITING FOR GPS`** state until device location services are enabled, permissions are granted, and satellite accuracy is verified.
* **Interactive Diagnostics**: Tapping the locked button or the header GPS badge triggers the **GPS Alert Modal**, offering real-time accuracy readouts ($\pm X\text{m}$) and direct pathways (e.g., opening device settings).
* **Standby Satellite Pre-warming**: The GPS receiver engages in low-power standby the moment the app opens—just like a dedicated Garmin or Apple running watch.

### 3. 🕶️ Minimalist OLED In-Run HUD
* **Glanceable Tabular Typography**: Monospace numeric formatting prevents digits from jittering horizontally when ticking up.
* **Deep Pitch Black (OLED)**: Maximum battery savings and outdoor sunlight legibility.
* **Zero Map Clutter**: No live map rendering during the run—maximizing frame rates, reducing thermal throttling, and extending battery life.
* **Dynamic Safe Insets**: Perfectly tuned for all modern hardware notches, punch-hole cameras, and system notification panels.

### 4. 💾 Local Cache Run History
* Offline-first persistent cache powered by `@react-native-async-storage/async-storage`.
* Review your past sessions with total distance, active duration, average pace, and best pace.

---

## 📐 Precision Mathematical Formulas

### Haversine Distance
$$d = 2R \cdot \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta \phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta \lambda}{2}\right)}\right)$$
*(where $R = 6,371,000\text{ m}$ is Earth's mean radius)*

### Instantaneous Pace (Min/Km)
$$\text{Pace (seconds/km)} = \frac{1000}{\text{speed (m/s)}}$$
$$\text{Pace Display} = \lfloor\text{minutes}\rfloor'\lfloor\text{seconds}\rfloor"$$

### Average Pace
$$\text{Avg Pace (s/km)} = \frac{\text{Active Moving Seconds}}{\text{Total Distance in km}}$$

---

## 🛠️ Tech Stack

* **Framework**: [Expo](https://expo.dev) SDK 57 (Continuous Native Generation)
* **Runtime**: React Native 0.86 / React 19
* **Router**: [Expo Router](https://docs.expo.dev/router/introduction/) (File-based routing)
* **Styling**: [NativeWind v4](https://www.nativewind.dev/) & [Tailwind CSS v3.4](https://tailwindcss.com)
* **Sensors & Hardware**: `expo-location`, `expo-haptics`, `react-native-safe-area-context`
* **Storage**: `@react-native-async-storage/async-storage`
* **Language**: TypeScript 6.0 (Strict mode)

---

## 📁 Project Architecture

```
Run/
├── assets/                  # App icon, adaptive icons, and splash assets
├── src/
│   ├── app/                 # Expo Router file-based screens
│   │   ├── _layout.tsx      # Root layout, StatusBar & SafeAreaProvider
│   │   └── index.tsx        # Main Distraction-Free Run HUD Screen
│   ├── components/          # Reusable UI components
│   │   ├── ControlButton.tsx    # Tactile large buttons (Start/Pause/Resume/Finish)
│   │   ├── GpsAlertModal.tsx    # GPS Gatekeeper diagnosis & resolution modal
│   │   ├── MetricTile.tsx       # High-contrast tabular numeric displays
│   │   └── RunHistoryModal.tsx  # Cached past run sessions view
│   ├── hooks/
│   │   └── useRunTracker.ts # Precision GPS tracking & state machine hook
│   ├── types/
│   │   └── tracking.ts      # TypeScript interfaces for coordinates, telemetry & runs
│   └── utils/
│       ├── geo.ts           # Haversine distance, speed-to-pace & formatting
│       └── storage.ts       # AsyncStorage persistence for run history
├── app.json                 # Expo project configuration & native permissions
├── babel.config.js          # Babel preset with NativeWind configuration
├── global.css               # Tailwind CSS directives
├── metro.config.js          # Metro bundler configured with withNativeWind
├── nativewind-env.d.ts      # TypeScript definitions for NativeWind
├── tailwind.config.js       # Custom HUD color palette and typography
└── tsconfig.json            # Strict TypeScript configuration with @/* path aliases
```

---

## 🚀 Getting Started

### Prerequisites
* Node.js $\ge 20$
* npm or bun
* Physical mobile device with [Expo Go](https://expo.dev/go) (Android / iOS)

### Installation
```bash
# Install SDK-compatible dependencies
npx expo install
```

### Starting Development Server

#### Running with Internet Tunnel (Recommended for phone testing):
```bash
npx expo start --tunnel
```
Scan the QR code displayed in the terminal with your phone camera (iOS) or within the **Expo Go** app (Android).

#### Running on Local Wi-Fi:
```bash
npx expo start
```

---

## 🧪 Verification & Diagnostics

Run project health checks:

```bash
# Verify TypeScript types
npx tsc --noEmit

# Diagnose Expo dependencies and config
npx expo-doctor
```

---

## 📄 License
MIT
