import { useState, useRef, useEffect } from "react";
import i18n from "i18next";
import { useTranslation } from "react-i18next";
import { useLocation, Link } from "wouter";
import { MessageCircle, Send, X, Bot, User, Loader2, Minimize2, Copy, Volume2, Square, Check, Trash2, Paperclip, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const WIDGET_CHAT_STORAGE_KEY = "academicgen-widget-chat-messages";

function formatMarkdown(text: string, onLinkClick?: () => void): JSX.Element {
  const lines = text.split('\n');
  const elements: JSX.Element[] = [];

  lines.forEach((line, lineIndex) => {
    if (!line.trim()) {
      elements.push(<div key={lineIndex} className="h-1.5" />);
      return;
    }

    const isBullet = line.trim().startsWith('•') || line.trim().startsWith('-') || line.trim().startsWith('*');
    const bulletContent = isBullet ? line.replace(/^[\s]*[•\-\*][\s]*/, '') : line;

    // Process bold text and links
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

        // Bold link **[text](/path)**
        const boldLinkMatch = matchText.match(/\*\*\[([^\]]+)\]\(([^)]+)\)\*\*/);
        if (boldLinkMatch) {
          const [, linkText, linkPath] = boldLinkMatch;
          result.push(
            <Link key={partIndex++} href={linkPath} onClick={onLinkClick}>
              <span className="font-semibold text-primary hover:underline cursor-pointer">{linkText}</span>
            </Link>
          );
        }
        // Plain link [text](/path)
        else if (matchText.startsWith('[')) {
          const linkMatch = matchText.match(/\[([^\]]+)\]\(([^)]+)\)/);
          if (linkMatch) {
            const [, linkText, linkPath] = linkMatch;
            result.push(
              <Link key={partIndex++} href={linkPath} onClick={onLinkClick}>
                <span className="text-primary hover:underline cursor-pointer">{linkText}</span>
              </Link>
            );
          }
        }
        // Plain bold **text**
        else if (matchText.startsWith('**') && matchText.endsWith('**')) {
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
        <div key={lineIndex} className="flex gap-1.5 items-start ml-0.5">
          <span className="text-primary font-bold text-xs mt-0.5">•</span>
          <span className="flex-1">{formattedParts}</span>
        </div>
      );
    } else {
      elements.push(<div key={lineIndex}>{formattedParts}</div>);
    }
  });

  return <div className="space-y-0.5 break-words overflow-hidden">{elements}</div>;
}

// Strip markdown for TTS
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*\[([^\]]+)\]\([^)]+\)\*\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/[•\-\*]\s*/g, '')
    .replace(/\n+/g, ' ')
    .trim();
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  fileName?: string;
}

const createWelcomeMessage = (): Message => ({
  id: "welcome",
  role: "assistant",
  content: i18n.t("chat.welcome"),
  timestamp: new Date(),
});

// Load messages from localStorage
const loadStoredMessages = (): Message[] => {
  try {
    const stored = localStorage.getItem(WIDGET_CHAT_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Convert date strings back to Date objects
      return parsed.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }));
    }
  } catch (e) {
    console.error("Failed to load widget chat messages:", e);
  }
  return [createWelcomeMessage()];
};

