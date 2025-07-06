import React, { useState, useRef, useEffect, useCallback } from 'react';
import './index.css';
import { FiMic, FiMicOff, FiSend, FiVolume2, FiVolumeX } from 'react-icons/fi';

function App() {
  const [messages, setMessages] = useState([
    { text: 'Hello! How can I assist you today?', sender: 'bot' }
  ]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isTtsEnabled, setIsTtsEnabled] = useState(true);
  const [error, setError] = useState(null);

  const chatMessagesRef = useRef(null);
  const recognitionRef = useRef(null);
  const synthesisRef = useRef(null);
  const utteranceRef = useRef(null);

  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window) {
      recognitionRef.current = new window.webkitSpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setUserInput(transcript);
        stopListening();
      };

      recognitionRef.current.onerror = (event) => {
        setError(`Speech recognition error: ${event.error}. Please try again.`);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  useEffect(() => {
    synthesisRef.current = window.speechSynthesis;
    utteranceRef.current = new SpeechSynthesisUtterance();

    utteranceRef.current.onend = () => {
      setIsSpeaking(false);
    };
    utteranceRef.current.onerror = () => {
      setIsSpeaking(false);
    };

    return () => {
      if (synthesisRef.current && synthesisRef.current.speaking) {
        synthesisRef.current.cancel();
      }
    };
  }, []);

  const speakText = useCallback((text) => {
    if (!isTtsEnabled || !synthesisRef.current || !text) return;
    if (synthesisRef.current.speaking) {
      synthesisRef.current.cancel();
    }
    utteranceRef.current.text = text;
    utteranceRef.current.lang = 'en-US';
    try {
      synthesisRef.current.speak(utteranceRef.current);
      setIsSpeaking(true);
    } catch (e) {
      setError("Could not play audio. Browser restrictions or error.");
      setIsSpeaking(false);
    }
  }, [isTtsEnabled]);

  const stopSpeech = () => {
    if (synthesisRef.current && synthesisRef.current.speaking) {
      synthesisRef.current.cancel();
      setIsSpeaking(false);
    }
  };

  const toggleListening = () => {
    if (!recognitionRef.current) {
      setError("Speech recognition is not supported by your browser.");
      return;
    }
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const startListening = () => {
    setError(null);
    setIsListening(true);
    recognitionRef.current.start();
    setUserInput('Listening...');
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  const sendMessage = async (messageToSend = userInput) => {
    const trimmedInput = messageToSend.trim();
    if (trimmedInput === '' || isLoading) return;
    stopSpeech();
    setMessages((prevMessages) => [...prevMessages, { text: trimmedInput, sender: 'user' }]);
    setUserInput('');
    setError(null);
    setIsLoading(true);
    try {
      const response = await fetch('/.netlify/functions/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: trimmedInput }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Status: ${response.status}, Details: ${errorData.message || response.statusText}`);
      }
      const data = await response.json();
      setMessages((prevMessages) => [...prevMessages, { text: data.reply, sender: 'bot' }]);
      speakText(data.reply);
    } catch (err) {
      setMessages((prevMessages) => [...prevMessages, { text: `Oops! An error occurred: ${err.message}`, sender: 'bot' }]);
      speakText("I encountered an error. Please try again.");
      setError(`Failed to get response from AI. Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !isLoading) {
      sendMessage();
    }
  };

  const MessageContent = ({ text }) => {
    return <p dangerouslySetInnerHTML={{ __html: text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>') }} />;
  };

  return (
    <div className="chatbot-container">
      <div className="chat-header">
        <h3>AI Chatbot Demo</h3>
        <div className="settings-icons">
          <button 
            className="control-button" 
            onClick={() => setIsTtsEnabled(!isTtsEnabled)}
            title={isTtsEnabled ? "Disable Text-to-Speech" : "Enable Text-to-Speech"}
          >
            {isTtsEnabled ? <FiVolume2 /> : <FiVolumeX />}
          </button>
          {isSpeaking && (
             <button 
              className="control-button stop-speech-button" 
              onClick={stopSpeech}
              title="Stop Speaking"
            >
              Stop
            </button>
          )}
        </div>
      </div>

      <div className="chat-messages" ref={chatMessagesRef}>
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.sender}-message`}>
            {msg.sender === 'bot' && <div className="avatar">AI</div>}
            <MessageContent text={msg.text} />
            {msg.sender === 'user' && <div className="avatar">You</div>}
          </div>
        ))}
        {isLoading && (
          <div className="message bot-message loading-message">
            <div className="avatar">AI</div>
            <p>Typing</p>
          </div>
        )}
         {error && (
          <div className="message bot-message error-message">
            <p style={{color: 'red', fontSize: '0.85em'}}>Error: {error}</p>
          </div>
        )}
      </div>

      <div className="chat-input-area">
        {'webkitSpeechRecognition' in window && (
          <button 
            className={`mic-button ${isListening ? 'listening' : ''}`} 
            onClick={toggleListening}
            disabled={isLoading}
            title={isListening ? "Stop Listening" : "Start Voice Input"}
          >
            {isListening ? <FiMicOff /> : <FiMic />}
          </button>
        )}
        
        <input
          id="user-input"
          type="text"
          value={isListening ? "Listening..." : userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type your message or use microphone..."
          disabled={isLoading || isListening}
          autoFocus
        />
        <button id="send-button" onClick={() => sendMessage()} disabled={isLoading || isListening}>
          <FiSend /> Send
        </button>
      </div>
    </div>
  );
}

export default App;
