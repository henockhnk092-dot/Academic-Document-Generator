import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Mail,
  Send,
  MessageCircle,
  Loader2
} from "lucide-react";
import { SiGithub, SiDiscord, SiYoutube, SiTiktok, SiInstagram } from "react-icons/si";
import { FaXTwitter } from "react-icons/fa6";
import { useTranslation } from "react-i18next";

export default function Contact() {
  const { t } = useTranslation();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: ""
  });
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Submit to Formspree
      const response = await fetch("https://formspree.io/f/mpwvllyg", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          subject: formData.subject,
          message: formData.message,
          _subject: `AcademicGen Contact: ${formData.subject}`
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      toast({
        title: "Message Sent",
        description: "Thank you for your message. We'll get back to you soon!",
      });

      setFormData({ name: "", email: "", subject: "", message: "" });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const socialLinks = [
    { icon: SiGithub, label: "GitHub", href: "https://github.com/henockhnk092-dot/Academic-Document-Generator", username: "henockhnk092-dot" },
    { icon: FaXTwitter, label: "Twitter", href: "https://twitter.com/HnkHorizon", username: "@HnkHorizon" },
    { icon: SiDiscord, label: "Discord", href: "#", username: "hnk0422_76455" },
    { icon: SiYoutube, label: "YouTube", href: "https://youtube.com/@HNK2005", username: "@HNK2005" },
    { icon: SiTiktok, label: "TikTok", href: "https://tiktok.com/@codingfever", username: "@codingfever" },
    { icon: SiInstagram, label: "Instagram", href: "https://instagram.com/hhnk.3693", username: "@hhnk.3693" },
  ];

  return (
    <div className="container max-w-6xl py-8 px-4 mx-auto" data-testid="page-contact">
      <div className="space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">{t("pages.contact.title")}</h1>
          <p className="text-muted-foreground">
            {t("pages.contact.subtitle")}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                {t("pages.contact.formTitle")}
              </CardTitle>
              <CardDescription>
                {t("pages.contact.formSubtitle")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      placeholder={t("pages.contact.namePlaceholder")}
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      data-testid="input-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder={t("pages.contact.emailPlaceholder")}
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                      data-testid="input-email"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    placeholder={t("pages.contact.subjectPlaceholder")}
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    required
                    data-testid="input-subject"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    placeholder={t("pages.contact.messagePlaceholder")}
                    rows={5}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    required
                    data-testid="input-message"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting} data-testid="button-submit">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("pages.contact.sending")}
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      {t("pages.contact.sendButton")}
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t("pages.contact.getInTouch")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Mail className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Email</p>
                    <a
                      href="mailto:hhnk3693@gmail.com"
                      className="text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      hhnk3693@gmail.com
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <SiGithub className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Source Code</p>
                    <a
                      href="https://github.com/henockhnk092-dot/Academic-Document-Generator"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      GitHub Repository
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("pages.contact.followConnect")}</CardTitle>
                <CardDescription>{t("pages.contact.followDesc")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {socialLinks.map((link, index) => (
                  <a
                    key={index}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-2 rounded-lg hover-elevate transition-colors"
                    data-testid={`link-social-${link.label.toLowerCase()}`}
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                      <link.icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{link.label}</p>
                      <p className="text-xs text-muted-foreground">{link.username}</p>
                    </div>
                  </a>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("pages.contact.faqTitle")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="font-medium">{t("pages.contact.faq1Q")}</p>
                  <p className="text-muted-foreground">{t("pages.contact.faq1A")}</p>
                </div>
                <div>
                  <p className="font-medium">{t("pages.contact.faq2Q")}</p>
                  <p className="text-muted-foreground">{t("pages.contact.faq2A")}</p>
                </div>
                <div>
                  <p className="font-medium">{t("pages.contact.faq3Q")}</p>
                  <p className="text-muted-foreground">{t("pages.contact.faq3A")}</p>
                </div>
                <div>
                  <p className="font-medium">{t("pages.contact.faq4Q")}</p>
                  <p className="text-muted-foreground">{t("pages.contact.faq4A")}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
