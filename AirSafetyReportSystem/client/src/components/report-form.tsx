import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { ArrowLeft, Save } from "lucide-react";
import { Link } from "wouter";

type ReportType = "asr" | "or" | "rir" | "ncr" | "cdf" | "chr";

interface ReportFormProps {
  type: ReportType;
}

const reportTitles: Record<ReportType, string> = {
  asr: "Air Safety Report (ASR)",
  or: "Occurrence Report (OR)",
  rir: "Ramp Incident Report (RIR)",
  ncr: "Nonconformity Report (NCR)",
  cdf: "Commander's Discretion Form (CDF)",
  chr: "Confidential Hazard Report (CHR)",
};

// Base schema with common fields
const baseSchema = z.object({
  description: z.string().min(10, "Description must be at least 10 characters"),
  isAnonymous: z.boolean().default(false),
});

// Extended schemas for each report type
const asrSchema = baseSchema.extend({
  flightNumber: z.string().min(1, "Flight number is required"),
  aircraftType: z.string().min(1, "Aircraft type is required"),
  route: z.string().min(1, "Route is required"),
  eventDateTime: z.string().min(1, "Event date and time is required"),
  contributingFactors: z.string().optional(),
  correctiveActions: z.string().optional(),
});

const orSchema = baseSchema.extend({
  location: z.string().min(1, "Location is required"),
  phaseOfFlight: z.string().min(1, "Phase of flight is required"),
  riskLevel: z.enum(["low", "medium", "high", "critical"]),
  followUpActions: z.string().optional(),
});

const rirSchema = baseSchema.extend({
  location: z.string().min(1, "Location is required"),
  groundCrewNames: z.string().optional(),
  vehicleInvolved: z.string().optional(),
  damageType: z.string().optional(),
  correctiveSteps: z.string().optional(),
});

const ncrSchema = baseSchema.extend({
  department: z.string().min(1, "Department is required"),
  nonconformityType: z.string().min(1, "Nonconformity type is required"),
  rootCause: z.string().min(1, "Root cause is required"),
  responsiblePerson: z.string().optional(),
  preventiveActions: z.string().optional(),
});

const cdfSchema = baseSchema.extend({
  discretionReason: z.string().min(1, "Reason for discretion is required"),
  timeExtension: z.string().optional(),
  crewFatigueDetails: z.string().optional(),
  finalDecision: z.string().min(1, "Final decision is required"),
});

const chrSchema = baseSchema.extend({
  potentialImpact: z.string().min(1, "Potential impact is required"),
  preventionSuggestions: z.string().optional(),
});

const schemas: Record<ReportType, z.ZodSchema> = {
  asr: asrSchema,
  or: orSchema,
  rir: rirSchema,
  ncr: ncrSchema,
  cdf: cdfSchema,
  chr: chrSchema,
};

