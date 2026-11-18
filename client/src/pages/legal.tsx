import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  HelpCircle, Shield, FileText, ChevronDown, ChevronUp,
  Scale, Lock, Cookie, Users, AlertTriangle, RefreshCw,
  Globe, Zap, Cloud, BookOpen, Wand2, Image,
  CreditCard, CheckCircle2,
} from "lucide-react";

interface FaqItem {
  q: string;
  a: string;
  category: string;
}

function getFaqs(t: (key: string) => string): FaqItem[] {
  return [
    { category: "Getting Started", q: t("pages.legal.faqItems.gettingStarted.q1"), a: t("pages.legal.faqItems.gettingStarted.a1") },
    { category: "Getting Started", q: t("pages.legal.faqItems.gettingStarted.q2"), a: t("pages.legal.faqItems.gettingStarted.a2") },
    { category: "Getting Started", q: t("pages.legal.faqItems.gettingStarted.q3"), a: t("pages.legal.faqItems.gettingStarted.a3") },
    { category: "Getting Started", q: t("pages.legal.faqItems.gettingStarted.q4"), a: t("pages.legal.faqItems.gettingStarted.a4") },
    { category: "Documents & Generation", q: t("pages.legal.faqItems.documents.q1"), a: t("pages.legal.faqItems.documents.a1") },
    { category: "Documents & Generation", q: t("pages.legal.faqItems.documents.q2"), a: t("pages.legal.faqItems.documents.a2") },
    { category: "Documents & Generation", q: t("pages.legal.faqItems.documents.q3"), a: t("pages.legal.faqItems.documents.a3") },
    { category: "Documents & Generation", q: t("pages.legal.faqItems.documents.q4"), a: t("pages.legal.faqItems.documents.a4") },
    { category: "Documents & Generation", q: t("pages.legal.faqItems.documents.q5"), a: t("pages.legal.faqItems.documents.a5") },
    { category: "AI Features", q: t("pages.legal.faqItems.ai.q1"), a: t("pages.legal.faqItems.ai.a1") },
    { category: "AI Features", q: t("pages.legal.faqItems.ai.q2"), a: t("pages.legal.faqItems.ai.a2") },
    { category: "AI Features", q: t("pages.legal.faqItems.ai.q3"), a: t("pages.legal.faqItems.ai.a3") },
    { category: "AI Features", q: t("pages.legal.faqItems.ai.q4"), a: t("pages.legal.faqItems.ai.a4") },
    { category: "AI Features", q: t("pages.legal.faqItems.ai.q5"), a: t("pages.legal.faqItems.ai.a5") },
    { category: "Account & Data", q: t("pages.legal.faqItems.account.q1"), a: t("pages.legal.faqItems.account.a1") },
    { category: "Account & Data", q: t("pages.legal.faqItems.account.q2"), a: t("pages.legal.faqItems.account.a2") },
    { category: "Account & Data", q: t("pages.legal.faqItems.account.q3"), a: t("pages.legal.faqItems.account.a3") },
    { category: "Account & Data", q: t("pages.legal.faqItems.account.q4"), a: t("pages.legal.faqItems.account.a4") },
  ];
}

