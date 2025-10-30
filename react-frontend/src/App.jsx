import React, { useState, useEffect } from 'react';
import 'regenerator-runtime/runtime'; // Keep polyfill
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';

// --- Helper component for rendering score bars ---
const ScoreBar = ({ label, score }) => {
  const width = score ? (score / 5) * 100 : 0; // Calculate width %
  return (
    <div className="mb-2">
      <div className="flex justify-between mb-1">
        <span className="text-sm font-medium text-gray-300 capitalize">{label}</span>
        <span className="text-sm font-medium text-cyan-300">{score || 0} / 5</span>
      </div>
      <div className="w-full bg-gray-600 rounded-full h-2.5">
        <div
          className="bg-cyan-400 h-2.5 rounded-full transition-all duration-500"
          style={{ width: `${width}%` }}
        ></div>
      </div>
    </div>
  );
};
// --- End helper component ---

function App() {
  // State for API data & errors
  const [error, setError] = useState('');
  const [loadingMessage, setLoadingMessage] = useState('');

  // State for interview flow
  const [allQuestions, setAllQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(-1);
  const [interviewData, setInterviewData] = useState([]); // Stores { question, answer, scores, feedback }
  const [isInterviewComplete, setIsInterviewComplete] = useState(false);
  const [isLoadingNext, setIsLoadingNext] = useState(false);

  // react-speech-recognition hook
  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition
  } = useSpeechRecognition();

  const currentQuestion = allQuestions[currentQuestionIndex] || null;

  useEffect(() => {
    resetTranscript();
  }, [currentQuestionIndex]);

  // --- Interview Flow Functions ---

  const startInterview = async () => {
    setError('');
    setLoadingMessage("Fetching interview questions...");
    setIsInterviewComplete(false);
    setCurrentQuestionIndex(-1);
    setInterviewData([]);
    setAllQuestions([]);

    try {
      // *** REMEMBER TO UPDATE THIS URL WHEN DEPLOYING ***
      const res = await fetch("http://127.0.0.1:5000/interview");
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to get interview questions");
      }
      const data = await res.json();

      if (!data.questions || data.questions.length === 0) {
        throw new Error("Received empty or invalid questions list from server.");
      }

      setAllQuestions(data.questions);
      setCurrentQuestionIndex(0);
      setError('');
    } catch (err) {
      setError(`Error starting interview: ${err.message}`);
    } finally {
      setLoadingMessage('');
    }
  };

  // --- Speech-to-Text Functions ---
  const startListening = () => {
    setError('');
    resetTranscript();
    SpeechRecognition.startListening({ continuous: true });
  };

  const stopListening = () => {
    SpeechRecognition.stopListening();
  };

  // --- Submit Answer and Get Feedback ---
  const submitAnswerAndGoNext = async () => {
    if (!currentQuestion || !transcript) {
      setError("Please record an answer before proceeding.");
      return;
    }

    setIsLoadingNext(true);
    setError('');
    setLoadingMessage('Analyzing your answer...');

    const currentAnswer = transcript;

    try {
      // *** REMEMBER TO UPDATE THIS URL WHEN DEPLOYING ***
      const response = await fetch('http://127.0.0.1:5000/get_feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: currentQuestion,
          answer: currentAnswer
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
      }

      const data = await response.json(); // Expects { scores: {...}, prose_feedback: "..." }

      setInterviewData(prevData => [
        ...prevData,
        {
          question: currentQuestion,
          answer: currentAnswer,
          feedback: data.prose_feedback || "No feedback text.",
          scores: data.scores || {} // Store the scores object
        }
      ]);

      if (currentQuestionIndex < allQuestions.length - 1) {
        setCurrentQuestionIndex(prevIndex => prevIndex + 1);
        resetTranscript();
      } else {
        setIsInterviewComplete(true);
      }
      setError('');

    } catch (err) {
      setError(`Error getting feedback: ${err.message}.`);
    } finally {
      setIsLoadingNext(false);
      setLoadingMessage('');
    }
  };

  // --- Browser Support Check ---
  if (!browserSupportsSpeechRecognition) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
        <h1 className="text-3xl text-red-500">
          Browser does not support speech recognition.
        </h1>
        <p className="mt-2 text-lg text-gray-400">Please try Google Chrome or Edge.</p>
      </div>
    );
  }

  // --- Calculate Overall Score ---
  const calculateOverallScore = () => {
    let totalScore = 0;
    let scoreCount = 0;
    interviewData.forEach(item => {
      if (item.scores) {
        // Only count valid scores (numbers between 1 and 5)
        Object.values(item.scores).forEach(score => {
          if (typeof score === 'number' && score >= 1 && score <= 5) {
             totalScore += score;
             scoreCount++;
          }
        });
      }
    });
    // Prevent division by zero and handle cases with no valid scores
    return scoreCount > 0 ? (totalScore / scoreCount).toFixed(1) : 'N/A';
  };

  return (
    // Main container - centers content horizontally, adds top padding
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-900 to-blue-900 text-white flex flex-col items-center pt-20 p-4">
      <header className="text-center mb-8">
        <h1 className="text-4xl font-bold text-cyan-300" >Mock AI Interview</h1>
      </header>

      {/* Main Content Card - Max width controls overall width, margin auto centers it if needed */}
      <div className="w-full max-w-2xl bg-gray-800 bg-opacity-90 backdrop-blur-sm p-6 sm:p-8 rounded-2xl shadow-2xl border border-gray-700">

        {/* --- Start Interview Button --- */}
        {currentQuestionIndex === -1 && !isInterviewComplete && (
          <button
            onClick={startInterview}
            disabled={loadingMessage}
            className="w-full mb-4 py-3 bg-purple-600 hover:bg-purple-500 rounded-lg text-lg font-semibold transition-all transform hover:scale-105 active:scale-95 duration-200 disabled:opacity-50"
          >
            {loadingMessage || 'Begin Interview'}
          </button>
        )}

        {/* --- Interview Question Area --- */}
        {!isInterviewComplete && currentQuestion && (
          <div className="mb-6">
            {/* Question Header - Text left-aligned by default */}
            <h2 className="text-xl font-bold text-cyan-300 mb-4">
              Question {currentQuestionIndex + 1} of {allQuestions.length}:
            </h2>
            {/* Question Text - Text left-aligned by default */}
            <p className="text-gray-100 text-lg bg-gray-900 bg-opacity-50 p-6 rounded-lg border border-gray-600">
              {currentQuestion}
            </p>

            {/* Recording Controls - Centered within this section */}
            <div className="mt-8 flex flex-col items-center">
              <button
                onClick={listening ? stopListening : startListening}
                disabled={isLoadingNext}
                className={`w-full sm:w-1/2 py-3 rounded-lg text-lg font-semibold transition-all transform hover:scale-105 active:scale-95 duration-200 mb-4 ${
                  listening
                    ? 'bg-red-600 hover:bg-red-500'
                    : 'bg-green-500 hover:bg-green-400'
                  } ${isLoadingNext ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {listening ? '🛑 Stop Recording' : '🎙️ Record Answer'}
              </button>

              {/* Listening Indicator - Centered */}
              {listening && <p className="text-yellow-300 animate-pulse mb-2">Listening...</p>}

              {/* Live Transcript - Text left-aligned by default */}
              {transcript && (
                  <div className="w-full mt-2 p-4 border border-gray-600 bg-gray-700 rounded-lg">
                      <h3 className="text-md font-semibold text-yellow-300 mb-2">Your Answer (Live):</h3>
                      <p className="text-gray-200 italic">{transcript}</p>
                  </div>
              )}

              {/* Next Question Button - Centered */}
              {!listening && transcript && (
                <button
                  onClick={submitAnswerAndGoNext}
                  disabled={isLoadingNext}
                  className="w-full sm:w-1/2 mt-4 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg text-lg font-semibold transition-all transform hover:scale-105 active:scale-95 duration-200 disabled:opacity-50"
                >
                  {isLoadingNext ? 'Preparing Next Question...' : '➡️ Next Question'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* --- Interview Complete / Results Area --- */}
        {isInterviewComplete && (
          <div>
            {/* Header - Centered */}
            <h2 className="text-3xl font-bold text-green-400 mb-6 text-center">Interview Complete!</h2>

            {/* Overall Score Box - Content centered */}
            <div className="text-center bg-gray-900 bg-opacity-70 p-6 rounded-xl mb-8 border border-gray-700 shadow-lg">
              <h3 className="text-lg font-semibold text-gray-300 uppercase tracking-wider mb-2">Overall Performance</h3>
              <p className="text-6xl font-bold text-cyan-300 my-1">{calculateOverallScore()}</p>
              <p className="text-gray-400">Average Score (out of 5.0)</p>
            </div>

            {/* Detailed Report Header - Centered */}
            <h3 className="text-2xl font-semibold text-gray-100 mb-5 text-center">Detailed Report</h3>

            {/* Per-Question Breakdown */}
            <div className="space-y-6">
              {interviewData.map((item, index) => (
                <div key={index} className="p-5 border border-gray-700 rounded-lg bg-gray-700 bg-opacity-40 shadow-md">
                  {/* Question Text - Left-aligned */}
                  <h4 className="text-lg font-semibold text-cyan-300 mb-3">
                    <span className="text-gray-400 font-normal">Q{index + 1}:</span> {item.question}
                  </h4>

                  {/* Answer Text - Left-aligned */}
                  <p className="text-gray-200 mb-4 pl-4 border-l-4 border-gray-500 italic">
                    "{item.answer || 'No answer recorded'}"
                  </p>

                  {/* Scores Section */}
                  <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-b border-gray-600 py-4">
                    <ScoreBar label="Relevance" score={item.scores?.relevance} />
                    <ScoreBar label="Clarity" score={item.scores?.clarity} />
                    <ScoreBar label="Conciseness" score={item.scores?.conciseness} />
                  </div>

                  {/* Prose Feedback - Left-aligned */}
                  <div>
                    <h5 className="font-semibold text-gray-300 mb-1">Feedback:</h5>
                    <p className="text-green-300 text-sm">{item.feedback}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Restart Button */}
            <button
              onClick={startInterview}
              className="w-full mt-10 py-3 bg-purple-600 hover:bg-purple-500 rounded-lg text-lg font-semibold transition-all transform hover:scale-105 active:scale-95 duration-200 shadow-md"
            >
              Start New Interview
            </button>
          </div>
        )}

        {/* Global Loading/Error Messages - Centered */}
        {loadingMessage && !error && <p className="text-center text-yellow-300 mt-4">{loadingMessage}</p>}
        {error && <p className="error-message text-red-400 font-medium mt-4 text-center">{error}</p>}

      </div>
    </div>
  );
}

export default App;