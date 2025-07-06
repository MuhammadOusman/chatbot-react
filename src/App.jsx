// src/App.jsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import './index.css'; // Your main CSS file

// For react-icons: npm install react-icons
import { FiMic, FiMicOff, FiSend, FiVolume2, FiVolumeX } from 'react-icons/fi';
// Make sure to add these to package.json and install them. If not using react-icons, you can just use text.

function App() {
    const [messages, setMessages] = useState([
        { text: 'Hello! How can I assist you today?', sender: 'bot' }
    ]);
    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isListening, setIsListening] = useState(false); // For Speech Recognition
    const [isSpeaking, setIsSpeaking] = useState(false); // For Text-to-Speech playback
    const [isTtsEnabled, setIsTtsEnabled] = useState(true); // Toggle for TTS
    const [error, setError] = useState(null); // For displaying API errors
    
    const chatMessagesRef = useRef(null);
    const recognitionRef = useRef(null); // Reference for SpeechRecognition instance
    const synthesisRef = useRef(null); // Reference for SpeechSynthesis
    const utteranceRef = useRef(null); // Reference for current speech utterance

    // Auto-scroll to the bottom of the chat messages
    useEffect(() => {
        if (chatMessagesRef.current) {
            chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
        }
    }, [messages, isLoading]); // Scroll on message changes or loading status

    // Initialize Speech Recognition
    useEffect(() => {
        if ('webkitSpeechRecognition' in window) {
            recognitionRef.current = new window.webkitSpeechRecognition();
            recognitionRef.current.continuous = false; // Capture one utterance at a time
            recognitionRef.current.interimResults = false; // Only final results
            recognitionRef.current.lang = 'en-US'; // Or 'ur-PK' for Urdu

            recognitionRef.current.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                setUserInput(transcript); // Set transcribed text to input
                stopListening(); // Stop listening after result
                // Optionally auto-send if the transcription is complete and valid
                // sendMessage(transcript); // Don't auto-send, let user confirm or edit
            };

            recognitionRef.current.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                setError(`Speech recognition error: ${event.error}. Please try again.`);
                setIsListening(false);
            };

            recognitionRef.current.onend = () => {
                setIsListening(false); // Make sure button state updates
            };
        } else {
            console.warn('Web Speech API not supported in this browser.');
            // Maybe disable mic button or show a message
        }
    }, []);

    // Text-to-Speech functionality
    useEffect(() => {
        synthesisRef.current = window.speechSynthesis;
        utteranceRef.current = new SpeechSynthesisUtterance();

        // Listen for when speech ends
        utteranceRef.current.onend = () => {
            setIsSpeaking(false);
        };
        // Listen for speech errors
        utteranceRef.current.onerror = (event) => {
            console.error('Text-to-Speech error:', event.error);
            setIsSpeaking(false);
        };

        // Cleanup function for speech synthesis
        return () => {
            if (synthesisRef.current && synthesisRef.current.speaking) {
                synthesisRef.current.cancel();
            }
        };
    }, []);


    // Function to speak a given text
    const speakText = useCallback((text) => {
        if (!isTtsEnabled || !synthesisRef.current || !text) return;

        // If already speaking, stop current speech before new one
        if (synthesisRef.current.speaking) {
            synthesisRef.current.cancel();
        }

        utteranceRef.current.text = text;
        utteranceRef.current.lang = 'en-US'; // Adjust language if needed

        try {
            synthesisRef.current.speak(utteranceRef.current);
            setIsSpeaking(true);
        } catch (e) {
            console.error("Error attempting to speak:", e);
            setError("Could not play audio. Browser restrictions or error.");
            setIsSpeaking(false);
        }
    }, [isTtsEnabled]);

    // Function to stop current speech
    const stopSpeech = () => {
        if (synthesisRef.current && synthesisRef.current.speaking) {
            synthesisRef.current.cancel();
            setIsSpeaking(false);
        }
    };


    // Toggle for Speech-to-Text
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
        setError(null); // Clear previous errors
        setIsListening(true);
        recognitionRef.current.start();
        setUserInput('Listening...'); // Visual feedback
    };

    const stopListening = () => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
        setIsListening(false);
    };


    // Main Send Message Function
    const sendMessage = async (messageToSend = userInput) => {
        const trimmedInput = messageToSend.trim();
        if (trimmedInput === '' || isLoading) return;

        stopSpeech(); // Stop any ongoing speech when user sends a new message

        setMessages((prevMessages) => [...prevMessages, { text: trimmedInput, sender: 'user' }]);
        setUserInput(''); // Clear input after sending
        setError(null); // Clear any previous API errors

        setIsLoading(true); // Show loading indicator

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
            
            speakText(data.reply); // Speak the bot's reply

        } catch (err) {
            console.error('Error sending message:', err);
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

    // Component to render messages with Markdown support (simplified)
    const MessageContent = ({ text }) => {
        // A very basic markdown rendering. For production, use a library like 'marked' or 'react-markdown'.
        const formattedText = text.split('\n').map((line, idx) => (
            line.startsWith('* ') || line.startsWith('- ') ? <li key={idx}>{line.substring(2)}</li> : <p key={idx}>{line}</p>
        ));
        
        // This is a super simplified Markdown. For proper rendering, integrate:
        // import ReactMarkdown from 'react-markdown';
        // return <ReactMarkdown>{text}</ReactMarkdown>;
        // After: npm install react-markdown

        // For now, let's just render paragraphs. Remove this and install react-markdown for actual use.
        // For simple demos, direct <p> might be fine.
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
                        <MessageContent text={msg.text} /> {/* Using Markdown renderer */}
                        {msg.sender === 'user' && <div className="avatar">You</div>}
                    </div>
                ))}
                {isLoading && (
                    <div className="message bot-message loading-message">
                        <div className="avatar">AI</div>
                        <p>Typing</p> {/* CSS will add ellipsis */}
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
                    value={isListening ? "Listening..." : userInput} // Display listening state
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type your message or use microphone..."
                    disabled={isLoading || isListening} // Disable while loading or listening
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