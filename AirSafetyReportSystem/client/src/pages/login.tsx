import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Shield, LogIn } from "lucide-react";
import { usePublicCompanySettings } from "@/hooks/usePublicCompanySettings";
import { CompanyLogo } from "@/components/company-logo";
import { ThemeToggle } from "@/components/theme-toggle";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: companySettings } = usePublicCompanySettings();
  const currentYear = new Date().getFullYear();

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginForm) => {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Login failed');
      }

      return response.json();
    },
    onSuccess: (data) => {
      localStorage.setItem('token', data.token);
      toast({
        title: "Welcome back!",
        description: "You have been logged in successfully.",
      });
      // Force page reload to update auth state
      window.location.href = '/';
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onLoginSubmit = (data: LoginForm) => {
    loginMutation.mutate(data);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>
        <div className="text-center">
          <div className="flex justify-center">
            <CompanyLogo size="xl" className="scale-[2.5]" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            {companySettings?.companyName || "Air Safety"}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Sign in to your account
          </p>
        </div>

        <Card className="p-8">
          <Form {...loginForm}>
            <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-6">
              <FormField
                control={loginForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="Enter your email"
                        autoComplete="email"
                        {...field}
                        data-testid="input-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={loginForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Enter your password"
                        autoComplete="current-password"
                        {...field}
                        data-testid="input-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full"
                disabled={loginMutation.isPending}
                data-testid="button-login"
              >
                <LogIn className="h-4 w-4 mr-2" />
                {loginMutation.isPending ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </Form>

          <div className="mt-4 p-4 bg-blue-50 rounded-md">
            <h3 className="text-sm font-medium text-blue-800 mb-2">Demo Credentials</h3>
            <p className="text-xs text-blue-700">
              Email: admin@airline.com<br />
              Email: demo@airline.com<br />
              Password: password123
            </p>
          </div>
        </Card>

        {/* Developer footer (login page) */}
        <div className="text-center mt-6 text-xs sm:text-sm text-muted-foreground">
          <div>© {currentYear} All rights reserved.</div>
          <div className="mt-1 font-medium">Ahmed .H Alhesh</div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4">
            <a href="mailto:ahmed.alhesh@gmaul.com" className="hover:underline">ahmed.alhesh@gmaul.com</a>
            <a href="tel:+218913402222" className="hover:underline">+218913402222</a>
            <a href="tel:+4808646686" className="hover:underline">+4808646686</a>
          </div>
        </div>
      </div>
    </div>
  );
}