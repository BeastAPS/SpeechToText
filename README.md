🎙️ Voice Chat with Gemini (React & Flask)

This project demonstrates a full-stack application that captures audio input from a web browser (React), sends it to a Python backend (Flask), transcribes the audio using the SpeechRecognition library (which requires FFmpeg for audio conversion), and generates a response using the Google Gemini API.

🚀 Setup Prerequisites

This project requires three main runtime environments to be configured.

1. System Dependencies (Critical)

The Python backend uses the pydub library for audio conversion, which requires the external FFmpeg multimedia framework to be installed on your operating system.

OS

Installation Command

Debian/Ubuntu (Linux)

sudo apt update && sudo apt install ffmpeg

macOS (using Homebrew)

brew install ffmpeg

Windows

Download the binaries and ensure the ffmpeg/bin directory is added to your System PATH.

2. General Dependencies

Node.js (v16+): Required for the React frontend and npm package manager.

Python 3.8+: Required for the Flask backend.

🔑 Configuration

1. Gemini API Key

You must obtain a Gemini API Key.

2. Local Secrets File

Create a file named .env inside the flask-backend/ directory (at the same level as app.py) and paste your API key inside.

# flask-backend/.env
GEMINI_API_KEY="YOUR_API_KEY_HERE"


⚙️ Installation

Step 1: Clone the Repository

git clone [https://github.com/BeastAPS/SpeechToText.git](https://github.com/BeastAPS/SpeechToText.git)
cd SpeechToText


Step 2: Set up the Backend (Flask API)

This sets up the Python environment and installs Flask, google-generativeai, and audio processing libraries.

cd flask-backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt


Step 3: Set up the Frontend (React)

This sets up the Node environment and installs React dependencies.

cd ../react-frontend
npm install


▶️ Running the Application

You must run the backend API and the frontend client simultaneously in separate terminal windows.

1. Start the Backend API (Terminal 1)

Ensure your Python virtual environment is active. The API runs on http://127.0.0.1:5000/.

cd flask-backend
source venv/bin/activate
python app.py


2. Start the Frontend Client (Terminal 2)

The React client runs on a different port, typically http://localhost:5173/.

cd react-frontend
npm run dev


The application is now accessible in your web browser at the frontend address.
