<div align="center">
  <img src="https://raw.githubusercontent.com/Kshitiz-b/vnstat-dashboard/refs/heads/main/preview/logo.png" alt="Logo" width=500px>
</div>

# VNStat Dashboard

A sleek, responsive, containerized web dashboard to visualize network interface statistics using [`vnstat`](https://github.com/vergoh/vnstat).

---

## ✨ Features

- Real-time traffic display from `vnstat`
- Graphs for Hourly, Daily, Monthly, Yearly usage
- Responsive, dark-mode friendly UI
- Dockerized for portability
- Uses a single container for backend + frontend
- **Automatic Interface Detection** – no hardcoded `eth0`, `wlan0` etc.
- **Interface Aliases** – displays vnStat interface aliases alongside their interface IDs
- Custom interface filtering via environment variables
- Works on ARM (Raspberry Pi) and x86 systems

---

## 📦 Technologies Used

- **Frontend**: React + TailwindCSS + Recharts
- **Backend**: Node.js + Express
- **System**: vnStat CLI
- **Containerization**: Docker (multi-stage Alpine build)

---

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/Kshitiz-b/vnstat-dashboard.git
cd vnstat-dashboard
```

### 2. Build Docker Image

```bash
docker build -t vnstat-dashboard .
```

### 3. Run the Container

Make sure to use `--privileged` so that `vnstat` inside the container can access system data:

```bash
docker run -d \
  --name vnstat-dashboard \
  --privileged \
  --network host \
  -v /var/lib/vnstat:/var/lib/vnstat:ro \
  kshitizb/vnstat-dashboard
```

### 4. Access the Dashboard

Open your browser and navigate to:

```
http://localhost:8050
```

---

## 🐳 Using Docker Compose

A ready-to-use `docker-compose.yaml` is included:

```yaml
services:
  vnstat-dashboard:
    image: kshitizb/vnstat-dashboard:latest
    network_mode: host
    privileged: true
    environment:
      - TZ=UTC  # Timezone vnStat reports timestamps in, e.g. Europe/Monaco (optional)
    volumes:
      - /var/lib/vnstat:/var/lib/vnstat:ro
    restart: unless-stopped
```

Run with:

```bash
docker compose up -d
```

---

## 🧭 Environment Variables

| Variable | Description | Default |
|-----------|--------------|----------|
| `PORT` | Port the app listens on | `8050` |
| `FRONTEND_DIR` | Path to built frontend | `frontend-build` |
| `ALLOWED_PREFIXES` | Comma-separated list of allowed interface prefixes | `eth,enp,wlan,wlp,tailscale,docker` |
| `ALLOWED_INTERFACES` | Explicit interface names (overrides prefix detection) | *(none)* |
| `TZ` | Container timezone in IANA format (e.g. `Europe/Monaco`, `Asia/Almaty`). Auto-detected from host if not set | auto-detected / `UTC` |

> **Timezone note:** `TZ` sets the zone in which **vnStat reports** its wall-clock timestamps
> (and the zone the dashboard uses to interpret them). vnStat is invoked as a child process of the backend
> and is always given the same `TZ` reported by `/api/config`, so the conversion is self-consistent -
> it does **not** need to match the host's timezone. If `TZ` is unset, the container's system zone is used.

---

## 🖼️ Screenshots

![Dashboard Preview](https://raw.githubusercontent.com/Kshitiz-b/vnstat-dashboard/refs/heads/main/preview/home.png)
![Hourly Dashboard Preview](https://raw.githubusercontent.com/Kshitiz-b/vnstat-dashboard/refs/heads/main/preview/hourly.png)
![Daily Dashboard Preview](https://raw.githubusercontent.com/Kshitiz-b/vnstat-dashboard/refs/heads/main/preview/daily.png)
![Monthly Dashboard Preview](https://raw.githubusercontent.com/Kshitiz-b/vnstat-dashboard/refs/heads/main/preview/monthly.png)
![Yearly Dashboard Preview](https://raw.githubusercontent.com/Kshitiz-b/vnstat-dashboard/refs/heads/main/preview/yearly.png)

---

## 🔧 Requirements

- Docker installed
- `vnstat` installed and daemon running on host (`sudo apt install vnstat`)
- Raspberry Pi or any ARMv8/AMD64 compatible Linux device

---

## 🐳 Ports & API

- **Frontend + API served on same port**: `8050`
- Backend API Endpoints:
  - `/api/interfaces` → List of available interfaces and their vnStat aliases
  - `/api/vnstat/:interface` → Detailed JSON data for that interface

### `/api/interfaces`

Returns the available interfaces along with their configured vnStat aliases:

```json
{
  "interfaces": [
    {
      "id": "docker0",
      "alias": "Docker Bridge"
    },
    {
      "id": "eth0",
      "alias": null
    }
  ]
}
```

Interfaces without a configured alias return `null`.

---

## 🧩 Directory Structure

```
.
├── backend/
│   └── server.js
├── frontend/
│   ├── public/
│   └── src/
├── preview/
├── docker-compose.yml
├── Dockerfile
└── README.md
```

---

## 📛 Customization

- Configure detection rules in `backend/server.js`
- Change UI/theme in `frontend/src/App.js` or TailwindCSS

### Interface Aliases

vnStat interface aliases can be configured using:

```bash
sudo vnstat -i <interface> --setalias "<alias>"
```

For example:

```bash
sudo vnstat -i docker0 --setalias "Docker Bridge"
```

The dashboard displays the alias alongside the underlying interface ID, for example:

`Docker Bridge (docker0)`

---

## 📝 License

MIT © [Kshitiz](https://github.com/Kshitiz-b)
