# EdiFix ✨

[![License: MIT](https://img.shields.io/badge/License-MIT-teal.svg)](https://opensource.org/licenses/MIT)
[![Frontend: React](https://img.shields.io/badge/Frontend-React-61DAFB?logo=react&logoColor=black)](https://reactjs.org/)
[![Backend: FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)

**EdiFix** is a powerful, modern, open-source X12 EDI parser and validator. Built with healthcare interoperability in mind, it provides robust parsing, intuitive visualization, and advanced error detection for complex EDI formats.

---

## 🚀 Features

- **Instant Parsing**: Lightning-fast processing for massive EDI files.
- **Support for Key X12 Formats**: 
  - `837` Professional and Institutional Claims
  - `835` Health Care Claim Payment/Advice (Remittance)
  - `834` Benefit Enrollment and Maintenance
- **Advanced Validation**:
  - NPI Verification
  - ICD-10 Existence Checks
  - CARC/RARC Validation
- **AI-Powered Fix Suggestions**: Get smart, contextual recommendations on how to fix validation errors.
- **Interactive "True" EDI Tree**: Explore loops as folders and segments as files in a familiar, code-editor style interface.
- **Segment Inspector**: Instantly view detailed, key-value data mappings for any selected segment in your payload.
- **Premium Dashboard UI**: Designed with a sleek, modern aesthetic tailored for smooth and productive data analysis.

---

## 🛠️ Architecture

EdiFix is split into two main layers:

1. **Frontend**: A high-performance React Single Page Application powered by Vite and written in TypeScript.
2. **Backend**: A blazing-fast Python API built on FastAPI to handle intense file parsing, structural verification, and rules engine execution.

---

## 📦 Getting Started

### Prerequisites
- Node.js (v18+)
- Python (3.10+)

### 1. Setting up the Backend
```bash
# Navigate to the backend directory
cd backend

# Create a virtual environment
python -m venv venv

# Activate the virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the backend development server
uvicorn main:app --reload
```
The backend server will run by default on `http://localhost:8000`.

### 2. Setting up the Frontend
```bash
# Navigate to the frontend directory
cd frontend

# Install dependencies
npm install

# Run the Vite development server
npm run dev
```
The frontend application will be accessible at `http://localhost:5173` (or the port specified in your console).

---

## 🤝 Contributing

We welcome contributions! EdiFix thrives on the inputs from developers and healthcare technologists around the world. Please open an issue before submitting a pull request for major changes.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information. Not affiliated with X12.org, CMS, or AMA.

---

*Built with ♥ for healthcare interoperability.*