export function ChatbotWidget() {
  const { t, i18n } = useTranslation();
  const [location, setLocation] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(loadStoredMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [attachedFile, setAttachedFile] = useState<{ name: string; content: string } | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isHidden = location === "/ai-assistant";

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      try {
        localStorage.setItem(WIDGET_CHAT_STORAGE_KEY, JSON.stringify(messages));
      } catch (e) {
        console.error("Failed to save widget chat messages:", e);
      }
    }
  }, [messages]);

  // Clear chat function
  const handleClearChat = () => {
    setMessages([createWelcomeMessage()]);
    localStorage.removeItem(WIDGET_CHAT_STORAGE_KEY);
    window.speechSynthesis?.cancel();
    setSpeakingId(null);
  };

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  // Cleanup TTS on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

  const handleCopy = async (text: string, messageId: string) => {
    const plainText = stripMarkdown(text);
    try {
      await navigator.clipboard.writeText(plainText);
      setCopiedId(messageId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleSpeak = (text: string, messageId: string) => {
    if (speakingId === messageId) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const plainText = stripMarkdown(text);
    const utterance = new SpeechSynthesisUtterance(plainText);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);
    window.speechSynthesis.speak(utterance);
    setSpeakingId(messageId);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessingFile(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/files/process", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Failed to process file");
      const data = await res.json();
      setAttachedFile({ name: file.name, content: data.text || "" });
    } catch {
      setAttachedFile({ name: file.name, content: t("components.chatbotWidget.fileExtractFailed", { name: file.name }) });
    } finally {
      setIsProcessingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && !attachedFile) || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim() || t("components.chatbotWidget.analyzeFile", { name: attachedFile?.name }),
      fileName: attachedFile?.name,
      timestamp: new Date(),
    };

    const fileContent = attachedFile?.content;
    const fileName = attachedFile?.name;

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setAttachedFile(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage.content, fileContent, fileName, language: i18n.language }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.response || t("components.chatbotDialog.fallbackResponse"),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: t("components.chatbotDialog.errorResponse"),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleLinkClick = () => {
    setIsOpen(false);
  };

  if (isHidden) {
    return null;
  }

  return (
    <>
      <div
        className={cn(
          "fixed transition-all duration-300 ease-in-out",
          isOpen
            ? "inset-x-0 bottom-0 top-12 z-[9999] sm:z-50 sm:inset-auto sm:bottom-4 sm:right-4 sm:w-[min(360px,calc(100vw-1rem))] sm:h-[500px] sm:max-h-[85vh] sm:rounded-lg"
            : "z-50 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] right-2 sm:right-4 w-auto h-auto"
        )}
      >
        {isOpen ? (
          <div className="flex flex-col h-screen sm:h-full w-full bg-background border-0 sm:border sm:rounded-lg shadow-lg overflow-hidden">
            <div className="flex items-center justify-between p-2 sm:p-3 pt-[calc(0.5rem+env(safe-area-inset-top))] sm:pt-3 border-b bg-muted/30">
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <div className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Bot className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                </div>
                <span className="font-medium text-xs sm:text-sm truncate">{t("components.chatbotDialog.title")}</span>
              </div>
              <div className="flex items-center gap-1">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={handleClearChat}
                        disabled={messages.length <= 1}
                        className="h-8 w-8"
                        aria-label={t("chat.clearChat")}
                        data-testid="button-clear-chatbot"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t("chat.clearChat")}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setIsOpen(false)}
                  className="h-8 w-8"
                  aria-label={t("components.chatbotWidget.closeChat")}
                  data-testid="button-minimize-chatbot"
                >
                  <X className="h-5 w-5 sm:hidden" />
                  <Minimize2 className="h-4 w-4 hidden sm:block" />
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1 p-2 sm:p-3" ref={scrollAreaRef}>
              <div className="space-y-2 sm:space-y-3">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex gap-1.5 sm:gap-2",
                      message.role === "user" ? "flex-row-reverse" : ""
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-6 w-6 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-full",
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                    >
                      {message.role === "user" ? (
                        <User className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      ) : (
                        <Bot className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      )}
                    </div>
                    <div className="flex flex-col min-w-0 max-w-[calc(100%-2.5rem)] sm:max-w-[85%]">
                      <div
                        className={cn(
                          "rounded-lg px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm break-words",
                          message.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        )}
                        data-testid={`chat-message-${message.role}-${message.id}`}
                      >
                        {message.fileName && (
                          <div className="flex items-center gap-1 mb-1 opacity-80">
                            <FileText className="h-3 w-3 shrink-0" />
                            <span className="text-xs truncate max-w-[160px]">{message.fileName}</span>
                          </div>
                        )}
                        {message.role === "assistant" ? (
                          formatMarkdown(message.content, handleLinkClick)
                        ) : (
                          <p className="whitespace-pre-wrap break-words">{message.content}</p>
                        )}
                      </div>
                      {message.role === "assistant" && (
                        <div className="flex gap-1 mt-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => handleCopy(message.content, message.id)}
                            aria-label={t("components.chatbotWidget.copyMessage")}
                          >
                            {copiedId === message.id ? (
                              <Check className="h-3 w-3 text-green-500" />
                            ) : (
                              <Copy className="h-3 w-3 text-muted-foreground" />
                            )}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => handleSpeak(message.content, message.id)}
                            aria-label={speakingId === message.id ? t("components.chatbotWidget.stopReading") : t("components.chatbotWidget.readAloud")}
                          >
                            {speakingId === message.id ? (
                              <Square className="h-3 w-3 text-primary" />
                            ) : (
                              <Volume2 className="h-3 w-3 text-muted-foreground" />
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex gap-1.5 sm:gap-2">
                    <div className="flex h-6 w-6 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Bot className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    </div>
                    <div className="rounded-lg px-2.5 py-1.5 sm:px-3 sm:py-2 bg-muted">
                      <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="p-2 sm:p-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))] sm:pb-3 border-t space-y-1.5">
              {attachedFile && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-muted rounded text-xs">
                  <FileText className="h-3 w-3 shrink-0 text-primary" />
                  <span className="flex-1 truncate">{attachedFile.name}</span>
                  <button
                    onClick={() => setAttachedFile(null)}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={t("components.chatbotWidget.removeFile")}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              <div className="flex gap-1.5 sm:gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileSelect}
                  aria-label={t("common.attachFile")}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading || isProcessingFile}
                  className="h-9 w-9 sm:h-10 sm:w-10 shrink-0"
                  aria-label={t("components.chatbotWidget.attachFile")}
                  title={t("components.chatbotWidget.attachFile")}
                >
                  {isProcessingFile ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Paperclip className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  )}
                </Button>
                <Input
                  ref={inputRef}
                  placeholder={attachedFile ? t("components.chatbotWidget.fileMessagePlaceholder") : t("chat.inputPlaceholder")}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={isLoading}
                  className="flex-1 text-xs sm:text-sm h-9 sm:h-10"
                  data-testid="input-chat-message"
                />
                <Button
                  size="icon"
                  onClick={handleSend}
                  disabled={(!input.trim() && !attachedFile) || isLoading}
                  className="h-9 w-9 sm:h-10 sm:w-10 shrink-0"
                  aria-label={t("components.chatbotWidget.sendMessage")}
                  data-testid="button-send-message"
                >
                  <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <Button
            size="lg"
            variant="outline"
            className="h-12 w-12 sm:h-14 sm:w-14 rounded-xl shadow-lg opacity-50 bg-background/30 backdrop-blur-sm border-primary/30 text-primary hover:opacity-100 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all duration-200"
            onClick={() => setIsOpen(true)}
            aria-label={t("components.chatbotWidget.openChat")}
            data-testid="button-open-chatbot"
          >
            <Bot className="h-6 w-6 sm:h-8 sm:w-8" />
          </Button>
        )}
      </div>
    </>
  );
}
