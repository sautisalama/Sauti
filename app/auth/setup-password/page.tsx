"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Lock, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Password strength rules
const RULES = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "Contains an uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "Contains a number", test: (p: string) => /\d/.test(p) },
];

function SetupPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  // When the user arrives at this page after clicking the invite email link,
  // the session may be in the URL fragment (#access_token=...).
  // We use onAuthStateChange to capture the session as soon as it's parsed.
  useEffect(() => {
    let mounted = true;

    // Check for session initially
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted && session) {
        setSessionReady(true);
        setCheckingSession(false);
      }
    });

    // Listen for auth state changes (e.g., when the client finishes parsing the fragment)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (mounted) {
        if (session) {
          setSessionReady(true);
          setCheckingSession(false);
          setError(null);
        } else if (event === 'INITIAL_SESSION' || event === 'SIGNED_OUT') {
           // Wait a second before giving up entirely, fragments can be slow
           setTimeout(() => {
             if (mounted && !sessionReady) {
               setCheckingSession(false);
               if (!error) {
                 setError("Your invite link may have expired or already been used. Please contact the admin for a new invitation.");
               }
             }
           }, 2000);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const passwordStrength = RULES.filter((r) => r.test(password)).length;
  const strengthLabel =
    passwordStrength === 0
      ? ""
      : passwordStrength === 1
      ? "Weak"
      : passwordStrength === 2
      ? "Fair"
      : "Strong";
  const strengthColor =
    passwordStrength === 1
      ? "bg-red-400"
      : passwordStrength === 2
      ? "bg-amber-400"
      : "bg-green-500";

  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;
  const canSubmit =
    sessionReady &&
    passwordStrength === RULES.length &&
    passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setIsLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message || "Failed to set password. Please try again.");
        return;
      }
      // Password set — navigate to onboarding/dashboard
      router.push("/dashboard");
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-sauti-teal" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Error Banner */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-xl">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm font-medium text-red-700">{error}</p>
        </div>
      )}

      {!sessionReady && !error ? null : sessionReady ? (
        <>
          {/* Password Field */}
          <div className="space-y-2">
            <Label
              htmlFor="password"
              className="text-sm font-semibold text-serene-neutral-700 ml-1"
            >
              Set your password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-serene-neutral-400" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Choose a strong password"
                className="pl-10 pr-10 h-12 bg-serene-neutral-50 border-sauti-teal/30 rounded-xl focus-visible:ring-sauti-teal/20 focus-visible:border-sauti-teal transition-all"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-serene-neutral-400 hover:text-serene-neutral-600 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>

            {/* Strength Bar */}
            {password.length > 0 && (
              <div className="space-y-2 pt-1">
                <div className="flex gap-1.5">
                  {RULES.map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex-1 h-1.5 rounded-full transition-all duration-300",
                        i < passwordStrength ? strengthColor : "bg-serene-neutral-100"
                      )}
                    />
                  ))}
                </div>
                <p
                  className={cn(
                    "text-xs font-semibold transition-colors",
                    passwordStrength === 1
                      ? "text-red-500"
                      : passwordStrength === 2
                      ? "text-amber-500"
                      : "text-green-600"
                  )}
                >
                  {strengthLabel}
                </p>
                <ul className="space-y-1">
                  {RULES.map((rule) => (
                    <li
                      key={rule.label}
                      className={cn(
                        "flex items-center gap-2 text-xs font-medium transition-colors",
                        rule.test(password)
                          ? "text-green-600"
                          : "text-serene-neutral-400"
                      )}
                    >
                      <CheckCircle2
                        className={cn(
                          "h-3.5 w-3.5 shrink-0",
                          rule.test(password)
                            ? "text-green-500"
                            : "text-serene-neutral-300"
                        )}
                      />
                      {rule.label}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Confirm Password Field */}
          <div className="space-y-2">
            <Label
              htmlFor="confirmPassword"
              className="text-sm font-semibold text-serene-neutral-700 ml-1"
            >
              Confirm your password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-serene-neutral-400" />
              <Input
                id="confirmPassword"
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                className={cn(
                  "pl-10 pr-10 h-12 bg-serene-neutral-50 rounded-xl transition-all",
                  confirmPassword.length > 0
                    ? passwordsMatch
                      ? "border-green-400 focus-visible:ring-green-200 focus-visible:border-green-500"
                      : "border-red-300 focus-visible:ring-red-100 focus-visible:border-red-400"
                    : "border-sauti-teal/30 focus-visible:ring-sauti-teal/20 focus-visible:border-sauti-teal"
                )}
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-serene-neutral-400 hover:text-serene-neutral-600 transition-colors"
                tabIndex={-1}
              >
                {showConfirm ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {confirmPassword.length > 0 && (
              <p
                className={cn(
                  "text-xs font-semibold ml-1",
                  passwordsMatch ? "text-green-600" : "text-red-500"
                )}
              >
                {passwordsMatch ? "✓ Passwords match" : "✗ Passwords do not match"}
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={!canSubmit || isLoading}
            className="w-full h-12 bg-sauti-teal hover:bg-sauti-teal/90 text-white font-bold rounded-xl shadow-lg shadow-sauti-teal/20 transition-all active:scale-[0.98] mt-2 disabled:opacity-60"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Setting up your account…
              </>
            ) : (
              "Set Password & Continue"
            )}
          </Button>
        </>
      ) : null}
    </form>
  );
}

export default function SetupPasswordPage() {
  return (
    <div className="flex flex-col min-h-screen bg-serene-neutral-50">
      <div className="w-full lg:grid lg:min-h-screen lg:grid-cols-2">
        {/* Left Panel */}
        <div className="hidden lg:block relative">
          <Image
            src="/couple-salama.jpg"
            alt="Sauti Salama Community"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-sauti-teal/60 via-transparent to-transparent" />
          <div className="absolute bottom-12 left-12 right-12 text-white">
            <h2 className="text-3xl font-serif font-bold mb-4">
              Welcome to the Team.
            </h2>
            <p className="text-lg font-medium text-white/90 max-w-md">
              You've been invited to join Sauti Salama as a professional service
              provider. Set up your password to get started.
            </p>
          </div>
        </div>

        {/* Right Panel */}
        <div className="flex items-center justify-center p-8 lg:p-12">
          <div className="mx-auto w-full max-w-[420px] space-y-8">
            <div className="space-y-3 text-center lg:text-left">
              <div className="inline-flex items-center justify-center h-18 w-18 rounded-2xl bg-sauti-teal/10 mb-2 lg:mb-4">
                <Image
                  src="/Logo.png"
                  alt="Sauti Salama"
                  width={100}
                  height={100}
                  className="object-contain"
                />
              </div>
              <h1 className="text-4xl font-serif font-bold text-serene-neutral-900 tracking-tight">
                Set Your Password
              </h1>
              <p className="text-serene-neutral-500 font-medium">
                Create a secure password to activate your Sauti Salama account.
                You'll then complete your professional profile.
              </p>
            </div>

            <div className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl border border-serene-neutral-100 shadow-xl shadow-serene-neutral-200/50">
              <Suspense
                fallback={
                  <div className="flex items-center justify-center h-40">
                    <Loader2 className="h-6 w-6 animate-spin text-sauti-teal" />
                  </div>
                }
              >
                <SetupPasswordForm />
              </Suspense>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
