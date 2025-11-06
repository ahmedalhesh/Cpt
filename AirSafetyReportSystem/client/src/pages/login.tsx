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
import { LogIn } from "lucide-react";
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
      // Check if it's a rate limit error
      let errorMessage = error.message;
      try {
        // Try to parse error message if it contains retryAfter
        if (error.message.includes('retryAfter') || error.message.includes('try again after')) {
          errorMessage = error.message;
        }
      } catch {}
      
      toast({
        title: "Login failed",
        description: errorMessage,
        variant: "destructive",
        duration: 5000, // Show for 5 seconds
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
            {companySettings?.companyName || "Report Sys"}
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
        </Card>

        {/* Developer footer (login page) */}
        <div className="text-center mt-6 text-xs sm:text-sm text-muted-foreground">
          <div>© {currentYear} All rights reserved.</div>
          <div className="mt-1 font-medium">Developed by Ahmed H. Alhesh</div>
          {/* Phones directly under Developed by */}
          <div className="flex flex-col items-center justify-center gap-2 sm:gap-4 mt-1">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4">
              <a href="tel:+14808646686" className="hover:underline">+1 (480) 864-6686</a>
              <a href="tel:+218913402222" className="hover:underline">+218 91 340 2222</a>
            </div>
          </div>
          <div className="mt-1">Inspired by Capt. Shams Eddin M. Bzeek</div>
        </div>
      </div>
    </div>
  );
}