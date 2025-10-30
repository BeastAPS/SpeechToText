import React, { useState, useEffect } from 'react';
import 'regenerator-runtime/runtime'; // Keep polyfill
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';

// --- Helper component for rendering score bars ---
const ScoreBar = ({ label, score }) => {
  const width = score ? (score / 5) * 100 : 0;
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
  const [error, setError] = useState('');
  const [loadingMessage, setLoadingMessage] = useState('');

  const [allQuestions, setAllQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(-1);
  const [interviewData, setInterviewData] = useState([]);
  const [isInterviewComplete, setIsInterviewComplete] = useState(false);
  
  const [isLoadingNext, setIsLoadingNext] = useState(false); 
  const [isPrefetching, setIsPrefetching] = useState(true);

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

  const fetchQuestions = async (isRetry = false) => {
    if (isRetry) {
      setError('');
      setLoadingMessage("Fetching interview questions...");
      setIsLoadingNext(true);
    }
    
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
      setError('');
      return true;
    } catch (err) {
      setError(err.message || "Failed to fetch questions");
      return false;
    } finally {
      if (isRetry) {
        setLoadingMessage('');
        setIsLoadingNext(false);
      }
    }
  };

  useEffect(() => {
    (async () => {
      setIsPrefetching(true);
      await fetchQuestions(false);
      setIsPrefetching(false);
    })();
  }, []);

  const startInterview = async () => {
    setIsInterviewComplete(false);
    setCurrentQuestionIndex(-1);
    setInterviewData([]);
    resetTranscript();

    if (isPrefetching) {
      setError("Please wait while the questions are loaded");
      return;
    }

    // This block handles your request:
    // If questions ARE loaded, it starts the interview.
    if (allQuestions.length > 0) {
      setError('');
      setCurrentQuestionIndex(0);
    } else {
      // This block handles retries if the pre-fetch failed.
      const success = await fetchQuestions(true);
      if (success) {
        setCurrentQuestionIndex(0);
      }
    }
  };

  const startListening = () => {
    setError('');
    resetTranscript();
    SpeechRecognition.startListening({ continuous: true });
  };

  const stopListening = () => {
    SpeechRecognition.stopListening();
  };

  const submitAnswerAndGoNext = async () => {
    if (!currentQuestion || !transcript) {
      setError("Please record an answer before proceeding.");
      return;
    }

    const questionToSubmit = currentQuestion;
    const answerToSubmit = transcript;
    const indexToSubmit = currentQuestionIndex;

    const getFeedbackInBackground = async () => {
      try {
        // *** REMEMBER TO UPDATE THIS URL WHEN DEPLOYING ***
        const response = await fetch('http://127.0.0.1:5000/get_feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: questionToSubmit,
            answer: answerToSubmit
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();

        setInterviewData(prevData => [
          ...prevData,
          {
            question: questionToSubmit,
            answer: answerToSubmit,
            feedback: data.prose_feedback || "No feedback text.",
            scores: data.scores || {},
            index: indexToSubmit
          }
        ]);

      } catch (err) {
        console.error(`Failed to get feedback for Q${indexToSubmit + 1}:`, err);
        setInterviewData(prevData => [
          ...prevData,
          {
            question: questionToSubmit,
            answer: answerToSubmit,
            feedback: `Error analyzing answer: ${err.message}`,
            scores: {},
            index: indexToSubmit,
            isError: true
          }
        ]);
      }
    };

    getFeedbackInBackground();

    setError('');
    setLoadingMessage('');

    if (currentQuestionIndex < allQuestions.length - 1) {
      setCurrentQuestionIndex(prevIndex => prevIndex + 1);
      resetTranscript();
    } else {
      setIsInterviewComplete(true);
      resetTranscript();
    }
  };

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

  const calculateOverallScore = () => {
    let totalScore = 0;
    let scoreCount = 0;
    interviewData.forEach(item => {
      if (item.scores) {
        Object.values(item.scores).forEach(score => {
          if (typeof score === 'number' && score >= 1 && score <= 5) {
             totalScore += score;
             scoreCount++;
          }
        });
      }
    });
    return scoreCount > 0 ? (totalScore / scoreCount).toFixed(1) : 'N/A';
  };

  const isReportReady = interviewData.length === allQuestions.length && allQuestions.length > 0;

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-900 to-blue-900 text-white flex flex-col items-center pt-20 p-4">
      <header className="text-center mb-8">
        <h1 className="text-4xl font-bold text-cyan-300" >Mock AI Interview</h1>
      </header>

      <div className="w-full max-w-2xl bg-gray-800 bg-opacity-90 backdrop-blur-sm p-6 sm:p-8 rounded-2xl shadow-2xl border border-gray-700">

        {currentQuestionIndex === -1 && !isInterviewComplete && (
          <button
            onClick={startInterview}
            disabled={isLoadingNext}
            className="w-full mb-4 py-3 bg-purple-600 hover:bg-purple-500 rounded-lg text-lg font-semibold transition-all transform hover:scale-105 active:scale-95 duration-200 disabled:opacity-50"
          >
            {loadingMessage || 'Begin Interview'}
          </button>
        )}

        {!isInterviewComplete && currentQuestion && (
          <div className="mb-6">
            <h2 className="text-xl font-bold text-cyan-300 mb-4">
              Question {currentQuestionIndex + 1} of {allQuestions.length}:
            </h2>
            <p className="text-gray-100 text-lg bg-gray-900 bg-opacity-50 p-6 rounded-lg border border-gray-600">
              {currentQuestion}
            </p>

            <div className="mt-8 flex flex-col items-center">
              <button
                onClick={listening ? stopListening : startListening}
                className={`w-full sm:w-1/2 py-3 rounded-lg text-lg font-semibold transition-all transform hover:scale-105 active:scale-95 duration-200 mb-4 ${
                  listening
                    ? 'bg-red-600 hover:bg-red-500'
                    : 'bg-green-500 hover:bg-green-400'
                  }`}
              >
                {listening ? '🛑 Stop Recording' : '🎙️ Record Answer'}
              </button>

              {listening && <p className="text-yellow-300 animate-pulse mb-2">Listening...</p>}

              {transcript && (
                  <div className="w-full mt-2 p-4 border border-gray-600 bg-gray-700 rounded-lg">
                      <h3 className="text-md font-semibold text-yellow-300 mb-2">Your Answer (Live):</h3>
                      <p className="text-gray-200 italic">{transcript}</p>
                  </div>
              )}

              {!listening && transcript && (
                <button
                  onClick={submitAnswerAndGoNext}
                  className="w-full sm:w-1/2 mt-4 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg text-lg font-semibold transition-all transform hover:scale-105 active:scale-95 duration-200"
                >
                  {currentQuestionIndex === allQuestions.length - 1 ? 'Finish Interview' : 'Next Question ➡️'}
                </button>
              )}
            </div>
          </div>
        )}

        {isInterviewComplete && (
          <div>
            <h2 className="text-3xl font-bold text-green-400 mb-6 text-center">Interview Complete!</h2>

            {isReportReady && (
              <div className="text-center bg-gray-900 bg-opacity-70 p-6 rounded-xl mb-8 border border-gray-700 shadow-lg">
                <h3 className="text-lg font-semibold text-gray-300 uppercase tracking-wider mb-2">Overall Performance</h3>
                <p className="text-6xl font-bold text-cyan-300 my-1">{calculateOverallScore()}</p>
                <p className="text-gray-400">Average Score (out of 5.0)</p>
              </div>
            )}

            <h3 className="text-2xl font-semibold text-gray-100 mb-5 text-center">Detailed Report</h3>

            {!isReportReady ? (
              <p className="text-center text-yellow-300 animate-pulse py-8">
                Generating your report... ({interviewData.length} / {allQuestions.length} answers analyzed)
              </p>
            ) : (
              <div className="space-y-6">
                {interviewData
                  .sort((a, b) => a.index - b.index)
                  .map((item) => (
                  <div key={item.index} className="p-5 border border-gray-700 rounded-lg bg-gray-700 bg-opacity-40 shadow-md">
                    <h4 className="text-lg font-semibold text-cyan-300 mb-3">
                      <span className="text-gray-400 font-normal">Q{item.index + 1}:</span> {item.question}
                    </h4>

                    <p className="text-gray-200 mb-4 pl-4 border-l-4 border-gray-500 italic">
                      "{item.answer || 'No answer recorded'}"
                    </p>

                    <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-b border-gray-600 py-4">
                      <ScoreBar label="Relevance" score={item.scores?.relevance} />
                      <ScoreBar label="Clarity" score={item.scores?.clarity} />
                      <ScoreBar label="Conciseness" score={item.scores?.conciseness} />
                    </div>

                    <div>
                      <h5 className="font-semibold text-gray-300 mb-1">Feedback:</h5>
                      <p className={item.isError ? "text-red-400 text-sm" : "text-green-300 text-sm"}>
                        {item.feedback}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={startInterview}
              disabled={isLoadingNext}
              className="w-full mt-10 py-3 bg-purple-600 hover:bg-purple-500 rounded-lg text-lg font-semibold transition-all transform hover:scale-105 active:scale-95 duration-200 shadow-md disabled:opacity-50"
            >
              Start New Interview
            </button>
          </div>
        )}

        {loadingMessage && !error && <p className="text-center text-yellow-300 mt-4">{loadingMessage}</p>}
        {error && <p className="error-message text-red-400 font-medium mt-4 text-center">{error}</p>}

      </div>
    </div>
  );
}

export default App;
