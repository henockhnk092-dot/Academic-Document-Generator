import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/components/auth-provider";
import { useToast } from "@/hooks/use-toast";

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuthDialog({ open, onOpenChange }: AuthDialogProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const auth = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      await auth.signInWithGoogle();
      toast({
        title: t("components.authDialog.welcomeBack"),
        description: t("components.authDialog.signedInGoogle"),
      });
      onOpenChange(false);
      setEmail("");
      setPassword("");
    } catch (error: any) {
      if (error?.code === "auth/popup-closed-by-user" || error?.code === "auth/cancelled-popup-request") return;
      toast({
        title: t("components.authDialog.signInFailed"),
        description: error.message || t("components.authDialog.failedSignInGoogle"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSignIn = async () => {
    setIsLoading(true);
    try {
      await auth.signInWithEmail(email, password);
      toast({
        title: t("components.authDialog.welcomeBack"),
        description: t("components.authDialog.signedIn"),
      });
      onOpenChange(false);
      setEmail("");
      setPassword("");
    } catch (error: any) {
      toast({
        title: t("components.authDialog.signInFailed"),
        description: error.message || t("components.authDialog.invalidCredentials"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSignUp = async () => {
    setIsLoading(true);
    try {
      await auth.signUpWithEmail(email, password);
      toast({
        title: t("components.authDialog.accountCreated"),
        description: t("components.authDialog.welcomeToApp"),
      });
      onOpenChange(false);
      setEmail("");
      setPassword("");
    } catch (error: any) {
      toast({
        title: t("components.authDialog.signUpFailed"),
        description: error.message || t("components.authDialog.failedCreateAccount"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("components.authDialog.title")}</DialogTitle>
          <DialogDescription>
            {t("components.authDialog.description")}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="signin" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">{t("components.authDialog.signInTab")}</TabsTrigger>
            <TabsTrigger value="signup">{t("components.authDialog.signUpTab")}</TabsTrigger>
          </TabsList>

          <TabsContent value="signin" className="space-y-4 mt-4">
            <Button
              variant="outline"
              className="w-full"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              data-testid="button-google-signin"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              {t("components.authDialog.continueWithGoogle")}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">{t("components.authDialog.orContinueWith")}</span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="email">{t("components.authDialog.email")}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t("components.authDialog.emailPlaceholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-2"
                  data-testid="input-email"
                />
              </div>
              <div>
                <Label htmlFor="password">{t("components.authDialog.password")}</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-2"
                  data-testid="input-password"
                />
              </div>
              <Button
                className="w-full"
                onClick={handleEmailSignIn}
                disabled={isLoading || !email || !password}
                data-testid="button-email-signin"
              >
                {t("components.authDialog.signInBtn")}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="signup" className="space-y-4 mt-4">
            <Button
              variant="outline"
              className="w-full"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              data-testid="button-google-signup"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              {t("components.authDialog.continueWithGoogle")}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">{t("components.authDialog.orContinueWith")}</span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="signup-email">{t("components.authDialog.email")}</Label>
                <Input
                  id="signup-email"
                  type="email"
                  placeholder={t("components.authDialog.emailPlaceholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-2"
                  data-testid="input-signup-email"
                />
              </div>
              <div>
                <Label htmlFor="signup-password">{t("components.authDialog.password")}</Label>
                <Input
                  id="signup-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-2"
                  data-testid="input-signup-password"
                />
              </div>
              <Button
                className="w-full"
                onClick={handleEmailSignUp}
                disabled={isLoading || !email || !password}
                data-testid="button-email-signup"
              >
                {t("components.authDialog.createAccount")}
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        <p className="text-xs text-center text-muted-foreground mt-4">
          {t("components.authDialog.guestNotice1")}
          <br />
          {t("components.authDialog.guestNotice2")}
        </p>
      </DialogContent>
    </Dialog>
  );
}
