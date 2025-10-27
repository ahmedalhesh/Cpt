import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Shield, FileText, Users, BarChart3, Lock, Clock } from "lucide-react";
import { Link } from "wouter";
import { usePublicCompanySettings } from "@/hooks/usePublicCompanySettings";

export default function Landing() {
  const { data: companySettings } = usePublicCompanySettings();
  
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            <span className="text-xl font-semibold tracking-tight">
              {companySettings?.companyName || "Air Safety Report System"}
            </span>
          </div>
          <Button asChild data-testid="button-login">
            <Link href="/login">Log In</Link>
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-background"></div>
        <div className="relative container mx-auto px-6 py-20 lg:py-32">
          <div className="max-w-3xl">
            <h1 className="text-4xl lg:text-5xl font-semibold tracking-tight mb-6">
              Professional Aviation Safety Reporting Platform
            </h1>
            <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
              Replace paper-based aviation safety forms with a secure, digital reporting platform. 
              Streamline incident reporting, enhance safety compliance, and improve operational efficiency 
              for pilots and safety officers.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button size="lg" asChild data-testid="button-get-started">
                <Link href="/login">Get Started</Link>
              </Button>
              <Button size="lg" variant="outline">Learn More</Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-6 py-16 lg:py-24">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-semibold tracking-tight mb-4">Complete Safety Reporting Solution</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Comprehensive tools for managing aviation safety reports with role-based access and workflow management
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="p-6">
            <FileText className="h-10 w-10 text-primary mb-4" />
            <h3 className="text-xl font-semibold mb-3">7 Report Types</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Air Safety Reports, Occurrence Reports, Ramp Incidents, Nonconformity Reports, 
              Commander's Discretion Forms, and Confidential Hazard Reports.
            </p>
          </Card>

          <Card className="p-6">
            <Users className="h-10 w-10 text-primary mb-4" />
            <h3 className="text-xl font-semibold mb-3">Role-Based Access</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Tailored permissions for Captains, Safety Officers, and Administrators 
              ensuring appropriate access control and data security.
            </p>
          </Card>

          <Card className="p-6">
            <BarChart3 className="h-10 w-10 text-primary mb-4" />
            <h3 className="text-xl font-semibold mb-3">Analytics Dashboard</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Real-time insights with comprehensive statistics, trend analysis, 
              and performance metrics for safety monitoring.
            </p>
          </Card>

          <Card className="p-6">
            <Lock className="h-10 w-10 text-primary mb-4" />
            <h3 className="text-xl font-semibold mb-3">Secure & Confidential</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Enterprise-grade security with encrypted data storage and optional 
              anonymous reporting for sensitive safety concerns.
            </p>
          </Card>

          <Card className="p-6">
            <Clock className="h-10 w-10 text-primary mb-4" />
            <h3 className="text-xl font-semibold mb-3">Workflow Management</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Track reports through their lifecycle with status updates, 
              review processes, and collaborative commenting.
            </p>
          </Card>

          <Card className="p-6">
            <Shield className="h-10 w-10 text-primary mb-4" />
            <h3 className="text-xl font-semibold mb-3">Compliance Ready</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Meet aviation safety regulations with comprehensive audit trails, 
              file attachments, and detailed reporting capabilities.
            </p>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t bg-card/50">
        <div className="container mx-auto px-6 py-16 text-center">
          <h2 className="text-3xl font-semibold tracking-tight mb-4">
            Ready to Enhance Aviation Safety?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join the modern approach to aviation safety reporting. Start creating reports today.
          </p>
          <Button size="lg" asChild data-testid="button-cta-login">
            <Link href="/login">Access System</Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t">
        <div className="container mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <span className="text-sm text-muted-foreground">Air Safety Report System</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
