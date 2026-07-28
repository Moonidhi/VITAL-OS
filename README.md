# VITAL-OS (Virtual Intelligent Triage and Load Operating System)

> **AI-Powered Hospital Microgrid Telemetry & Energy Triage Platform**

VITAL-OS is an intelligent hospital energy management platform designed to ensure uninterrupted power delivery to critical healthcare facilities. It continuously monitors renewable energy sources (rooftop solar arrays and wind turbines), Battery Energy Storage Systems (BESS), and real-time hospital department power demand.

By leveraging machine learning (`GradientBoostingRegressor`), VITAL-OS forecasts future power requirements and provides real-time triage recommendations—automatically prioritizing power allocation to high-criticality departments such as Intensive Care Units (ICU) and Operation Theatres (OT) during microgrid stress or main grid power outages.

---

## 🌟 Key Features

- **⚡ Real-Time Microgrid Telemetry**: Live tracking of solar generation, wind power, battery State of Charge (SoC), grid import/export, and overall hospital net balance.
- **🤖 Predictive ML Load Forecasting**: Scikit-Learn based machine learning engine predicting hospital power demand for 15-minute lookahead windows.
- **🚨 Intelligent Department Triage**: Dynamic load-shedding and power prioritization engine guaranteeing power continuity for life-critical departments (ICU, OT, ER) while gracefully throttling non-critical hospital loads.
- **🔄 Physics-Informed Simulation Engine**: Realistic telemetry simulator modeling solar irradiance curves, cloud-cover dynamics, wind speed variations, battery efficiency curves, and hospital diurnal clinical cycles.
- **📊 Modern Interactive Dashboard**: Responsive React + Vite frontend built with TailwindCSS and Recharts for live telemetry visualization, AI confidence status, and department power controls.
- **🌐 IoT & Smart Grid Ready**: Cleanly decoupled architecture prepared for seamless extension to hardware IoT gateways, Modbus/BACnet protocols, and MQTT energy telemetry meters.

---

## 🏗️ System Architecture

```
                                +-----------------------------------+
                                |     Renewable Energy Systems      |
                                | (Solar PV, Wind, Battery Storage) |
                                +-----------------+-----------------+
                                                  |
                                                  v
+-----------------------+       +-----------------+-----------------+
|  Hospital IoT Meters  | ----> |     Telemetry & Simulation      |
|    & Smart Grid       |       |          Engine                   |
+-----------------------+       +-----------------+-----------------+
                                                  |
                                                  v
                                +-----------------+-----------------+
                                |     FastAPI Backend Engine        |
                                |  - REST API & SQLite DB           |
                                |  - ML Load Predictor (Scikit)     |
                                |  - Triage Allocation Algorithm    |
                                +-----------------+-----------------+
                                                  |
                                                  v
                                +-----------------+-----------------+
                                |    React + Vite Dashboard         |
                                |  - Live Telemetry Gauges          |
                                |  - Recharts Power Flow Charts     |
                                |  - Department Allocation Controls |
                                +-----------------------------------+
```

---

## 🛠️ Technology Stack

### **Backend**
- **Language**: Python 3.10+
- **API Framework**: FastAPI (Uvicorn server)
- **Database**: SQLite with SQLAlchemy 2.0 ORM
- **Machine Learning**: Scikit-learn (`GradientBoostingRegressor`), Pandas, NumPy
- **Data Schemas**: Pydantic v2

### **Frontend**
- **Framework**: React 18 with Vite
- **Styling**: TailwindCSS, PostCSS, Autoprefixer
- **Data Visualization**: Recharts
- **Routing**: React Router DOM v7

---

## 🚀 Quickstart Guide

### Prerequisites
- **Python**: `3.10` or higher
- **Node.js**: `18.x` or higher (with `npm`)
- **Git**

---

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/vital-os.git
cd vital-os
```

---

### 2️⃣ Set Up & Launch Backend API

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows:
# venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start FastAPI dev server
uvicorn main:app --reload --port 8000
```
> The API server will be available at **`http://localhost:8000`**  
> Interactive OpenAPI documentation (Swagger) is accessible at **`http://localhost:8000/docs`**

---

### 3️⃣ Set Up & Launch Frontend Dashboard

Open a new terminal tab/window:

```bash
# Navigate to frontend directory
cd frontend

# Install Node dependencies
npm install

# Start Vite development server
npm run dev
```
> Access the interactive live dashboard at **`http://localhost:5173`**

---

## 📡 API Reference

| Endpoint | Method | Description |
|---|---|---|
| `GET /` | `GET` | API root check and status |
| `GET /health` | `GET` | Health check & SQLite database connectivity test |
| `GET /simulation/current` | `GET` | Fetch latest microgrid telemetry snapshot |
| `GET /simulation/run` | `GET` | Run simulation engine forward by specified intervals |
| `GET /simulation/day-summary` | `GET` | Get 24-hour summary of power generation, load, and grid outages |
| `GET /ai/predict` | `GET` | Predict next 15-min hospital load & return triage recommendations |
| `GET /ai/status` | `GET` | Check ML model training status, RMSE metrics, and sample counts |
| `GET /patients` | `GET` | List emergency & triage patients |
| `POST /patients` | `POST` | Register patient vitals and trigger triage scoring |

---

## 🔮 Future Roadmap: Hardware & IoT Integration

While VITAL-OS utilizes a telemetry simulation engine for rapid prototyping, its backend architecture is designed for hardware energy management:

1. **IoT Gateway Connectors**: MQTT driver integration for hardware power analyzers and smart circuit breakers.
2. **Industrial Protocols**: Support for MODBUS TCP/RTU and BACnet/IP building automation networks.
3. **Advanced ML Forecasting**: Deep Learning (LSTM / Temporal Fusion Transformers) for multi-day weather-integrated load forecasting.
4. **Automated Relay Control**: Direct GPIO / PLC control signals for automated microgrid islanding and load shedding switches.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
