import React, { useState, useRef } from 'react';

function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioURL, setAudioURL] = useState(null); // Stores the playable URL for the user
  const [geminiResponse, setGeminiResponse] = useState('');
  const [promptText, setPromptText] = useState('');
  const [error, setError] = useState('');
  const [questions, setQuestions] = useState("");
  const [startedInterview, setInterview] = useState(true);
  const [allowRecording, setAllowRecording] = useState(false);

  
  // Ref to hold the actual audio Blob object for sending to the backend later
  const finalAudioBlobRef = useRef(null); 
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const startRecording = async () => {
    // Reset all states and refs for a new recording
    setError('');
    setGeminiResponse('');
    setPromptText('');
    setAudioURL(null); 
    finalAudioBlobRef.current = null;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      mediaRecorderRef.current = new MediaRecorder(stream, { 
        mimeType: 'audio/webm; codecs=opus' 
      });
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        // 1. Create the Blob and save it to the ref
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        finalAudioBlobRef.current = audioBlob;
        
        // 2. Create a URL for the browser's audio player
        const url = URL.createObjectURL(audioBlob);
        setAudioURL(url);
        
        // Stop the mic stream tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      setError("Failed to access microphone. Check permissions.");
      setIsRecording(false);
    }
  };

  const fetchInterviewQuestions = async () => {
  try {
    setInterview(false);
    setError("Fetching interview questions...");
    const res = await fetch("http://127.0.0.1:5000/interview");
    if (!res.ok) throw new Error("Failed to get interview questions");
    const data = await res.json();
    setQuestions(data.questions);
    setAllowRecording(true);
    setError(""); // clear any old errors
  } catch (err) {
    setError(`Error fetching questions: ${err.message}`);
  }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };
  
  const sendAudioToBackend = async () => {
    const audioBlob = finalAudioBlobRef.current;
    if (!audioBlob) {
        setError("No audio recorded to send.");
        return;
    }
    
    setError('Sending audio for transcription and generation...');

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'voice.webm'); 

      const response = await fetch('http://127.0.0.1:5000/transcribe_and_generate', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      setError(''); // Clear error state on success
      setPromptText(data.prompt);
      setGeminiResponse(data.response);

    } catch (err) {
      setError(`Backend error: ${err.message}.`);
    }
  };


  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      <header className="text-center mb-8">
        <h1 className="text-4xl font-bold text-cyan-400">Voice Chat with Gemini</h1>
        <p className="mt-2 text-lg text-gray-400">Record, Review, and Send your prompt.</p>
      </header>
      {/* Start Interview Section */}
    <div className="mb-6 w-full">
      {startedInterview && (
      <button 
        onClick={fetchInterviewQuestions}
        className="w-full py-3 bg-purple-600 hover:bg-purple-700 rounded-lg text-lg font-semibold transition duration-200"
      >
        🎯 Start Interview
      </button>)}

      {questions && (
        <div className="mt-4 p-4 border border-gray-700 rounded-lg">
          <h2 className="text-xl font-bold text-cyan-400 mb-2">Interview Questions:</h2>
          <pre className="text-gray-300 whitespace-pre-wrap">{questions}</pre>
        </div>
      )}
    </div>
      <div className="w-full max-w-md bg-gray-800 p-6 rounded-xl shadow-2xl">
        {/* Record/Stop Button */}
        {allowRecording && (
        <button 
          onClick={isRecording ? stopRecording : startRecording}
          disabled={error && !isRecording}
          className={`w-full py-3 rounded-lg text-lg font-semibold transition duration-200 ease-in-out 
            ${isRecording 
              ? 'bg-red-600 hover:bg-red-700' 
              : 'bg-green-500 hover:bg-green-600 mb-4'}`
          }
        >
          {isRecording ? '🛑 Stop Recording' : '🎙️ Start New Recording'}
        </button>)}

        {isRecording && <p className="mt-4 text-yellow-400 animate-pulse">Recording... Listening for your voice!</p>}
        {error && <p className="error-message text-red-400 font-medium mt-4">{error}</p>}

        {/* Review/Send Section (Visible after recording stops) */}
        {audioURL && !isRecording && (
            <div className="mt-6 p-4 border border-gray-700 rounded-lg space-y-4">
                <h2 className="text-xl font-bold text-yellow-400">Review Audio</h2>
                <audio controls src={audioURL} className="w-full bg-gray-700 rounded-lg p-2" />
                
                <button 
                    onClick={sendAudioToBackend}
                    className="w-full py-3 bg-blue-500 hover:bg-blue-600 rounded-lg text-lg font-semibold transition duration-200"
                >
                    🚀 Send Audio to Gemini
                </button>
            </div>
        )}
        
        {/* Response Section */}
        {promptText && (
          <div className="response-section mt-6 p-4 border border-gray-700 rounded-lg">
            <h2 className="text-xl font-bold text-cyan-400 mb-2">You Said:</h2>
            <p className="text-gray-300 mb-4 italic">"{promptText}"</p>
            <h2 className="text-xl font-bold text-cyan-400 mb-2">Gemini Response:</h2>
            <p className="text-gray-100">{geminiResponse}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Ensure the App component is the default export
export default App;