function FaqAccordion({ items }: { items: FaqItem[] }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState<number | null>(null);
  const itemCategories = Array.from(new Set(items.map((f) => f.category)));

  const categoryLabels: Record<string, string> = {
    "Getting Started": t("pages.legal.faq.catGettingStarted"),
    "Documents & Generation": t("pages.legal.faq.catDocuments"),
    "AI Features": t("pages.legal.faq.catAI"),
    "Account & Data": t("pages.legal.faq.catAccount"),
  };

  return (
    <div className="space-y-6">
      {itemCategories.map((cat) => (
        <div key={cat}>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="h-px flex-1 bg-border" />
            {categoryLabels[cat] ?? cat}
            <span className="h-px flex-1 bg-border" />
          </h3>
          <div className="space-y-2">
            {items
              .filter((item) => item.category === cat)
              .map((item, i) => {
                const globalIdx = items.indexOf(item);
                return (
                  <div key={i} className="border rounded-lg overflow-hidden">
                    <button
                      className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium hover:bg-muted/50 transition-colors"
                      onClick={() => setOpen(open === globalIdx ? null : globalIdx)}
                      aria-expanded={open === globalIdx}
                    >
                      <span>{item.q}</span>
                      {open === globalIdx ? (
                        <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground ml-3" />
                      ) : (
                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground ml-3" />
                      )}
                    </button>
                    {open === globalIdx && (
                      <div className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed border-t bg-muted/10 pt-3">
                        {item.a}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-foreground flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary shrink-0" />
        {title}
      </h3>
      <div className="text-sm text-muted-foreground leading-relaxed space-y-2 pl-6">
        {children}
      </div>
    </div>
  );
}

export default function Legal() {
  const { t } = useTranslation();
  const faqs = getFaqs(t);
  return (
    <div className="container max-w-6xl py-8 px-4 mx-auto 3xl:max-w-[1760px]" data-testid="page-legal">
      <div className="space-y-8">

        {/* Page header */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
              <Scale className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t("pages.legal.title")}</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">{t("pages.legal.subtitle")}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Badge variant="secondary" className="flex items-center gap-1.5"><HelpCircle className="h-3.5 w-3.5" /> {faqs.length} {t("pages.legal.faqsAnswered")}</Badge>
            <Badge variant="secondary" className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> {t("pages.legal.privacyFirst")}</Badge>
            <Badge variant="secondary" className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> {t("pages.legal.freeToUse")}</Badge>
            <Badge variant="secondary" className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" /> {t("pages.legal.location")}</Badge>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue={typeof window !== "undefined" && ["faq", "privacy", "terms", "refunds"].includes(window.location.hash.slice(1)) ? window.location.hash.slice(1) : "faq"}>
          <TabsList className="w-full grid grid-cols-2 sm:grid-cols-4 h-auto gap-1">
            <TabsTrigger value="faq" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <HelpCircle className="h-4 w-4 shrink-0" />
              {t("pages.legal.tabFaq")}
            </TabsTrigger>
            <TabsTrigger value="privacy" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <Shield className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">{t("pages.legal.tabPrivacy")}</span>
              <span className="sm:hidden">{t("pages.legal.tabPrivacyShort")}</span>
            </TabsTrigger>
            <TabsTrigger value="terms" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <FileText className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">{t("pages.legal.tabTerms")}</span>
              <span className="sm:hidden">{t("pages.legal.tabTermsShort")}</span>
            </TabsTrigger>
            <TabsTrigger value="refunds" className="flex items-center gap-1.5 text-xs sm:text-sm" data-testid="tab-refunds">
              <CreditCard className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Refunds and billing</span>
              <span className="sm:hidden">Refunds</span>
            </TabsTrigger>
          </TabsList>

          {/* ── Refunds, cancellation and billing ── */}
          <TabsContent value="refunds" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-primary" />Refunds, cancellation and billing</CardTitle>
                <CardDescription>Last updated: 18 November 2026</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 text-sm text-muted-foreground leading-relaxed">
                <Section icon={CreditCard} title="What you pay for">
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong className="text-foreground">Day Pass (R19) and Weekly (R49):</strong> once-off payments. They do not renew.</li>
                    <li><strong className="text-foreground">Monthly (R149):</strong> renews automatically every month on the same date until you cancel.</li>
                    <li><strong className="text-foreground">Yearly (R1,499):</strong> renews automatically every year on the same date until you cancel.</li>
                    <li><strong className="text-foreground">Credit packs and pay-once documents:</strong> once-off payments for Rewrite &amp; Verify. 1 credit = R1 of usage.</li>
                  </ul>
                  <p className="mt-2">All prices are in South African rand (ZAR). Each plan includes the fair-use allowance shown on the Pricing page. Payments are processed by Payfast; we never see or store your card details.</p>
                </Section>
                <Section icon={RefreshCw} title="Cancelling a subscription">
                  <p>You can cancel a Monthly or Yearly plan at any time by emailing support@hnkiot.com or sending a WhatsApp message to +27 61 471 9400 from the contact details on your account, or with the cancel link in the Payfast subscription email. We stop future charges within one business day. You keep access until the end of the period you already paid for.</p>
                </Section>
                <Section icon={CheckCircle2} title="Refunds">
                  <ul className="list-disc pl-5 space-y-1">
                    <li>If a Rewrite &amp; Verify job fails, or we cannot rewrite your text without changing its facts, the credits are returned to your account automatically.</li>
                    <li>If you were charged in error, charged twice, or the service did not work because of a fault on our side, contact us within 7 days of the charge and we will refund you to the original payment method.</li>
                    <li>Unused credit packs can be refunded within 7 days of purchase if none of the credits were used.</li>
                    <li>Subscription periods and credits that were already used are not refundable, except where the law requires it.</li>
                  </ul>
                  <p className="mt-2">Approved refunds are processed within 7 business days. The time for the money to reach your account depends on your bank.</p>
                </Section>
                <Section icon={AlertTriangle} title="Fair use and academic integrity">
                  <p>AcademicGen helps you plan, write, check and improve your own work. We do not promise any particular detector score or outcome, and you are responsible for following your university's rules on AI. Accounts that abuse the service, for example through automated or resold use, may be suspended without a refund of the abused period.</p>
                </Section>
                <Section icon={Users} title="Company details">
                  <p><strong className="text-foreground">HNK IoT Solutions (Pty) Ltd</strong>, registration number 2026/647269/07.<br />33 Scott Road, Parow West, Cape Town, South Africa.<br />Email: support@hnkiot.com · WhatsApp: +27 61 471 9400</p>
                </Section>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── FAQ ── */}
          <TabsContent value="faq" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HelpCircle className="h-5 w-5 text-primary" />
                  {t("pages.legal.faqTitle")}
                </CardTitle>
                <CardDescription>
                  {t("pages.legal.faqDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FaqAccordion items={faqs} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Privacy Policy ── */}
          <TabsContent value="privacy" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  {t("pages.legal.privacyTitle")}
                </CardTitle>
                <CardDescription>{t("pages.legal.privacyLastUpdated")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">

                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t("pages.legal.privacyIntro")}
                </p>

                <div className="grid gap-6 sm:grid-cols-2">

                  <Section icon={Users} title={t("pages.legal.privacy.dataCollect")}>
                    <ul className="space-y-2">
                      <li><strong className="text-foreground">{t("pages.legal.privacy.accountDataLabel")}</strong> {t("pages.legal.privacy.accountDataText")}</li>
                      <li><strong className="text-foreground">{t("pages.legal.privacy.usageDataLabel")}</strong> {t("pages.legal.privacy.usageDataText")}</li>
                      <li><strong className="text-foreground">{t("pages.legal.privacy.analyticsLabel")}</strong> {t("pages.legal.privacy.analyticsText")}</li>
                    </ul>
                  </Section>

                  <Section icon={FileText} title={t("pages.legal.privacy.yourDocs")}>
                    <p>
                      {t("pages.legal.privacy.docsNoStorePrefix")} <strong className="text-foreground">{t("pages.legal.privacy.not")}</strong> {t("pages.legal.privacy.docsNoStoreSuffix")}
                    </p>
                    <p>
                      {t("pages.legal.privacy.uploadedFilesText")}
                    </p>
                    <p>
                      {t("pages.legal.privacy.cloudSaveText")}
                    </p>
                  </Section>

                  <Section icon={Cookie} title={t("pages.legal.privacy.cookies")}>
                    <p>{t("pages.legal.privacy.cookiesIntro")}</p>
                    <ul className="space-y-1">
                      <li><strong className="text-foreground">{t("pages.legal.privacy.authLabel")}</strong> {t("pages.legal.privacy.authCookieText")}</li>
                      <li><strong className="text-foreground">{t("pages.legal.privacy.preferencesLabel")}</strong> {t("pages.legal.privacy.preferencesCookieText")}</li>
                      <li><strong className="text-foreground">{t("pages.legal.privacy.analyticsLabel")}</strong> {t("pages.legal.privacy.analyticsCookieText")}</li>
                    </ul>
                    <p>{t("pages.legal.privacy.cookiesConsent")}</p>
                  </Section>

                  <Section icon={Globe} title={t("pages.legal.privacy.thirdParty")}>
                    <ul className="space-y-1">
                      <li><strong className="text-foreground">Google Firebase</strong> {t("pages.legal.privacy.thirdFirebase")}</li>
                      <li><strong className="text-foreground">Google Gemini</strong> {t("pages.legal.privacy.thirdGemini")}</li>
                      <li><strong className="text-foreground">Pollinations.ai</strong> {t("pages.legal.privacy.thirdPollinations")}</li>
                      <li><strong className="text-foreground">Pixabay</strong> {t("pages.legal.privacy.thirdPixabay")}</li>
                      <li><strong className="text-foreground">ElevenLabs</strong> {t("pages.legal.privacy.thirdElevenLabs")}</li>
                      <li><strong className="text-foreground">Azure Cognitive Services</strong> {t("pages.legal.privacy.thirdAzure")}</li>
                      <li><strong className="text-foreground">StreamElements</strong> {t("pages.legal.privacy.thirdStreamElements")}</li>
                      <li><strong className="text-foreground">VoiceRSS</strong> {t("pages.legal.privacy.thirdVoiceRSS")}</li>
                      <li><strong className="text-foreground">Google Analytics</strong> {t("pages.legal.privacy.thirdAnalytics")}</li>
                      <li><strong className="text-foreground">Buy Me a Coffee</strong> {t("pages.legal.privacy.thirdPayments")}</li>
                    </ul>
                  </Section>

                  <Section icon={Lock} title={t("pages.legal.privacy.dataSecurity")}>
                    <p>{t("pages.legal.privacy.securityIntro")}</p>
                    <ul className="space-y-1">
                      <li>{t("pages.legal.privacy.security1")}</li>
                      <li>{t("pages.legal.privacy.security2")}</li>
                      <li>{t("pages.legal.privacy.security3")}</li>
                      <li>{t("pages.legal.privacy.security4")}</li>
                    </ul>
                  </Section>

                  <Section icon={RefreshCw} title={t("pages.legal.privacy.yourRights")}>
                    <p>{t("pages.legal.privacy.rightsIntro")}</p>
                    <ul className="space-y-1">
                      <li><strong className="text-foreground">{t("pages.legal.privacy.accessLabel")}</strong> {t("pages.legal.privacy.accessText")}</li>
                      <li><strong className="text-foreground">{t("pages.legal.privacy.deleteLabel")}</strong> {t("pages.legal.privacy.deleteText")}</li>
                      <li><strong className="text-foreground">{t("pages.legal.privacy.correctLabel")}</strong> {t("pages.legal.privacy.correctText")}</li>
                      <li><strong className="text-foreground">{t("pages.legal.privacy.optOutLabel")}</strong> {t("pages.legal.privacy.optOutText")}</li>
                    </ul>
                    <p>{t("pages.legal.privacy.contactRightsPrefix")} <a href="/contact" className="text-primary hover:underline">{t("support.contact")}</a>. {t("pages.legal.privacy.contactRightsSuffix")}</p>
                  </Section>

                </div>

                <div className="p-4 border rounded-lg bg-muted/30 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground mb-1 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /> {t("pages.legal.policyUpdatesHeading")}</p>
                  <p>{t("pages.legal.policyUpdatesText")}</p>
                </div>

                <p className="text-sm text-muted-foreground">
                  {t("pages.legal.questions")} <a href="/contact" className="text-primary hover:underline">{t("pages.legal.contactUs")}</a>.
                </p>

              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Terms of Service ── */}
          <TabsContent value="terms" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  {t("pages.legal.termsTitle")}
                </CardTitle>
                <CardDescription>{t("pages.legal.termsLastUpdated")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">

                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t("pages.legal.termsIntro")}
                </p>

                <div className="grid gap-6 sm:grid-cols-2">

                  <Section icon={CheckCircle2} title={t("pages.legal.terms.acceptableUse")}>
                    <ul className="space-y-1.5">
                      <li>{t("pages.legal.terms.acceptable1")}</li>
                      <li>{t("pages.legal.terms.acceptable2")}</li>
                      <li>{t("pages.legal.terms.acceptable3")}</li>
                      <li>{t("pages.legal.terms.acceptable4")}</li>
                      <li>{t("pages.legal.terms.acceptable5")}</li>
                      <li>{t("pages.legal.terms.acceptable6")}</li>
                    </ul>
                  </Section>

                  <Section icon={Zap} title={t("pages.legal.terms.serviceAvailability")}>
                    <ul className="space-y-1.5">
                      <li>{t("pages.legal.terms.availability1")}</li>
                      <li>{t("pages.legal.terms.availability2")}</li>
                      <li>{t("pages.legal.terms.availability3")}</li>
                      <li>{t("pages.legal.terms.availability4")}</li>
                    </ul>
                  </Section>

                  <Section icon={CreditCard} title={t("pages.legal.terms.billing")}>
                    <ul className="space-y-1.5">
                      <li>{t("pages.legal.terms.billing1")}</li>
                      <li>{t("pages.legal.terms.billing2")}</li>
                      <li>{t("pages.legal.terms.billing3")}</li>
                      <li>{t("pages.legal.terms.billing4")}</li>
                      <li>{t("pages.legal.terms.billing5")}</li>
                      <li>{t("pages.legal.terms.billing6")}</li>
                    </ul>
                  </Section>

                  <Section icon={BookOpen} title={t("pages.legal.terms.ip")}>
                    <p>{t("pages.legal.terms.ip1")}</p>
                    <p><strong className="text-foreground">{t("pages.legal.terms.yourContentLabel")}</strong> {t("pages.legal.terms.yourContentText")}</p>
                    <p>{t("pages.legal.terms.ip3")}</p>
                  </Section>

                  <Section icon={Cloud} title={t("pages.legal.terms.cloudStorage")}>
                    <ul className="space-y-1.5">
                      <li>{t("pages.legal.terms.cloud1")}</li>
                      <li>{t("pages.legal.terms.cloud2")}</li>
                      <li>{t("pages.legal.terms.cloud3")}</li>
                    </ul>
                  </Section>

                  <Section icon={Wand2} title={t("pages.legal.terms.aiDisclaimer")}>
                    <ul className="space-y-1.5">
                      <li>{t("pages.legal.terms.ai1")}</li>
                      <li>{t("pages.legal.terms.ai2")}</li>
                      <li>{t("pages.legal.terms.ai3")}</li>
                      <li>{t("pages.legal.terms.ai4")}</li>
                      <li>{t("pages.legal.terms.ai5")}</li>
                    </ul>
                  </Section>

                  <Section icon={AlertTriangle} title={t("pages.legal.terms.liability")}>
                    <p>{t("pages.legal.terms.liabilityIntro")}</p>
                    <ul className="space-y-1">
                      <li>{t("pages.legal.terms.liability1")}</li>
                      <li>{t("pages.legal.terms.liability2")}</li>
                      <li>{t("pages.legal.terms.liability3")}</li>
                      <li>{t("pages.legal.terms.liability4")}</li>
                    </ul>
                  </Section>

                  <Section icon={Image} title={t("pages.legal.terms.imageGen")}>
                    <ul className="space-y-1.5">
                      <li>{t("pages.legal.terms.image1")}</li>
                      <li>{t("pages.legal.terms.image2")}</li>
                      <li>{t("pages.legal.terms.image3")}</li>
                    </ul>
                  </Section>

                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="p-4 border rounded-lg bg-muted/30 text-sm text-muted-foreground space-y-1">
                    <p className="font-medium text-foreground flex items-center gap-2"><Globe className="h-4 w-4 text-primary" /> {t("pages.legal.governingLawHeading")}</p>
                    <p>{t("pages.legal.governingLawText")}</p>
                  </div>
                  <div className="p-4 border rounded-lg bg-muted/30 text-sm text-muted-foreground space-y-1">
                    <p className="font-medium text-foreground flex items-center gap-2"><RefreshCw className="h-4 w-4 text-primary" /> {t("pages.legal.changesTermsHeading")}</p>
                    <p>{t("pages.legal.changesTermsText")}</p>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground">
                  {t("pages.legal.termsQuestions")}{" "}
                  <a href="/contact" className="text-primary hover:underline">{t("pages.legal.contactUs")}</a> {t("pages.legal.termsQuestionsSuffix")}
                </p>

              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

      </div>
    </div>
  );
}
