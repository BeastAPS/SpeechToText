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

# --- Configuration ---
MODEL_NAME = "gemini-2.5-flash" 

if sys.stdout:
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# 1. Configure the API Key and Initialize Model
api_key = os.getenv("GEMINI_API_KEY")
gemini_model = None

try:
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable not found.")
        
    genai.configure(api_key=api_key)
    print("Gemini client configured successfully.")

    gemini_model = genai.GenerativeModel(MODEL_NAME)

except Exception as e:
    print(f"Server Configuration Error: {e}")


@app.route('/transcribe_and_generate', methods=['POST'])
def transcribe_and_generate():
    if not gemini_model:
        return jsonify({"error": "Gemini service failed to initialize on the server."}), 500
        
    if 'audio' not in request.files:
        return jsonify({"error": "No audio file provided"}), 400

    audio_file = request.files['audio']
    
    # We need two temporary files: one for the incoming webm, one for the converted wav
    try:
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=True) as temp_webm:
            
            # 1. Save incoming WebM file
            audio_file.save(temp_webm.name)
            
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=True) as temp_wav:
                
                # 2. CONVERSION STEP: Convert WebM to guaranteed PCM WAV format using pydub/FFmpeg
                audio_segment = AudioSegment.from_file(temp_webm.name, format="webm")
                audio_segment.export(temp_wav.name, format="wav")
                
                # 3. Transcribe audio from the CONVERTED WAV file
                r = sr.Recognizer()
                prompt_text = None
                with sr.AudioFile(temp_wav.name) as source:
                    audio_data = r.record(source)
                    prompt_text = r.recognize_google(audio_data)
                    print(f"Transcribed Text: {prompt_text}")

    except sr.UnknownValueError:
        return jsonify({"error": "Could not understand audio"}), 400
    except sr.RequestError as e:
        return jsonify({"error": f"Speech recognition service error: {e}"}), 500
    except Exception as e:
        # Catch errors from pydub, FFmpeg, or file access
        return jsonify({"error": f"Error processing audio: {e}"}), 500

    if not prompt_text:
        return jsonify({"error": "No discernible speech detected"}), 400

    # Generate Gemini response
    try:
        response = gemini_model.generate_content(prompt_text)
        gemini_text = getattr(response, "text", "").strip()
        print(f"Gemini Response: {gemini_text[:100]}...")
        return jsonify({"prompt": prompt_text, "response": gemini_text})
    except Exception as e:
        return jsonify({"error": f"Gemini API error: {e}"}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
