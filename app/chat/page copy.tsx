"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useElderlyAuth } from "../contexts/ElderlyAuthContext";
import ElderlyProtectedRoute from "../components/ElderlyProtectedRoute";
import Notification from "../components/Notification";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export default function ElderlyChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState("");
  
  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const [audioError, setAudioError] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const textBeforeRecordingRef = useRef<string>("");

  const { elderlyData, token, logout, refreshActivity, logoutWarning } =
    useElderlyAuth();
  const router = useRouter();
  // API base URL state (load from /url.json, fallback to env/local)
  const [apiUrl, setApiUrl] = useState<string>(() => {
    try {
      return process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
    } catch {
      return "";
    }
  });

  useEffect(() => {
    fetch("/url.json")
      .then((res) => res.json())
      .then((data) => {
        if (data.public_url) setApiUrl(data.public_url);
      })
      .catch((err) => {
        console.error("Failed to load API URL, using localhost:", err);
      });
  }, []);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const activityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);

    // Debounced activity refresh on typing
    if (activityTimeoutRef.current) {
      clearTimeout(activityTimeoutRef.current);
    }

    activityTimeoutRef.current = setTimeout(() => {
      refreshActivity();
    }, 1000); // Refresh after 1 second of typing pause
  };

  const handleScroll = () => {
    // Debounced activity refresh on scrolling
    if (activityTimeoutRef.current) {
      clearTimeout(activityTimeoutRef.current);
    }

    activityTimeoutRef.current = setTimeout(() => {
      refreshActivity();
    }, 1000); // Refresh after 1 second of scroll pause
  };

  const startRecording = async () => {
    try {
      setAudioError("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      // Store existing text
      textBeforeRecordingRef.current = inputText;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await sendAudioForTranscription(audioBlob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      setIsMicMuted(false);
    } catch (err) {
      console.error("Error starting recording:", err);
      setAudioError("Failed to access microphone");
      setIsMicMuted(true);
    }
  };
  
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsMicMuted(true);
    }
  };
  
  const sendAudioForTranscription = async (audioBlob: Blob) => {
    setIsProcessingAudio(true);
    setAudioError("");
    
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      
      const base =
        apiUrl ||
        process.env.NEXT_PUBLIC_API_BASE_URL ||
        "http://localhost:5000";
      
      const response = await fetch(`${base}/speech_to_text`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });
      
      const result = await response.json();
      
      if (result.success && result.text) {
        // Auto-send the transcribed text to chat
        const transcribedText = result.text;
        
        // Add user message to UI immediately
        const newUserMessage: Message = {
          role: "user",
          content: transcribedText,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, newUserMessage]);
        setIsLoading(true);
        
        try {
          const chatResponse = await fetch(`${base}/chat/elderly`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify({
              text: transcribedText,
              sessionId: sessionId,
            }),
          });

          const chatResult = await chatResponse.json();

          if (chatResult.success && chatResult.response) {
            // Add assistant response
            const assistantMessage: Message = {
              role: "assistant",
              content: chatResult.response,
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, assistantMessage]);

            // Update session ID if this was the first message
            if (!sessionId && chatResult.sessionId) {
              setSessionId(chatResult.sessionId);
            }
            
            // Handle token refresh if backend returned new token
            if (chatResult.token) {
              refreshActivity();
            }
          } else {
            setError(chatResult.message || "Failed to send message");
          }
        } catch (chatErr) {
          setError("Failed to send message. Please try again.");
          console.error("Send message error:", chatErr);
        } finally {
          setIsLoading(false);
        }
      } else {
        setAudioError("Failed to process audio");
      }
    } catch (err) {
      console.error("Transcription error:", err);
      setAudioError("Failed to process audio");
    } finally {
      setIsProcessingAudio(false);
      textBeforeRecordingRef.current = "";
    }
  };
  
  const handleMicToggle = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inputText.trim() || isLoading || !token || !elderlyData || isProcessingAudio) {
      return;
    }

    const userMessage = inputText.trim();
    setInputText("");
    setIsLoading(true);
    setError("");
    setAudioError("");

    // Add user message to UI immediately
    const newUserMessage: Message = {
      role: "user",
      content: userMessage,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newUserMessage]);

    try {
      const base =
        apiUrl ||
        process.env.NEXT_PUBLIC_API_BASE_URL ||
        "http://localhost:5000";
      const response = await fetch(`${base}/chat/elderly`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          text: userMessage,
          sessionId: sessionId,
        }),
      });

      const result = await response.json();

      if (result.success && result.response) {
        // Add assistant response
        const assistantMessage: Message = {
          role: "assistant",
          content: result.response,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);

        // Update session ID if this was the first message
        if (!sessionId && result.sessionId) {
          setSessionId(result.sessionId);
        }
        
        // Handle token refresh if backend returned new token
        if (result.token) {
          refreshActivity();
        }
      } else {
        setError(result.message || "Failed to send message");
      }
    } catch (err) {
      setError("Failed to send message. Please try again.");
      console.error("Send message error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  return (
    <ElderlyProtectedRoute>
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-purple-50 to-blue-50">
        {/* Navbar */}
        <div className="bg-white shadow-md px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold">
              {elderlyData?.preferred_name?.charAt(0).toUpperCase() || "U"}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-800">
                {elderlyData?.preferred_name || "User"}
              </h2>
              <p className="text-xs text-gray-500">Online</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors"
          >
            Logout
          </button>
        </div>

        {/* Logout Warning Notification */}
        {logoutWarning && (
          <div className="px-4 pt-3">
            <Notification message={logoutWarning} warning={true} />
          </div>
        )}

        {/* Audio Error Notification */}
        {audioError && (
          <div className="px-4 pt-3">
            <Notification message={audioError} warning={true} />
          </div>
        )}

        {/* Messages Container */}
        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-4 py-6 space-y-4"
        >
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 mt-20">
              <p className="text-lg mb-2">
                👋 Hi {elderlyData?.preferred_name}!
              </p>
              <p className="text-sm">
                Start a conversation by typing a message below
              </p>
            </div>
          ) : (
            messages.map((msg, index) => (
              <div
                key={index}
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                    msg.role === "user"
                      ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white"
                      : "bg-white text-gray-800 shadow-md"
                  }`}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {msg.content}
                  </p>
                </div>
              </div>
            ))
          )}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white rounded-2xl px-4 py-3 shadow-md">
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Responding</span>
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.1s" }}
                    ></div>
                    <div
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Error Display */}
        {error && (
          <div className="mx-4 mb-2 bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Input Area - matching ChatPanel styling (button inside the text box) */}
        <div className="bg-white border-t border-gray-200 px-3 py-2">
          <form onSubmit={handleSendMessage} className="flex items-center">
            <div className="flex items-center w-full bg-white border border-gray-300 rounded-full px-2 py-1">
              <button
                type="button"
                onClick={handleMicToggle}
                aria-pressed={!isMicMuted}
                title={isMicMuted ? "Start recording" : "Stop recording"}
                disabled={isLoading || isProcessingAudio}
                className="flex-shrink-0 mr-2 w-9 h-9 flex items-center justify-center bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed relative"
              >
                {isMicMuted ? (
                  isProcessingAudio ? (
                    <>
                      <Image
                        src="/micmute.svg"
                        alt="Processing"
                        width={16}
                        height={16}
                      />
                      {/* Yellow blinking indicator for processing */}
                      <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500"></span>
                      </span>
                    </>
                  ) : (
                    <Image
                      src="/micmute.svg"
                      alt="Muted microphone"
                      width={16}
                      height={16}
                    />
                  )
                ) : (
                  <>
                    <Image
                      src="/micunmute.svg"
                      alt="Recording"
                      width={16}
                      height={16}
                    />
                    {/* Red blinking indicator for recording */}
                    <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                    </span>
                  </>
                )}
              </button>

              <textarea
                value={inputText}
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
                placeholder="Type your message..."
                rows={1}
                className="flex-1 px-2 py-1 text-sm bg-transparent border-0 focus:outline-none focus:ring-0 placeholder-gray-700 text-gray-700 resize-none max-h-28"
                style={{ maxHeight: "96px" }}
                readOnly={isRecording || isProcessingAudio}
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !inputText.trim() || isProcessingAudio}
                className="flex-shrink-0 ml-2 w-10 h-10 flex items-center justify-center bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-full hover:from-purple-700 hover:to-blue-700 transition-transform transform disabled:opacity-50 disabled:cursor-not-allowed rotate-90"
                title="Send message"
              >
                {isLoading ? (
                  <svg
                    className="w-5 h-5 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                ) : (
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                    />
                  </svg>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ElderlyProtectedRoute>
  );
}
