import os
import io
import sys
import json # Import the json module
import google.generativeai as genai
from flask import Flask, request, jsonify
from flask_cors import CORS 
from dotenv import load_dotenv 

# Load environment variables from .env file
load_dotenv() 

app = Flask(__name__)
CORS(app) 

# --- Configure Gemini ---
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    print("❌ GEMINI_API_KEY environment variable not found.", file=sys.stderr)
    sys.exit(1)

genai.configure(api_key=api_key)
# Using the model name you specified
MODEL_NAME = "gemini-2.5-flash" 
model = genai.GenerativeModel(MODEL_NAME)

print("✅ Gemini client configured successfully.")


# --- Interview Route (Modified) ---
@app.route("/interview", methods=["GET"])
def get_interview_questions():
    print("📩 /interview endpoint hit!")

    INTERVIEW_PROMPT = (
        "Generate 10 common job interview questions. "
        "Return ONLY a valid JSON object containing a single key 'questions' "
        "which holds an array of strings (the questions). "
        "Do not include any introductory text, markdown formatting, or backticks."
    )

    try:
        response = model.generate_content(INTERVIEW_PROMPT)
        raw_text = getattr(response, "text", "").strip()
        
        # --- Attempt to parse the JSON ---
        try:
            # Clean potential markdown backticks
            if raw_text.startswith("```json"):
                raw_text = raw_text[7:]
            if raw_text.endswith("```"):
                raw_text = raw_text[:-3]
            
            parsed_json = json.loads(raw_text)
            
            if isinstance(parsed_json, dict) and "questions" in parsed_json and isinstance(parsed_json["questions"], list):
                 print("✅ Successfully parsed questions JSON.")
                 return jsonify(parsed_json) # Return the parsed dictionary
            else:
                raise ValueError("JSON structure is incorrect")

        except (json.JSONDecodeError, ValueError) as json_err:
            print(f"🔥 Failed to parse Gemini response as JSON: {json_err}", file=sys.stderr)
            print(f"Raw response was: {raw_text}", file=sys.stderr)
            return jsonify({"error": f"Failed to get structured questions from AI: {json_err}"}), 500

    except Exception as e:
        print(f"🔥 Gemini API error during question generation: {e}", file=sys.stderr)
        return jsonify({"error": str(e)}), 500
    

# --- NEW: Get Feedback Route (MODIFIED FOR SCORES) ---
@app.route('/get_feedback', methods=['POST'])
def get_feedback():
    print("📩 /get_feedback endpoint hit!")
    if not model:
        return jsonify({"error": "Gemini model not initialized."}), 500
    
    data = request.get_json()
    if not data or 'question' not in data or 'answer' not in data:
        return jsonify({"error": "Missing 'question' or 'answer' in JSON body"}), 400

    question = data['question']
    answer = data['answer']
    
    # --- NEW PROMPT: Demanding JSON with scores ---
    FEEDBACK_PROMPT = (
        f"You are an expert interview coach. Analyze the user's answer to the interview question. "
        f"Provide a quantitative score from 1 (Poor) to 5 (Excellent) for each category: "
        f"1. **Relevance**: How well the answer directly addresses the question. "
        f"2. **Clarity**: How clear and easy to understand the answer is. "
        f"3. **Conciseness**: How to-the-point the answer is, avoiding rambling. "
        f"Finally, provide a brief 'prose_feedback' (2-3 sentences max). "
        f"Return ONLY a valid JSON object in this exact format: "
        f"{{\"scores\": {{\"relevance\": <score_1_5>, \"clarity\": <score_1_5>, \"conciseness\": <score_1_5>}}, \"prose_feedback\": \"<your_text_feedback>\"}}"
        f"\n\n--- QUESTION --- \n{question}\n\n--- ANSWER --- \n{answer}\n\n--- JSON FEEDBACK ---"
    )

    try:
        response = model.generate_content(FEEDBACK_PROMPT)
        raw_text = getattr(response, "text", "").strip()

        # Attempt to parse the JSON
        try:
            if raw_text.startswith("```json"):
                raw_text = raw_text[7:]
            if raw_text.endswith("```"):
                raw_text = raw_text[:-3]

            parsed_json = json.loads(raw_text)

            if (isinstance(parsed_json, dict) and 
                "scores" in parsed_json and 
                "prose_feedback" in parsed_json and 
                isinstance(parsed_json["scores"], dict)):
                print("✅ Successfully parsed feedback JSON.")
                return jsonify(parsed_json) # Return the whole object
            else:
                raise ValueError("JSON structure is incorrect")

        except (json.JSONDecodeError, ValueError) as json_err:
            print(f"🔥 Failed to parse feedback JSON: {json_err}", file=sys.stderr)
            print(f"Raw response was: {raw_text}", file=sys.stderr)
            # Fallback: just send the raw text as feedback if parsing fails
            return jsonify({"scores": {}, "prose_feedback": raw_text})

    except Exception as e:
        print(f"🔥 Gemini API error during feedback: {e}", file=sys.stderr)
        return jsonify({"error": f"Gemini API error: {e}"}), 500

if __name__ == '__main__':
    if sys.stdout:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    # Listen on all network interfaces for deployment
    app.run(host='0.0.0.0', port=5000, threaded=True)