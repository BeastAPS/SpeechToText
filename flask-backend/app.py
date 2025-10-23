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
    # Use standard error for critical startup issues
    print("❌ GEMINI_API_KEY environment variable not found.", file=sys.stderr)
    # Exiting here is safer than raising in a Flask app context
    sys.exit(1)

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
            # Fallback if text attribute is missing, though rare
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
    
    # Variables to hold the names of the temporary files for cleanup
    temp_webm_name = None
    temp_wav_name = None

    try:
        # 1. Handle .webm file: Save the incoming audio
        # CRITICAL: Use delete=False to prevent immediate deletion and file locking issues
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as temp_webm:
            audio_file.save(temp_webm.name)
            temp_webm_name = temp_webm.name
            # CRITICAL FIX: Close the file handle to release the OS lock
            temp_webm.close() 

        # 2. Convert .webm to .wav
        # CRITICAL: Use delete=False for the wav file as well
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_wav:
            temp_wav_name = temp_wav.name
            
            # This requires ffmpeg/libav to be installed and accessible in the PATH
            audio_segment = AudioSegment.from_file(temp_webm_name, format="webm")
            audio_segment.export(temp_wav_name, format="wav")
            
            # Close the .wav file handle to release the OS lock before SpeechRecognition uses it
            temp_wav.close() 

        # 3. Transcribe the .wav file
        r = sr.Recognizer()
        with sr.AudioFile(temp_wav_name) as source:
            audio_data = r.record(source)
            prompt_text = r.recognize_google(audio_data)
            print(f"🗣️ Transcribed: {prompt_text}")

    except sr.UnknownValueError:
        return jsonify({"error": "Could not understand audio"}), 400
    except sr.RequestError as e:
        return jsonify({"error": f"Speech recognition service error: {e}"}), 500
    except Exception as e:
        # Print the error for server-side debugging
        print(f"🔥 Audio processing error details: {e}", file=sys.stderr)
        return jsonify({"error": f"Audio processing error: {e}"}), 500
        
    finally:
        # 4. Clean up temporary files
        try:
            if temp_webm_name and os.path.exists(temp_webm_name):
                os.unlink(temp_webm_name)
            if temp_wav_name and os.path.exists(temp_wav_name):
                os.unlink(temp_wav_name)
        except Exception as cleanup_e:
             # Log cleanup failure but don't stop the main process flow
             print(f"⚠️ Warning: Failed to clean up temporary files: {cleanup_e}", file=sys.stderr)

    # 5. Generate content with Gemini
    try:
        response = model.generate_content(prompt_text)
        gemini_text = getattr(response, "text", "").strip()
        print(f"🤖 Gemini Response: {gemini_text[:100]}...")
        return jsonify({"prompt": prompt_text, "response": gemini_text})
    except Exception as e:
        return jsonify({"error": f"Gemini API error: {e}"}), 500

if __name__ == '__main__':
    # Ensure stdout encoding is set to handle different characters in logs
    if sys.stdout:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    app.run(debug=True, port=5000, threaded=True)
