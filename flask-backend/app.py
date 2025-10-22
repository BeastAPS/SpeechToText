import os
import io
import sys
import tempfile
import speech_recognition as sr
import google.generativeai as genai
from flask import Flask, request, jsonify
from flask_cors import CORS 
from dotenv import load_dotenv 
from pydub import AudioSegment

# Load environment variables from .env file
load_dotenv() 

app = Flask(__name__)
CORS(app) 

# --- Configure Gemini ---
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise ValueError("❌ GEMINI_API_KEY environment variable not found.")

genai.configure(api_key=api_key)
MODEL_NAME = "gemini-2.5-flash"
model = genai.GenerativeModel(MODEL_NAME)

print("✅ Gemini client configured successfully.")



# --- Interview Route ---
@app.route("/interview", methods=["GET"])
def get_interview_questions():
    print("📩 /interview endpoint hit!")

    INTERVIEW_PROMPT = (
        "I want you to pretend you are giving me an interview. "
        "Please give me 10 interview questions to answer."
    )

    try:
        response = model.generate_content(INTERVIEW_PROMPT)
        text = getattr(response, "text", None)
        if not text:
            text = str(response)
        return jsonify({"questions": text})
    except Exception as e:
        print("🔥 Gemini API error:", e)
        return jsonify({"error": str(e)}), 500
    


    

# --- Transcribe & Generate Route ---
@app.route('/transcribe_and_generate', methods=['POST'])
def transcribe_and_generate():
    if not model:
        return jsonify({"error": "Gemini model not initialized."}), 500
        
    if 'audio' not in request.files:
        return jsonify({"error": "No audio file provided"}), 400

    audio_file = request.files['audio']

    try:
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=True) as temp_webm:
            audio_file.save(temp_webm.name)

            with tempfile.NamedTemporaryFile(suffix=".wav", delete=True) as temp_wav:
                audio_segment = AudioSegment.from_file(temp_webm.name, format="webm")
                audio_segment.export(temp_wav.name, format="wav")

                r = sr.Recognizer()
                with sr.AudioFile(temp_wav.name) as source:
                    audio_data = r.record(source)
                    prompt_text = r.recognize_google(audio_data)
                    print(f"🗣️ Transcribed: {prompt_text}")

    except sr.UnknownValueError:
        return jsonify({"error": "Could not understand audio"}), 400
    except sr.RequestError as e:
        return jsonify({"error": f"Speech recognition service error: {e}"}), 500
    except Exception as e:
        return jsonify({"error": f"Audio processing error: {e}"}), 500

    try:
        response = model.generate_content(prompt_text)
        gemini_text = getattr(response, "text", "").strip()
        print(f"🤖 Gemini Response: {gemini_text[:100]}...")
        return jsonify({"prompt": prompt_text, "response": gemini_text})
    except Exception as e:
        return jsonify({"error": f"Gemini API error: {e}"}), 500

if __name__ == '__main__':
    if sys.stdout:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    app.run(debug=True, port=5000)
