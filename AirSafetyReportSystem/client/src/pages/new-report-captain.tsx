import { useMemo, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/useAuth";
import { canCreateReports } from "@/lib/roles";
import { useToast } from "@/hooks/use-toast";
import { useLocation, Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInputDDMMYYYY } from "@/components/ui/date-input-ddmmyyyy";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const schema = z.object({
  aircraftReg: z.string().optional(),
  flightNumber: z.string().optional(),
  dateOfFlight: z.string().optional(),
  captainEmail: z.string().optional(),
  captainReport: z.string().optional(),
  captainComments: z.string().optional(),
  // New fields
  cm1: z.string().optional(),
  cm2: z.string().optional(),
  chiefCabin: z.string().optional(),
  aircraftType: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function NewReportCaptain() {
  const { user } = useAuth();
  const canCreate = useMemo(() => canCreateReports(user?.role) || user?.role === "admin", [user?.role]);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState<(() => void) | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      aircraftReg: "",
      flightNumber: "",
      dateOfFlight: "",
      captainEmail: user?.email || "",
      captainReport: "",
      cm1: "",
      cm2: "",
      chiefCabin: "",
      aircraftType: "",
    },
  });

  useEffect(() => {
    if (user?.email) {
      form.setValue("captainEmail", user.email);
    }
  }, [user?.email, form]);

  const onSubmit = async (data: FormData) => {
    if (!canCreate) {
      toast({ title: "Not allowed", description: "You are not allowed to create reports", variant: "destructive" });
      return;
    }

    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No token");

      const payload: any = {
        reportType: "captain",
        description: data.captainReport || "Captain report",
        flightNumber: data.flightNumber || undefined,
        eventDateTime: data.dateOfFlight ? new Date(`${data.dateOfFlight}T00:00:00`).toISOString() : undefined,
        extraData: {
          aircraftReg: data.aircraftReg || "",
          captainEmail: user?.email || data.captainEmail || "",
          cm1: data.cm1 || "",
          cm2: data.cm2 || "",
          chiefCabin: data.chiefCabin || "",
          aircraftType: data.aircraftType || "",
        },
      };

      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to create report");
      }

      const created = await res.json();
      toast({ title: "Submitted", description: "Captain report created successfully" });
      setLocation(`/reports/${created.id}`);
    } catch (e: any) {
      toast({ title: "Submission failed", description: e?.message || "Please try again", variant: "destructive" });
    }
  };

  if (!canCreate) {
    return (
      <div className="flex-1 overflow-auto">
        <div className="container max-w-5xl mx-auto p-6">
          <Card className="p-6">You are not allowed to create reports.</Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="container max-w-5xl mx-auto p-3 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2 sm:mb-3">
          <h1 className="text-xl sm:text-2xl font-semibold">Captain Report (CR)</h1>
          <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
            <Link href="/reports">Back to Reports</Link>
          </Button>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
            {/* Flight Information */}
            <Card className="p-4 sm:p-6 space-y-4">
              <h2 className="font-semibold text-lg">Flight Information</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="aircraftReg"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Aircraft reg</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. 5A-ONB" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="flightNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Flight number</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. 8U123" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dateOfFlight"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of flight</FormLabel>
                      <FormControl>
                        <DateInputDDMMYYYY
                          value={field.value}
                          onChange={field.onChange}
                        />
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
                      <FormLabel>Aircraft Type</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. A320" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="captainEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Captain email</FormLabel>
                      <FormControl>
                        <Input type="email" disabled readOnly placeholder="captain@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </Card>

            {/* Crew Information */}
            <Card className="p-4 sm:p-6 space-y-4">
              <h2 className="font-semibold text-lg">Crew Information</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="cm1"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CM 1</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. CM001" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="cm2"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CM 2</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. CM002" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="chiefCabin"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Chief Cabin</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Chief Cabin Name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </Card>

            {/* Report Details */}
            <Card className="p-4 sm:p-6 space-y-4">
              <h2 className="font-semibold text-lg">Report Details</h2>
              <FormField
                control={form.control}
                name="captainReport"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Captain report</FormLabel>
                    <FormControl>
                      <Textarea rows={6} placeholder="Write the captain report..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </Card>

            {/* Submit Button */}
            <div className="flex justify-end">
              <Button 
                type="button" 
                disabled={form.formState.isSubmitting}
                onClick={form.handleSubmit((data) => {
                  setPendingSubmit(() => () => onSubmit(data));
                  setShowConfirmDialog(true);
                })}
              >
                {form.formState.isSubmitting ? "Submitting..." : "Submit"}
              </Button>
            </div>
          </form>

          <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirm Submission</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to submit this Captain Report (CR)? The report will be saved and submitted to the system.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    setShowConfirmDialog(false);
                    if (pendingSubmit) {
                      pendingSubmit();
                      setPendingSubmit(null);
                    }
                  }}
                >
                  Confirm Submit
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </Form>
      </div>
    </div>
  );
}