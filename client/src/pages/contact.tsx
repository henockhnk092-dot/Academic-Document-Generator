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
  Loader2,
  ExternalLink,
  Cpu
} from "lucide-react";
import { SiGithub } from "react-icons/si";
import { FaWhatsapp } from "react-icons/fa";
import { BUSINESS, SOCIAL_LINKS, SOURCE_REPO } from "@/lib/business";
import { useTranslation } from "react-i18next";

const FORMSPREE_ENDPOINT = import.meta.env.VITE_FORMSPREE_ENDPOINT;

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
      if (!FORMSPREE_ENDPOINT) {
        throw new Error("Contact form endpoint is not configured");
      }
      const response = await fetch(FORMSPREE_ENDPOINT, {
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
        title: t("pages.contact.sentTitle"),
        description: t("pages.contact.sentDesc"),
      });

      setFormData({ name: "", email: "", subject: "", message: "" });
    } catch (error) {
      toast({
        title: t("pages.contact.errorTitle"),
        description: t("pages.contact.errorDesc"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const socialLinks = SOCIAL_LINKS.map((s) => ({ icon: s.icon, label: s.name, href: s.url, username: s.handle }));

  return (
    <div className="container max-w-6xl py-8 px-4 mx-auto 3xl:max-w-[1760px]" data-testid="page-contact">
      <div className="space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">{t("pages.contact.title")}</h1>
          <p className="text-muted-foreground">
            {t("pages.contact.subtitle")}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-6">
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
                    <Label htmlFor="name">{t("pages.contact.nameLabel")}</Label>
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
                    <Label htmlFor="email">{t("pages.contact.emailLabel")}</Label>
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
                  <Label htmlFor="subject">{t("pages.contact.subjectLabel")}</Label>
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
                  <Label htmlFor="message">{t("pages.contact.messageLabel")}</Label>
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

          <div className="flex-1 overflow-hidden rounded-lg border min-h-[220px] flex flex-col">
            <div className="px-4 py-3 border-b bg-card">
              <h3 className="font-semibold text-sm">{t("pages.contact.ourLocation")}</h3>
              <p className="text-xs text-muted-foreground">{t("pages.contact.locationName")}</p>
            </div>
            <iframe
              title={t("pages.contact.locationName")}
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d211953.10071455358!2d18.295288!3d-33.928992!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x1dcc500f8826eed7%3A0x687fe1fc2828aa87!2sCape%20Town%2C%20South%20Africa!5e0!3m2!1sen!2sza!4v1715000000000!5m2!1sen!2sza"
              width="100%"
              height="100%"
              style={{ border: 0, display: "block", flex: 1 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
          </div>

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
                    <p className="font-medium">{t("pages.contact.emailLabel")}</p>
                    <a
                      href={`mailto:${BUSINESS.supportEmail}`}
                      className="text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      {BUSINESS.supportEmail}
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <FaWhatsapp className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">WhatsApp</p>
                    <a
                      href={BUSINESS.whatsapp}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted-foreground hover:text-primary transition-colors"
                      data-testid="link-whatsapp"
                    >
                      {BUSINESS.phone}
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <SiGithub className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{t("pages.contact.sourceCode")}</p>
                    <a
                      href={SOURCE_REPO}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      {t("pages.contact.githubRepo")}
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
                <CardTitle className="flex items-center gap-2">
                  <Cpu className="h-5 w-5" />
                  {t("pages.contact.aboutAuthor")}
                </CardTitle>
                <CardDescription>
                  {t("pages.contact.authorTagline")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <img
                    src="/images/author.jpg"
                    alt={BUSINESS.founder}
                    className="h-14 w-14 rounded-full object-cover border-2 border-primary/20 shrink-0"
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                  />
                  <div>
                    <p className="font-semibold text-sm">{BUSINESS.legalName}</p>
                    <p className="text-xs text-muted-foreground">
                      {BUSINESS.founder} · {t("pages.contact.locationName")}
                    </p>
                    <p className="text-xs text-muted-foreground">Reg. {BUSINESS.registration}</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t("pages.contact.authorDesc")}
                </p>
                <a
                  href={BUSINESS.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 w-full justify-center"
                >
                  <Button className="w-full" variant="outline">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    {t("pages.contact.bookServices")}
                  </Button>
                </a>
              </CardContent>
            </Card>

          </div>
        </div>

      </div>
    </div>
  );
}
