import { useState, useRef, useEffect, useMemo } from "react";
import { azureAvailable, AZURE_VOICES, fetchAzureAudio, getSpeechPrefs } from "@/hooks/use-speech";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Send, Bot, User, Loader2, Sparkles, BookOpen, MessageSquare, Eraser, CheckCircle2, XCircle, RefreshCw, RotateCcw, Copy, Volume2, Square, Check, Paperclip, FileText, Image, X, File } from "lucide-react";
import { useFileUpload } from "@/hooks/use-file-upload";

function formatMarkdown(text: string): JSX.Element {
  const lines = text.split('\n');
  const elements: JSX.Element[] = [];

  lines.forEach((line, lineIndex) => {
    if (!line.trim()) {
      elements.push(<div key={lineIndex} className="h-2" />);
      return;
    }

    const isBullet = line.trim().startsWith('•') || line.trim().startsWith('-') || line.trim().startsWith('*');
    const bulletContent = isBullet ? line.replace(/^[\s]*[•\-\*][\s]*/, '') : line;

    const processText = (inputText: string): JSX.Element[] => {
      const result: JSX.Element[] = [];
      const regex = /(\*\*\[[^\]]+\]\([^)]+\)\*\*|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
      let lastIndex = 0;
      let match;
      let partIndex = 0;

      while ((match = regex.exec(inputText)) !== null) {
        if (match.index > lastIndex) {
          result.push(<span key={partIndex++}>{inputText.slice(lastIndex, match.index)}</span>);
        }

        const matchText = match[0];
        const boldLinkMatch = matchText.match(/\*\*\[([^\]]+)\]\(([^)]+)\)\*\*/);
        if (boldLinkMatch) {
          const [, linkText, linkPath] = boldLinkMatch;
          result.push(
            <Link key={partIndex++} href={linkPath}>
              <span className="font-semibold text-primary hover:underline cursor-pointer">{linkText}</span>
            </Link>
          );
        } else if (matchText.startsWith('[')) {
          const linkMatch = matchText.match(/\[([^\]]+)\]\(([^)]+)\)/);
          if (linkMatch) {
            const [, linkText, linkPath] = linkMatch;
            result.push(
              <Link key={partIndex++} href={linkPath}>
                <span className="text-primary hover:underline cursor-pointer">{linkText}</span>
              </Link>
            );
          }
        } else if (matchText.startsWith('**') && matchText.endsWith('**')) {
          result.push(<strong key={partIndex++} className="font-semibold">{matchText.slice(2, -2)}</strong>);
        }
        lastIndex = regex.lastIndex;
      }

      if (lastIndex < inputText.length) {
        result.push(<span key={partIndex++}>{inputText.slice(lastIndex)}</span>);
      }
      return result;
    };

    const formattedParts = processText(isBullet ? bulletContent : line);

    if (isBullet) {
      elements.push(
        <div key={lineIndex} className="flex gap-2 items-start ml-1">
          <span className="text-primary font-bold">•</span>
          <span>{formattedParts}</span>
        </div>
      );
    } else {
      elements.push(<div key={lineIndex}>{formattedParts}</div>);
    }
  });

  return <div className="space-y-1">{elements}</div>;
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*\[([^\]]+)\]\([^)]+\)\*\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/[•\-\*]\s*/g, '')
    .replace(/\n+/g, ' ')
    .trim();
}
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
}

interface GrammarSuggestion {
  original: string;
  suggested: string;
  type: string;
  explanation: string;
}

const suggestionPrompts = [
  "How can I improve my thesis statement?",
  "Suggest a better introduction for my paper",
  "Help me structure my methodology section",
  "What are common mistakes in academic writing?",
  "How do I properly cite sources in APA format?",
  "Review this paragraph for clarity",
];

const CHAT_STORAGE_KEY = "papergen-ai-chat-messages";

// Load messages from localStorage
const loadStoredMessages = (): Message[] => {
  try {
    const stored = localStorage.getItem(CHAT_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Convert date strings back to Date objects
      return parsed.map((msg: any) => ({
        ...msg,
        createdAt: new Date(msg.createdAt)
      }));
    }
  } catch (e) {
    console.error("Failed to load chat messages:", e);
  }
  return [];
};

