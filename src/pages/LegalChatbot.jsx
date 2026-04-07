import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import {
  MessageSquare,
  Send,
  Loader2,
  Bot,
  User,
  Mic,
  MicOff,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { apiFetch } from "../lib/api.js";

export default function LegalChatbot() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hello! I'm your Legal AI Assistant.\n\nAsk me anything about Indian law.",
    },
  ]);

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ---------------- Speech Recognition ---------------- */

  const startListening = () => {
    if (
      !("webkitSpeechRecognition" in window) &&
      !("SpeechRecognition" in window)
    ) {
      toast.error("Speech recognition not supported");
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognitionInstance = new SpeechRecognition();

    recognitionInstance.continuous = false;
    recognitionInstance.lang = "en-IN";

    recognitionInstance.onstart = () => setIsListening(true);
    recognitionInstance.onend = () => setIsListening(false);

    recognitionInstance.onresult = (event) => {
      setInput(event.results[0][0].transcript);
    };

    recognitionInstance.start();
    setRecognition(recognitionInstance);
  };

  const stopListening = () => {
    recognition?.stop();
    setIsListening(false);
  };

  const speakResponse = (text) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-IN";
      window.speechSynthesis.speak(utterance);
    }
  };

  /* ---------------- Backend Connection ---------------- */

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await apiFetch("/chat", {
        method: "POST",
        body: JSON.stringify({
          message: input,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Chat request failed");
      }

      const sourceFooter =
        Array.isArray(data.sources) && data.sources.length
          ? `\n\n---\n**Sources**\n${data.sources
              .slice(0, 4)
              .map((s) => `- [${s.ref}] ${s.title}`)
              .join("\n")}`
          : "";

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `${data.reply || ""}${sourceFooter}` },
      ]);
    } catch (error) {
      console.error(error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Something went wrong. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  /* ---------------- UI ---------------- */

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-5xl mx-auto px-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h1 className="text-4xl font-bold mb-6">Legal Chatbot</h1>
        </motion.div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Legal AI Assistant
            </CardTitle>
          </CardHeader>

          <CardContent className="p-0">
            {/* Messages */}
            <div className="h-[500px] overflow-y-auto p-6 space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex gap-3 ${
                    message.role === "user"
                      ? "justify-end"
                      : "justify-start"
                  }`}
                >
                  {message.role === "assistant" && (
                    <Bot className="w-6 h-6 text-blue-600" />
                  )}

                  <div
                    className={`rounded-xl px-4 py-3 max-w-[75%] ${
                      message.role === "user"
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100"
                    }`}
                  >
                    {message.role === "assistant" ? (
                      <ReactMarkdown>
                        {message.content}
                      </ReactMarkdown>
                    ) : (
                      message.content
                    )}
                  </div>

                  {message.role === "user" && (
                    <User className="w-6 h-6 text-slate-700" />
                  )}
                </div>
              ))}

              {isLoading && (
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-6 border-t flex gap-3">
              <Button
                onClick={isListening ? stopListening : startListening}
                variant="outline"
                size="icon"
              >
                {isListening ? (
                  <MicOff className="w-4 h-4" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
              </Button>

              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Ask a legal question..."
              />

              <Button
                onClick={sendMessage}
                disabled={isLoading || !input.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
