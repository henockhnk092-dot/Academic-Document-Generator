import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { azureAvailable, AZURE_VOICES, fetchAzureAudio, getSpeechPrefs } from "@/hooks/use-speech";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Send, Bot, User, Loader2, BookOpen, Eraser, Copy, Volume2, Square, Check, Paperclip, FileText, Image, X, File } from "lucide-react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
}

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
  const [message, setMessage] = useState("");
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>(loadStoredMessages);
  const [speakingId, setSpeakingId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t, i18n } = useTranslation();
  const { toast } = useToast();

  const suggestionPrompts = [
    t("pages.aiAssistant.prompt1"),
    t("pages.aiAssistant.prompt2"),
    t("pages.aiAssistant.prompt3"),
    t("pages.aiAssistant.prompt4"),
    t("pages.aiAssistant.prompt5"),
    t("pages.aiAssistant.prompt6"),
  ];

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
      toast({ title: t("common.copyFailed"), variant: "destructive" });
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

  interface ChatResponse {
    response: string;
  }

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const chatResponse = await apiRequest("POST", "/api/ai/chat", {
        sessionId: sessionId || undefined,
        message: content,
        language: i18n.language
      });
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
        title: t("common.errorTitle"),
        description: error.message || t("common.failedSendMessage"),
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
      ? `${message.trim() || t("components.chatbotWidget.analyzeFile", { name: uploadedFiles.map(f => f.name).join(", ") })}\n\n📎 ${uploadedFiles.map(f => f.name).join(", ")}`
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

  const clearChat = () => {
    setMessages([]);
    setSessionId(null);
    localStorage.removeItem(CHAT_STORAGE_KEY);
    toast({
      title: t("pages.aiAssistant.chatClearedTitle"),
      description: t("pages.aiAssistant.chatClearedDesc"),
    });
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl" data-testid="page-ai-assistant">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{t("pages.aiAssistant.title")}</h1>
        <p className="text-muted-foreground">{t("pages.aiAssistant.subtitle")}</p>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <Card className="lg:col-span-3">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Bot className="w-5 h-5 text-primary" />
                    {t("pages.aiAssistant.chatTitle")}
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={clearChat}>
                    <Eraser className="w-4 h-4 mr-2" />
                    {t("pages.aiAssistant.clear")}
                  </Button>
                </div>
              </CardHeader>
              <Separator />
              <CardContent className="p-0">
                <ScrollArea className="h-[400px] p-4">
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <Bot className="w-16 h-16 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">{t("pages.aiAssistant.emptyChat")}</h3>
                      <p className="text-muted-foreground mb-4 max-w-md">
                        {t("pages.aiAssistant.emptyChatDesc")}
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
                                  title={t("common.copy")}
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
                                  title={speakingId === msg.id ? t("components.tts.stop") : t("components.tts.readAloud")}
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
                          {t("pages.aiAssistant.extractingText")}
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
                      title={t("common.attachFilePDF")}
                      data-testid="button-attach-file"
                    >
                      <Paperclip className="w-4 h-4" />
                    </Button>
                    <Input
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                      placeholder={uploadedFiles.length > 0 ? t("pages.aiAssistant.messagePlaceholderFile") : t("pages.aiAssistant.messagePlaceholder")}
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
                    {t("pages.aiAssistant.attachHint")}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">{t("pages.aiAssistant.quickPrompts")}</CardTitle>
                <CardDescription className="text-xs">
                  {t("pages.aiAssistant.quickPromptsDesc")}
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

          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-4 pb-4">
              <p className="text-sm font-semibold text-primary mb-2">{t("pages.aiAssistant.tipTitle")}</p>
              <ul className="space-y-1">
                {(["tipBullet1", "tipBullet2", "tipBullet3"] as const).map((key) => (
                  <li key={key} className="flex gap-2 items-start text-sm text-muted-foreground">
                    <span className="text-primary font-bold shrink-0">•</span>
                    <span>{t(`pages.aiAssistant.${key}`)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
      </div>
    </div>
  );
}