export default function AiAssistant() {
  const [activeTab, setActiveTab] = useState("chat");
  const [message, setMessage] = useState("");
  const [textToCheck, setTextToCheck] = useState("");
  const [originalText, setOriginalText] = useState("");
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>(loadStoredMessages);
  const [grammarSuggestions, setGrammarSuggestions] = useState<GrammarSuggestion[]>([]);
  const [speakingId, setSpeakingId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const userId = "demo-user";

  // File upload hook for chat attachments
  const { uploadedFiles, isProcessing: isProcessingFiles, extractedText, handleFileUpload, removeFile, clearAll } = useFileUpload();

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      try {
        localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
      } catch (e) {
        console.error("Failed to save chat messages:", e);
      }
    }
  }, [messages]);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Cleanup TTS on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    };
  }, []);

  const handleCopyMessage = async (text: string, messageId: number) => {
    const plainText = stripMarkdown(text);
    try {
      await navigator.clipboard.writeText(plainText);
      setCopiedId(messageId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const handleSpeak = async (text: string, messageId: number) => {
    // Stop if already speaking this message
    if (speakingId === messageId) {
      window.speechSynthesis?.cancel();
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      setSpeakingId(null);
      return;
    }
    // Stop any previous speech
    window.speechSynthesis?.cancel();
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }

    const plainText = stripMarkdown(text);
    setSpeakingId(messageId);

    // Try Azure TTS first
    if (azureAvailable) {
      try {
        const voice = getSpeechPrefs().voiceName || AZURE_VOICES[0]?.name || "en-US-JennyNeural";
        const blob = await fetchAzureAudio(plainText, voice, 1);
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => { URL.revokeObjectURL(url); setSpeakingId(null); audioRef.current = null; };
        audio.onerror = () => { URL.revokeObjectURL(url); setSpeakingId(null); audioRef.current = null; };
        await audio.play();
        return;
      } catch {
        // fall through to browser TTS
      }
    }

    // Browser TTS fallback
    const utterance = new SpeechSynthesisUtterance(plainText);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);
    window.speechSynthesis.speak(utterance);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  interface SessionResponse {
    session: { id: number };
  }

  interface ChatResponse {
    response: string;
  }

  interface GrammarResponse {
    suggestions: GrammarSuggestion[];
  }

  const createSessionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/ai/session", { userId, sessionType: "writing_assistant" });
      return response as unknown as SessionResponse;
    },
    onSuccess: (data) => {
      setSessionId(data.session.id);
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      console.log("[AI Assistant] Sending message:", content.substring(0, 50) + "...");
      // Send directly without requiring session - more resilient to database issues
      const chatResponse = await apiRequest("POST", "/api/ai/chat", { 
        sessionId: sessionId || undefined, 
        message: content 
      });
      console.log("[AI Assistant] Received response");
      return chatResponse as unknown as ChatResponse;
    },
    onSuccess: (data) => {
      setMessages(prev => [
        ...prev,
        { id: Date.now(), role: "assistant", content: data.response, createdAt: new Date() }
      ]);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive",
      });
    },
  });

  const grammarCheckMutation = useMutation({
    mutationFn: async (text: string) => {
      const response = await apiRequest("POST", "/api/ai/grammar", { userId, text });
      return response as unknown as GrammarResponse;
    },
    onSuccess: (data) => {
      setGrammarSuggestions(data.suggestions || []);
      if (data.suggestions?.length === 0) {
        toast({
          title: "No Issues Found",
          description: "Your text looks good!",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to check grammar",
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = () => {
    if (!message.trim() && !extractedText) return;

    // Build the full message including any attached file content
    let fullMessage = message.trim();
    if (extractedText) {
      fullMessage = fullMessage
        ? `${fullMessage}\n\n[Attached file content]:\n${extractedText}`
        : `[Attached file content]:\n${extractedText}`;
    }

    // Display message with file info if any
    const displayMessage = uploadedFiles.length > 0
      ? `${message.trim() || "Analyze this file"}\n\n📎 ${uploadedFiles.map(f => f.name).join(", ")}`
      : message.trim();

    setMessages(prev => [
      ...prev,
      { id: Date.now(), role: "user", content: displayMessage, createdAt: new Date() }
    ]);
    sendMessageMutation.mutate(fullMessage);
    setMessage("");
    clearAll(); // Clear attached files after sending
  };

  const handlePromptClick = (prompt: string) => {
    setMessage(prompt);
  };

  const handleGrammarCheck = () => {
    if (!textToCheck.trim()) {
      toast({
        title: "No Text",
        description: "Please enter some text to check",
        variant: "destructive",
      });
      return;
    }
    // Save original text before checking
    setOriginalText(textToCheck);
    grammarCheckMutation.mutate(textToCheck);
  };

  const applySuggestion = (suggestion: GrammarSuggestion) => {
    if (suggestion.original && suggestion.suggested) {
      setTextToCheck(textToCheck.replace(suggestion.original, suggestion.suggested));
      setGrammarSuggestions(prev => prev.filter(s => s.original !== suggestion.original));
      toast({
        title: "Suggestion Applied",
        description: "The correction has been applied to your text",
      });
    }
  };

  const applyAllSuggestions = () => {
    let updatedText = textToCheck;
    let appliedCount = 0;

    grammarSuggestions.forEach(suggestion => {
      if (suggestion.original && suggestion.suggested) {
        updatedText = updatedText.replace(suggestion.original, suggestion.suggested);
        appliedCount++;
      }
    });

    setTextToCheck(updatedText);
    setGrammarSuggestions([]);

    toast({
      title: "All Suggestions Applied",
      description: `${appliedCount} correction(s) have been applied to your text`,
    });
  };

  const resetToOriginal = () => {
    if (originalText) {
      setTextToCheck(originalText);
      setGrammarSuggestions([]);
      toast({
        title: "Text Reset",
        description: "Text has been reset to the original version",
      });
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: `${label} text copied to clipboard`,
      });
    } catch (err) {
      toast({
        title: "Copy Failed",
        description: "Unable to copy text to clipboard",
        variant: "destructive",
      });
    }
  };

  const hasChanges = originalText && originalText !== textToCheck;
  const wordCount = textToCheck.trim() ? textToCheck.trim().split(/\s+/).length : 0;
  const charCount = textToCheck.length;

  const clearChat = () => {
    setMessages([]);
    setSessionId(null);
    localStorage.removeItem(CHAT_STORAGE_KEY);
    toast({
      title: "Chat Cleared",
      description: "Starting a fresh conversation",
    });
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl" data-testid="page-ai-assistant">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">AI Writing Assistant</h1>
        <p className="text-muted-foreground">
          Get help with your academic writing, check grammar, and improve your documents
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="chat" data-testid="tab-chat">
            <MessageSquare className="w-4 h-4 mr-2" />
            Writing Assistant
          </TabsTrigger>
          <TabsTrigger value="grammar" data-testid="tab-grammar">
            <Sparkles className="w-4 h-4 mr-2" />
            Grammar Check
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chat">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <Card className="lg:col-span-3">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Bot className="w-5 h-5 text-primary" />
                    Chat with AI
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={clearChat}>
                    <Eraser className="w-4 h-4 mr-2" />
                    Clear
                  </Button>
                </div>
              </CardHeader>
              <Separator />
              <CardContent className="p-0">
                <ScrollArea className="h-[400px] p-4">
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <Bot className="w-16 h-16 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Start a Conversation</h3>
                      <p className="text-muted-foreground mb-4 max-w-md">
                        Ask me anything about academic writing, citations, structure, or get feedback on your work.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
                        >
                          {msg.role === "assistant" && (
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <Bot className="w-4 h-4 text-primary" />
                            </div>
                          )}
                          <div className="flex flex-col max-w-[80%]">
                            <div
                              className={`rounded-lg px-4 py-3 ${
                                msg.role === "user"
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted"
                              }`}
                            >
                              {msg.role === "assistant" ? (
                                <div className="text-sm">{formatMarkdown(msg.content)}</div>
                              ) : (
                                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                              )}
                            </div>
                            {msg.role === "assistant" && (
                              <div className="flex gap-1 mt-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                  onClick={() => handleCopyMessage(msg.content, msg.id)}
                                  title="Copy"
                                >
                                  {copiedId === msg.id ? (
                                    <Check className="h-3.5 w-3.5 text-green-500" />
                                  ) : (
                                    <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                                  )}
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                  onClick={() => handleSpeak(msg.content, msg.id)}
                                  title={speakingId === msg.id ? "Stop" : "Read aloud"}
                                >
                                  {speakingId === msg.id ? (
                                    <Square className="h-3.5 w-3.5 text-primary" />
                                  ) : (
                                    <Volume2 className="h-3.5 w-3.5 text-muted-foreground" />
                                  )}
                                </Button>
                              </div>
                            )}
                          </div>
                          {msg.role === "user" && (
                            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                              <User className="w-4 h-4" />
                            </div>
                          )}
                        </div>
                      ))}
                      {sendMessageMutation.isPending && (
                        <div className="flex gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <Bot className="w-4 h-4 text-primary" />
                          </div>
                          <div className="rounded-lg px-4 py-2 bg-muted">
                            <Loader2 className="w-4 h-4 animate-spin" />
                          </div>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </ScrollArea>
                <Separator />
                <div className="p-4 space-y-3">
                  {/* Attached Files Preview */}
                  {uploadedFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {uploadedFiles.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 bg-muted px-3 py-1.5 rounded-full text-sm"
                        >
                          {file.type.startsWith("image/") ? (
                            <Image className="w-3.5 h-3.5 text-blue-500" />
                          ) : file.type.includes("pdf") ? (
                            <FileText className="w-3.5 h-3.5 text-red-500" />
                          ) : (
                            <File className="w-3.5 h-3.5 text-gray-500" />
                          )}
                          <span className="max-w-[150px] truncate">{file.name}</span>
                          <button
                            onClick={() => removeFile(index)}
                            className="hover:bg-muted-foreground/20 rounded-full p-0.5"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      {isProcessingFiles && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Extracting text...
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex gap-2">
                    {/* Hidden File Input */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept=".pdf,.doc,.docx,.txt,image/*"
                      multiple
                      onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                    />
                    {/* Attachment Button */}
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={sendMessageMutation.isPending || isProcessingFiles}
                      title="Attach file (PDF, Word, Image)"
                      data-testid="button-attach-file"
                    >
                      <Paperclip className="w-4 h-4" />
                    </Button>
                    <Input
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                      placeholder={uploadedFiles.length > 0 ? "Add a message or just send the file..." : "Ask about academic writing..."}
                      disabled={sendMessageMutation.isPending}
                      data-testid="input-chat-message"
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={(!message.trim() && !extractedText) || sendMessageMutation.isPending || isProcessingFiles}
                      data-testid="button-send-message"
                    >
                      {sendMessageMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Attach images, PDFs, or Word documents to analyze
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Quick Prompts</CardTitle>
                <CardDescription className="text-xs">
                  Click to use a suggested prompt
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {suggestionPrompts.map((prompt, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-left h-auto py-2 text-xs"
                    onClick={() => handlePromptClick(prompt)}
                    data-testid={`button-prompt-${index}`}
                  >
                    <BookOpen className="w-3 h-3 mr-2 shrink-0" />
                    <span className="line-clamp-2">{prompt}</span>
                  </Button>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="grammar">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  Grammar & Style Check
                </CardTitle>
                <CardDescription>
                  Paste your text below to check for grammar, style, and clarity issues
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Textarea
                    value={textToCheck}
                    onChange={(e) => setTextToCheck(e.target.value)}
                    placeholder="Paste your academic text here to check for issues..."
                    rows={12}
                    data-testid="textarea-grammar-check"
                  />
                  <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
                    {wordCount} words | {charCount} characters
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleGrammarCheck}
                    disabled={grammarCheckMutation.isPending || !textToCheck.trim()}
                    className="flex-1"
                    data-testid="button-check-grammar"
                  >
                    {grammarCheckMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Checking...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Check Grammar
                      </>
                    )}
                  </Button>
                  {textToCheck.trim() && (
                    <Button
                      variant="outline"
                      onClick={() => copyToClipboard(textToCheck, "Current")}
                      title="Copy text"
                      data-testid="button-copy-text"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  )}
                  {hasChanges && (
                    <Button
                      variant="outline"
                      onClick={resetToOriginal}
                      title="Reset to original"
                      data-testid="button-reset"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => {
                      setTextToCheck("");
                      setOriginalText("");
                      setGrammarSuggestions([]);
                    }}
                  >
                    <Eraser className="w-4 h-4" />
                  </Button>
                </div>

              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Suggestions</CardTitle>
                    <CardDescription>
                      {grammarSuggestions.length > 0
                        ? `Found ${grammarSuggestions.length} suggestion(s)`
                        : "Suggestions will appear here after checking"
                      }
                    </CardDescription>
                  </div>
                  {grammarSuggestions.length > 1 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={applyAllSuggestions}
                      data-testid="button-apply-all"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                      Apply All
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[350px]">
                  {grammarSuggestions.length === 0 ? (
                    hasChanges ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                          <CheckCircle2 className="w-5 h-5" />
                          <span className="font-medium">All corrections applied!</span>
                        </div>
                        <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900">
                          <div className="flex items-center justify-between mb-2">
                            <Label className="text-xs font-medium text-green-700 dark:text-green-300">Corrected Text</Label>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2"
                              onClick={() => copyToClipboard(textToCheck, "Corrected")}
                            >
                              <Copy className="w-3 h-3 mr-1" />
                              <span className="text-xs">Copy</span>
                            </Button>
                          </div>
                          <p className="whitespace-pre-wrap text-sm text-green-800 dark:text-green-200">{textToCheck}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-center py-8">
                        <CheckCircle2 className="w-12 h-12 text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">
                          {grammarCheckMutation.isPending
                            ? "Analyzing your text..."
                            : "Enter text and click 'Check Grammar' to get suggestions"
                          }
                        </p>
                      </div>
                    )
                  ) : (
                    <div className="space-y-4">
                      {grammarSuggestions.map((suggestion, index) => {
                        // Color coding for different suggestion types
                        const typeColors: Record<string, string> = {
                          grammar: "border-l-red-500",
                          spelling: "border-l-orange-500",
                          punctuation: "border-l-yellow-500",
                          style: "border-l-blue-500",
                          clarity: "border-l-purple-500",
                          word_choice: "border-l-green-500",
                        };
                        const borderColor = typeColors[suggestion.type.toLowerCase()] || "border-l-primary";

                        return (
                          <Card key={index} className={`border-l-4 ${borderColor}`} data-testid={`card-suggestion-${index}`}>
                            <CardContent className="p-4 space-y-3">
                              <div className="flex items-start justify-between gap-2">
                                <Badge variant="outline" className="text-xs capitalize">
                                  {suggestion.type.replace(/_/g, ' ')}
                                </Badge>
                              </div>
                              {suggestion.original && (
                                <div className="text-sm">
                                  <span className="text-muted-foreground">Original: </span>
                                  <span className="line-through text-red-500">{suggestion.original}</span>
                                </div>
                              )}
                              {suggestion.suggested && (
                                <div className="text-sm">
                                  <span className="text-muted-foreground">Suggested: </span>
                                  <span className="text-green-600 dark:text-green-400">{suggestion.suggested}</span>
                                </div>
                              )}
                              {suggestion.explanation && (
                                <p className="text-xs text-muted-foreground">
                                  {suggestion.explanation}
                                </p>
                              )}
                              {suggestion.original && suggestion.suggested && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => applySuggestion(suggestion)}
                                  data-testid={`button-apply-suggestion-${index}`}
                                >
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  Apply
                                </Button>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
