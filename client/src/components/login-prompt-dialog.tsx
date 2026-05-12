import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/components/auth-provider";
import { useToast } from "@/hooks/use-toast";
import { LogIn, UserPlus, Mail, Lock } from "lucide-react";
import { SiGoogle } from "react-icons/si";

interface LoginPromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function LoginPromptDialog({ open, onOpenChange, onSuccess }: LoginPromptDialogProps) {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      await signInWithGoogle();
      toast({
        title: t("components.loginPromptDialog.welcome"),
        description: t("components.loginPromptDialog.freeGenerations"),
      });
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      if (error?.code === "auth/popup-closed-by-user" || error?.code === "auth/cancelled-popup-request") return;
      toast({
        title: t("components.authDialog.signInFailed"),
        description: error.message || t("components.loginPromptDialog.tryAgain"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      await signInWithEmail(email, password);
      toast({
        title: t("components.authDialog.welcomeBack"),
        description: t("components.loginPromptDialog.nowSignedIn"),
      });
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: t("components.authDialog.signInFailed"),
        description: error.message || t("components.loginPromptDialog.checkCredentials"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      await signUpWithEmail(email, password);
      toast({
        title: t("components.authDialog.accountCreated"),
        description: t("components.loginPromptDialog.freeGenerations"),
      });
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: t("components.authDialog.signUpFailed"),
        description: error.message || t("components.loginPromptDialog.tryAgain"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl text-center">{t("components.loginPromptDialog.title")}</DialogTitle>
          <DialogDescription className="text-center">
            {t("components.loginPromptDialog.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          <Button
            className="w-full gap-2"
            variant="outline"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            data-testid="button-google-signin"
          >
            <SiGoogle className="h-4 w-4" />
            {t("components.authDialog.continueWithGoogle")}
          </Button>
        </div>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">{t("components.loginPromptDialog.or")}</span>
          </div>
        </div>

        <Tabs defaultValue="signin" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin" className="gap-2" data-testid="tab-signin">
              <LogIn className="h-4 w-4" />
              {t("components.loginPromptDialog.signInTab")}
            </TabsTrigger>
            <TabsTrigger value="signup" className="gap-2" data-testid="tab-signup">
              <UserPlus className="h-4 w-4" />
              {t("components.loginPromptDialog.signUpTab")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="signin">
            <form onSubmit={handleEmailSignIn} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="signin-email">{t("components.authDialog.email")}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder={t("components.loginPromptDialog.emailPlaceholder")}
                    className="pl-10"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    data-testid="input-signin-email"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="signin-password">{t("components.authDialog.password")}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signin-password"
                    type="password"
                    placeholder={t("components.loginPromptDialog.passwordPlaceholder")}
                    className="pl-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    data-testid="input-signin-password"
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-signin-submit">
                {isLoading ? t("components.loginPromptDialog.signingIn") : t("components.authDialog.signInBtn")}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={handleEmailSignUp} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="signup-email">{t("components.authDialog.email")}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder={t("components.loginPromptDialog.emailPlaceholder")}
                    className="pl-10"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    data-testid="input-signup-email"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">{t("components.authDialog.password")}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder={t("components.loginPromptDialog.passwordCreatePlaceholder")}
                    className="pl-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    data-testid="input-signup-password"
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-signup-submit">
                {isLoading ? t("components.loginPromptDialog.creatingAccount") : t("components.authDialog.createAccount")}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <p className="text-xs text-center text-muted-foreground mt-4">
          {t("components.loginPromptDialog.termsNotice")}
        </p>
      </DialogContent>
    </Dialog>
  );
}
