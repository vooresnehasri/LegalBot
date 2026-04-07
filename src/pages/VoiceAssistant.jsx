import React, { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Mic, MicOff, Volume2, Loader2 } from "lucide-react";
import { apiFetch } from "../lib/api.js";

export default function VoiceAssistant() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const recognitionRef = useRef(null);

  /* ---------------- Speech Recognition ---------------- */

  const startListening = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech recognition not supported.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event) => {
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalText += event.results[i][0].transcript + " ";
        }
      }
      setTranscript((prev) => prev + finalText);
    };

    recognition.onend = () => setIsListening(false);

    recognition.start();
    recognitionRef.current = recognition;
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  /* ---------------- Backend Connection ---------------- */

  const askAI = async () => {
    if (!transcript.trim()) return;

    setIsLoading(true);
    setAiResponse("");

    try {
      const response = await apiFetch("/chat", {
        method: "POST",
        body: JSON.stringify({
          message: transcript,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Voice assistant request failed");
      }

      const sourceFooter =
        Array.isArray(data.sources) && data.sources.length
          ? `\n\nSources:\n${data.sources
              .slice(0, 3)
              .map((s) => `- [${s.ref}] ${s.title}`)
              .join("\n")}`
          : "";

      setAiResponse(`${data.reply || ""}${sourceFooter}`);

      // Auto speak response
      speak(data.reply);
    } catch (error) {
      console.error(error);
      alert("Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  };

  /* ---------------- Text To Speech ---------------- */

  const speak = (text) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-IN";
    window.speechSynthesis.speak(utterance);
  };

  /* ---------------- UI ---------------- */

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-4xl mx-auto px-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h1 className="text-4xl font-bold mb-2">Voice Assistant</h1>
          <p className="text-slate-600 mb-8">
            Speak your legal question and get AI response
          </p>
        </motion.div>

        <div className="bg-white rounded-xl shadow p-8 mb-6">

          {/* Mic Button */}
          <div className="flex justify-center mb-6">
            <button
              onClick={isListening ? stopListening : startListening}
              className={`w-32 h-32 rounded-full flex items-center justify-center text-white ${
                isListening ? "bg-red-500" : "bg-blue-500"
              }`}
            >
              {isListening ? (
                <MicOff className="w-12 h-12" />
              ) : (
                <Mic className="w-12 h-12" />
              )}
            </button>
          </div>

          <p className="text-center mb-4 font-medium">
            {isListening
              ? "Listening... Click to stop"
              : "Click microphone to start speaking"}
          </p>

          {/* Transcript */}
          <textarea
            rows={6}
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Your speech will appear here..."
            className="w-full border rounded-lg px-4 py-3 mb-4"
          />

          <button
            onClick={askAI}
            disabled={!transcript || isLoading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg mb-4"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                Processing...
              </>
            ) : (
              "Get Legal Answer"
            )}
          </button>

          {/* AI Response */}
          {aiResponse && (
            <div className="border rounded-lg p-4 bg-slate-50">
              <h3 className="font-semibold mb-2">AI Response:</h3>
              <p className="whitespace-pre-wrap">{aiResponse}</p>

              <button
                onClick={() => speak(aiResponse)}
                className="mt-3 flex items-center gap-2 text-blue-600"
              >
                <Volume2 className="w-4 h-4" />
                Read Aloud
              </button>
            </div>
          )}

          <div className="flex gap-4 mt-4">
            <button
              onClick={() => setTranscript("")}
              className="flex-1 border py-3 rounded-lg"
            >
              Clear
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