export function ReportForm({ type }: ReportFormProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isAnonymous, setIsAnonymous] = useState(false);

  const form = useForm({
    resolver: zodResolver(schemas[type]),
    defaultValues: {
      description: "",
      isAnonymous: false,
    },
  });

  const createReportMutation = useMutation({
    mutationFn: async (data: any) => {
      const result = await apiRequest("POST", "/api/reports", {
        ...data,
        reportType: type,
        isAnonymous: isAnonymous ? 1 : 0,
      });
      return result;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/stats"] });
      toast({
        title: "Report submitted",
        description: "Your report has been submitted successfully.",
      });
      setLocation(`/reports/${data.id}`);
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to submit report. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: any) => {
    createReportMutation.mutate(data);
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="container max-w-4xl mx-auto p-6 lg:p-8">
        <Button variant="ghost" asChild className="mb-6" data-testid="button-back">
          <Link href="/reports">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Reports
          </Link>
        </Button>

        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight mb-2">{reportTitles[type]}</h1>
          <p className="text-muted-foreground">Complete all required fields to submit your report</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {/* Anonymous checkbox for CHR */}
            {type === 'chr' && (
              <Card className="p-6 bg-muted/50">
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="anonymous"
                    checked={isAnonymous}
                    onCheckedChange={(checked) => setIsAnonymous(checked === true)}
                    data-testid="checkbox-anonymous"
                  />
                  <div className="space-y-1 leading-none">
                    <Label htmlFor="anonymous" className="text-sm font-medium cursor-pointer">
                      Submit Anonymously
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Your identity will be kept confidential for this hazard report
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {/* ASR Fields */}
            {type === 'asr' && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="flightNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Flight Number *</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., AA1234" {...field} data-testid="input-flight-number" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="aircraftType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Aircraft Type *</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Boeing 737-800" {...field} data-testid="input-aircraft-type" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="route"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Route *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., JFK-LAX" {...field} data-testid="input-route" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="eventDateTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Event Date & Time *</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} data-testid="input-event-datetime" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Event Description *</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Describe the safety event in detail..." 
                          className="min-h-32 resize-y" 
                          {...field} 
                          data-testid="textarea-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="contributingFactors"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contributing Factors</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="What factors contributed to this event?" 
                          className="min-h-24 resize-y" 
                          {...field} 
                          data-testid="textarea-contributing-factors"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="correctiveActions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Corrective Actions</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="What corrective actions were taken?" 
                          className="min-h-24 resize-y" 
                          {...field} 
                          data-testid="textarea-corrective-actions"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {/* OR Fields */}
            {type === 'or' && (
              <>
                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Gate 42, Runway 27R" {...field} data-testid="input-location" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phaseOfFlight"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phase of Flight *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Takeoff, Cruise, Landing" {...field} data-testid="input-phase-of-flight" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="riskLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Risk Level *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-risk-level">
                            <SelectValue placeholder="Select risk level" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Occurrence Description *</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Describe the occurrence in detail..." 
                          className="min-h-32 resize-y" 
                          {...field} 
                          data-testid="textarea-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="followUpActions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Follow-up Actions</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="What follow-up actions are recommended?" 
                          className="min-h-24 resize-y" 
                          {...field} 
                          data-testid="textarea-follow-up-actions"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {/* RIR Fields */}
            {type === 'rir' && (
              <>
                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Ramp Area A, Gate 15" {...field} data-testid="input-location" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="groundCrewNames"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ground Crew Names</FormLabel>
                      <FormControl>
                        <Input placeholder="Names of ground crew involved" {...field} data-testid="input-ground-crew" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="vehicleInvolved"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vehicle Involved</FormLabel>
                      <FormControl>
                        <Input placeholder="Type and ID of vehicle" {...field} data-testid="input-vehicle" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="damageType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Damage Type</FormLabel>
                      <FormControl>
                        <Input placeholder="Description of damage" {...field} data-testid="input-damage-type" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Incident Description *</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Describe the ramp incident..." 
                          className="min-h-32 resize-y" 
                          {...field} 
                          data-testid="textarea-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="correctiveSteps"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Corrective Steps</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="What corrective steps were taken?" 
                          className="min-h-24 resize-y" 
                          {...field} 
                          data-testid="textarea-corrective-steps"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {/* NCR Fields */}
            {type === 'ncr' && (
              <>
                <FormField
                  control={form.control}
                  name="department"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Flight Operations, Maintenance" {...field} data-testid="input-department" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="nonconformityType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nonconformity Type *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Procedural violation, Safety standard" {...field} data-testid="input-nonconformity-type" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nonconformity Description *</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Describe the nonconformity..." 
                          className="min-h-32 resize-y" 
                          {...field} 
                          data-testid="textarea-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="rootCause"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Root Cause *</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="What is the root cause?" 
                          className="min-h-24 resize-y" 
                          {...field} 
                          data-testid="textarea-root-cause"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="responsiblePerson"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Responsible Person</FormLabel>
                      <FormControl>
                        <Input placeholder="Name or role" {...field} data-testid="input-responsible-person" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="preventiveActions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preventive Actions</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="What preventive actions are recommended?" 
                          className="min-h-24 resize-y" 
                          {...field} 
                          data-testid="textarea-preventive-actions"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {/* CDF Fields */}
            {type === 'cdf' && (
              <>
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Situation Description *</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Describe the situation requiring commander's discretion..." 
                          className="min-h-32 resize-y" 
                          {...field} 
                          data-testid="textarea-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="discretionReason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reason for Discretion *</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Why was discretion necessary?" 
                          className="min-h-24 resize-y" 
                          {...field} 
                          data-testid="textarea-discretion-reason"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="timeExtension"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Time Extension</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., +2 hours" {...field} data-testid="input-time-extension" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="crewFatigueDetails"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Crew Fatigue Details</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Details about crew fatigue considerations..." 
                          className="min-h-24 resize-y" 
                          {...field} 
                          data-testid="textarea-crew-fatigue"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="finalDecision"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Final Decision *</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="What was the final decision and justification?" 
                          className="min-h-24 resize-y" 
                          {...field} 
                          data-testid="textarea-final-decision"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {/* CHR Fields */}
            {type === 'chr' && (
              <>
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hazard Description *</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Describe the safety hazard..." 
                          className="min-h-32 resize-y" 
                          {...field} 
                          data-testid="textarea-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="potentialImpact"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Potential Impact *</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="What is the potential impact of this hazard?" 
                          className="min-h-24 resize-y" 
                          {...field} 
                          data-testid="textarea-potential-impact"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="preventionSuggestions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prevention Suggestions</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="What suggestions do you have for prevention?" 
                          className="min-h-24 resize-y" 
                          {...field} 
                          data-testid="textarea-prevention-suggestions"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            <div className="flex gap-4 pt-4">
              <Button 
                type="submit" 
                disabled={createReportMutation.isPending}
                data-testid="button-submit-report"
              >
                <Save className="h-4 w-4 mr-2" />
                {createReportMutation.isPending ? "Submitting..." : "Submit Report"}
              </Button>
              <Button type="button" variant="outline" asChild data-testid="button-cancel">
                <Link href="/reports">Cancel</Link>
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
