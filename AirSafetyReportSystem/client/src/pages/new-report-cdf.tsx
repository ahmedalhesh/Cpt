import { useMemo, useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLocation, Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { TimeInput24 } from "@/components/ui/time-input-24";
import { DateInputDDMMYYYY } from "@/components/ui/date-input-ddmmyyyy";
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

const schema = z.object({
  // Part A
  airline: z.string().optional(),
  aircraftType: z.string().optional(),
  flightNumber: z.string().optional(),
  commander: z.string().optional(),
  date: z.string().optional(),

  // Discretion type
  type: z.enum(["extension", "reduction"]).default("extension"),

  // Part B - Extension
  crewAcclimatised: z.boolean().optional(),
  precedingRestGroup: z.enum(["18to30", "under18", "over30"]).nullable().optional(),
  fdpFromTable: z.string().optional(),
  splitDutyTimeOff: z.string().optional(),
  splitDutyTimeOn: z.string().optional(),
  splitDutyCredit: z.string().optional(),
  inflightReliefRest: z.string().optional(),
  inflightReliefSeat: z.string().optional(),
  inflightReliefCredit: z.string().optional(),
  revisedAllowableFdp: z.string().optional(),

  // Voyage details table (simplified as arrays)
  legs: z.array(
    z.object({
      place: z.string().optional(),
      utcPlanned: z.string().optional(),
      localPlanned: z.string().optional(),
      utcActual: z.string().optional(),
      localActual: z.string().optional(),
      label: z.string().optional(),
    })
  ).optional(),

  amountDiscretionHrs: z.string().optional(),
  amountDiscretionMins: z.string().optional(),
  maxFlyingHoursNote: z.string().optional(),

  // Part C
  remarksActionTaken: z.string().optional(),
  
  signed1Date: z.string().optional(),
  
  signed2Date: z.string().optional(),
  forwardedToCAA: z.boolean().optional(),
  filed: z.boolean().optional(),

  // Reduction of Rest specific
  lastDutyStartedUtcDate: z.string().optional(),
  lastDutyStartedUtcTime: z.string().optional(),
  lastDutyStartedLocalDate: z.string().optional(),
  lastDutyStartedLocalTime: z.string().optional(),
  lastDutyEndedUtcDate: z.string().optional(),
  lastDutyEndedUtcTime: z.string().optional(),
  lastDutyEndedLocalDate: z.string().optional(),
  lastDutyEndedLocalTime: z.string().optional(),
  restEarnedHours: z.string().optional(),
  calculatedEarliestNextAvailableUtcDate: z.string().optional(),
  calculatedEarliestNextAvailableUtcTime: z.string().optional(),
  calculatedEarliestNextAvailableLocalDate: z.string().optional(),
  calculatedEarliestNextAvailableLocalTime: z.string().optional(),
  actualStartNextFdpUtcDate: z.string().optional(),
  actualStartNextFdpUtcTime: z.string().optional(),
  actualStartNextFdpLocalDate: z.string().optional(),
  actualStartNextFdpLocalTime: z.string().optional(),
  restReducedBy: z.string().optional(),
  crewAffected: z.string().optional(),
  
  // Legacy fields for backward compatibility (will be combined from date+time)
  lastDutyStartedUtc: z.string().optional(),
  lastDutyStartedLocal: z.string().optional(),
  lastDutyEndedUtc: z.string().optional(),
  lastDutyEndedLocal: z.string().optional(),
  calculatedEarliestNextAvailableUtc: z.string().optional(),
  calculatedEarliestNextAvailableLocal: z.string().optional(),
  actualStartNextFdpUtc: z.string().optional(),
  actualStartNextFdpLocal: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function NewReportCDF() {
  const { user } = useAuth();
  const canCreate = useMemo(() => user?.role === 'captain' || user?.role === 'first_officer', [user?.role]);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState<(() => void) | null>(null);

  const { register, handleSubmit, setValue, watch, control, formState: { isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: 'extension',
      precedingRestGroup: undefined,
      restEarnedHours: '12', // Default Rest Earned to 12 hours
      legs: [
        { label: 'Duty to start' },
        { label: 'Depart' },
        { label: 'Arrive' },
        { label: 'Depart' },
        { label: 'Arrive' },
        { label: 'Depart' },
        { label: 'Arrive' },
        { label: 'Depart' },
        { label: 'Arrive' },
        { label: 'FDP to end' },
        { label: 'Actual FDP' },
      ],
    },
  });

  // Helper function to convert time string (HH:MM) to minutes
  const timeToMinutes = (timeStr: string | undefined): number | null => {
    if (!timeStr || !timeStr.includes(':')) return null;
    const [hours, minutes] = timeStr.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return null;
    return hours * 60 + minutes;
  };

  // Helper function to parse Revised Allowable FDP (can be HH:MM or hours as decimal/whole number)
  const parseRevisedFdp = (fdpStr: string | undefined): number | null => {
    if (!fdpStr) return null;
    // Try HH:MM format first
    if (fdpStr.includes(':')) {
      return timeToMinutes(fdpStr);
    }
    // Try decimal hours (e.g., "14.5" = 14 hours 30 minutes)
    const hours = parseFloat(fdpStr);
    if (!isNaN(hours)) {
      return Math.floor(hours) * 60 + Math.round((hours % 1) * 60);
    }
    return null;
  };

  // Helper function to convert DD/MM/YYYY to YYYY-MM-DD
  const convertDDMMYYYYToISO = (dateStr: string | undefined): string | null => {
    if (!dateStr) return null;
    // Check if already in ISO format (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    // Convert DD/MM/YYYY to YYYY-MM-DD
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;
    const [day, month, year] = parts;
    if (day.length !== 2 || month.length !== 2 || year.length !== 4) return null;
    return `${year}-${month}-${day}`;
  };

  // Helper function to combine date and time strings into datetime string
  const combineDateAndTime = (date: string | undefined, time: string | undefined): string | null => {
    if (!date || !time) return null;
    // Time should be in HH:MM format
    if (!time.includes(':')) return null;
    // Convert DD/MM/YYYY to ISO format for Date parsing
    const isoDate = convertDDMMYYYYToISO(date);
    if (!isoDate) return null;
    return `${isoDate}T${time}:00`;
  };

  // Helper function to convert datetime string to minutes (since midnight UTC of that day)
  const datetimeToMinutes = (dateTimeStr: string | undefined): number | null => {
    if (!dateTimeStr) return null;
    try {
      const date = new Date(dateTimeStr);
      if (isNaN(date.getTime())) return null;
      // Extract hours and minutes from the datetime
      const hours = date.getUTCHours();
      const minutes = date.getUTCMinutes();
      return hours * 60 + minutes;
    } catch {
      return null;
    }
  };
  
  // Helper to split datetime string into date and time
  const splitDateTime = (dateTimeStr: string | undefined): { date: string; time: string } | null => {
    if (!dateTimeStr) return null;
    try {
      const date = new Date(dateTimeStr);
      if (isNaN(date.getTime())) return null;
      const datePart = date.toISOString().split('T')[0];
      const timePart = date.toTimeString().slice(0, 5); // HH:MM
      return { date: datePart, time: timePart };
    } catch {
      return null;
    }
  };

  // Helper function to calculate difference between two times in minutes
  const calculateTimeDifference = (startTime: string | undefined, endTime: string | undefined, isDateTime: boolean = false): { hours: number; minutes: number } | null => {
    const getMinutes = isDateTime ? datetimeToMinutes : timeToMinutes;
    const startMins = getMinutes(startTime);
    const endMins = getMinutes(endTime);
    
    if (startMins === null || endMins === null) return null;
    
    // Handle day crossover (if end time is earlier, assume next day)
    let diffMins = endMins - startMins;
    if (diffMins < 0) {
      diffMins += 24 * 60; // Add 24 hours
    }
    
    return {
      hours: Math.floor(diffMins / 60),
      minutes: diffMins % 60,
    };
  };

  // Calculate Commander's Discretion for Extension type
  // Commander's Discretion = Actual FDP Duration - Revised Allowable FDP
  const calculatedExtension = useMemo(() => {
    const legs = watch('legs');
    const revisedFdp = watch('revisedAllowableFdp');
    
    if (!legs || legs.length < 11) return null;
    
    // Find "Duty to start" (usually index 0) and "Actual FDP" (usually index 10)
    const dutyToStart = legs[0];
    const actualFdp = legs[10];
    
    // Use Actual times if available, otherwise fallback to Planned
    const dutyStartTime = dutyToStart?.utcActual || dutyToStart?.utcPlanned;
    const actualFdpTime = actualFdp?.utcActual || actualFdp?.utcPlanned;
    
    if (!dutyStartTime || !actualFdpTime) return null;
    
    // Calculate Actual FDP Duration (from Duty to Start to Actual FDP)
    const actualFdpDuration = calculateTimeDifference(dutyStartTime, actualFdpTime, false);
    if (!actualFdpDuration) return null;
    
    // Convert to minutes
    const actualFdpMins = actualFdpDuration.hours * 60 + actualFdpDuration.minutes;
    
    // Parse Revised Allowable FDP
    const revisedFdpMins = parseRevisedFdp(revisedFdp);
    if (revisedFdpMins === null) {
      // If Revised FDP not provided, return actual FDP duration as reference
      return actualFdpDuration;
    }
    
    // Commander's Discretion = Actual FDP - Revised Allowable FDP
    const discretionMins = actualFdpMins - revisedFdpMins;
    
    // Only show if there's an extension (positive difference)
    if (discretionMins <= 0) return null;
    
    return {
      hours: Math.floor(discretionMins / 60),
      minutes: discretionMins % 60,
    };
  }, [watch('legs'), watch('revisedAllowableFdp')]);

  // Calculate "Calculated Earliest Next Available" automatically for Reduction type
  const calculatedEarliestNextAvailable = useMemo(() => {
    const lastDutyEndedUtcDate = watch('lastDutyEndedUtcDate');
    const lastDutyEndedUtcTime = watch('lastDutyEndedUtcTime');
    const lastDutyEndedLocalDate = watch('lastDutyEndedLocalDate');
    const lastDutyEndedLocalTime = watch('lastDutyEndedLocalTime');
    const restEarnedHours = watch('restEarnedHours');
    
    // Use Rest Earned Hours (default to 12 if not provided)
    const restHours = restEarnedHours ? parseFloat(restEarnedHours) : 12;
    if (isNaN(restHours) || restHours <= 0) return null;
    
    // Combine Last Duty Ended UTC date and time
    const lastDutyEndedUtc = combineDateAndTime(lastDutyEndedUtcDate, lastDutyEndedUtcTime);
    const lastDutyEndedLocal = combineDateAndTime(lastDutyEndedLocalDate, lastDutyEndedLocalTime);
    
    if (!lastDutyEndedUtc) return null;
    
    try {
      // Calculate UTC: Last Duty Ended + Rest Earned Hours
      const lastDutyEndedUtcDateObj = new Date(lastDutyEndedUtc);
      if (isNaN(lastDutyEndedUtcDateObj.getTime())) return null;
      
      const calculatedUtcDateObj = new Date(lastDutyEndedUtcDateObj);
      calculatedUtcDateObj.setHours(calculatedUtcDateObj.getHours() + Math.floor(restHours));
      calculatedUtcDateObj.setMinutes(calculatedUtcDateObj.getMinutes() + Math.round((restHours % 1) * 60));
      
      // Format UTC result
      const calculatedUtcDate = calculatedUtcDateObj.toISOString().split('T')[0]; // YYYY-MM-DD
      const calculatedUtcTime = calculatedUtcDateObj.toTimeString().slice(0, 5); // HH:MM
      
      // Calculate Local: Last Duty Ended Local + Rest Earned Hours
      let calculatedLocalDate: string | null = null;
      let calculatedLocalTime: string | null = null;
      
      if (lastDutyEndedLocal) {
        const lastDutyEndedLocalDateObj = new Date(lastDutyEndedLocal);
        if (!isNaN(lastDutyEndedLocalDateObj.getTime())) {
          const calculatedLocalDateObj = new Date(lastDutyEndedLocalDateObj);
          calculatedLocalDateObj.setHours(calculatedLocalDateObj.getHours() + Math.floor(restHours));
          calculatedLocalDateObj.setMinutes(calculatedLocalDateObj.getMinutes() + Math.round((restHours % 1) * 60));
          
          // Format Local result (need to convert to DD/MM/YYYY format)
          const localYear = calculatedLocalDateObj.getFullYear();
          const localMonth = String(calculatedLocalDateObj.getMonth() + 1).padStart(2, '0');
          const localDay = String(calculatedLocalDateObj.getDate()).padStart(2, '0');
          calculatedLocalDate = `${localDay}/${localMonth}/${localYear}`;
          calculatedLocalTime = calculatedLocalDateObj.toTimeString().slice(0, 5);
        }
      }
      
      // Format UTC date to DD/MM/YYYY
      const utcYear = calculatedUtcDateObj.getFullYear();
      const utcMonth = String(calculatedUtcDateObj.getMonth() + 1).padStart(2, '0');
      const utcDay = String(calculatedUtcDateObj.getDate()).padStart(2, '0');
      const formattedUtcDate = `${utcDay}/${utcMonth}/${utcYear}`;
      
      return {
        utc: {
          date: formattedUtcDate,
          time: calculatedUtcTime,
        },
        local: calculatedLocalDate && calculatedLocalTime ? {
          date: calculatedLocalDate,
          time: calculatedLocalTime,
        } : null,
      };
    } catch {
      return null;
    }
  }, [
    watch('lastDutyEndedUtcDate'),
    watch('lastDutyEndedUtcTime'),
    watch('lastDutyEndedLocalDate'),
    watch('lastDutyEndedLocalTime'),
    watch('restEarnedHours'),
  ]);

  // Auto-update Calculated Earliest Next Available fields when calculation changes
  useEffect(() => {
    const type = watch('type');
    if (type === 'reduction' && calculatedEarliestNextAvailable) {
      // Update UTC fields
      if (calculatedEarliestNextAvailable.utc) {
        setValue('calculatedEarliestNextAvailableUtcDate', calculatedEarliestNextAvailable.utc.date, { shouldValidate: false, shouldDirty: false });
        setValue('calculatedEarliestNextAvailableUtcTime', calculatedEarliestNextAvailable.utc.time, { shouldValidate: false, shouldDirty: false });
      }
      
      // Update Local fields
      if (calculatedEarliestNextAvailable.local) {
        setValue('calculatedEarliestNextAvailableLocalDate', calculatedEarliestNextAvailable.local.date, { shouldValidate: false, shouldDirty: false });
        setValue('calculatedEarliestNextAvailableLocalTime', calculatedEarliestNextAvailable.local.time, { shouldValidate: false, shouldDirty: false });
      }
    }
  }, [calculatedEarliestNextAvailable, watch('type'), setValue]);

  // Calculate Commander's Discretion for Reduction type
  const calculatedReduction = useMemo(() => {
    // Combine date and time fields
    const calculatedEarliestDate = watch('calculatedEarliestNextAvailableUtcDate');
    const calculatedEarliestTime = watch('calculatedEarliestNextAvailableUtcTime');
    const actualStartDate = watch('actualStartNextFdpUtcDate');
    const actualStartTime = watch('actualStartNextFdpUtcTime');
    
    const calculatedEarliest = combineDateAndTime(calculatedEarliestDate, calculatedEarliestTime) || watch('calculatedEarliestNextAvailableUtc');
    const actualStart = combineDateAndTime(actualStartDate, actualStartTime) || watch('actualStartNextFdpUtc');
    
    if (!calculatedEarliest || !actualStart) return null;
    
    // For reduction: Actual Start - Calculated Earliest (the reduction is how much earlier they started)
    const diff = calculateTimeDifference(calculatedEarliest, actualStart, true);
    if (!diff) return null;
    
    // The reduction is the negative difference (or we can show it as positive)
    // If actual start is before calculated earliest, that's the reduction
    try {
      const calcDate = new Date(calculatedEarliest);
      const actualDate = new Date(actualStart);
      if (isNaN(calcDate.getTime()) || isNaN(actualDate.getTime())) return null;
      
      const diffMs = actualDate.getTime() - calcDate.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      
      if (diffMins < 0) {
        // Actual is before calculated, so there's a reduction
        const absMins = Math.abs(diffMins);
        return {
          hours: Math.floor(absMins / 60),
          minutes: absMins % 60,
        };
      }
      return null;
    } catch {
      return null;
    }
  }, [
    watch('calculatedEarliestNextAvailableUtcDate'), watch('calculatedEarliestNextAvailableUtcTime'),
    watch('actualStartNextFdpUtcDate'), watch('actualStartNextFdpUtcTime'),
    watch('calculatedEarliestNextAvailableUtc'), watch('actualStartNextFdpUtc')
  ]);

  // Auto-calculate and update discretion amount in real-time when values change
  useEffect(() => {
    const type = watch('type');
    
    // Update in real-time based on calculated values
    if (type === 'extension' && calculatedExtension) {
      setValue('amountDiscretionHrs', calculatedExtension.hours.toString(), { shouldValidate: false, shouldDirty: false });
      setValue('amountDiscretionMins', calculatedExtension.minutes.toString(), { shouldValidate: false, shouldDirty: false });
    } else if (type === 'reduction' && calculatedReduction) {
      setValue('amountDiscretionHrs', calculatedReduction.hours.toString(), { shouldValidate: false, shouldDirty: false });
      setValue('amountDiscretionMins', calculatedReduction.minutes.toString(), { shouldValidate: false, shouldDirty: false });
    } else if ((type === 'extension' && !calculatedExtension) || (type === 'reduction' && !calculatedReduction)) {
      // Clear fields if calculation is not available
      setValue('amountDiscretionHrs', '', { shouldValidate: false, shouldDirty: false });
      setValue('amountDiscretionMins', '', { shouldValidate: false, shouldDirty: false });
    }
  }, [calculatedExtension, calculatedReduction, watch('type'), setValue]);

  // Auto-update "Rest Period Reduced By" field for Reduction type
  useEffect(() => {
    const type = watch('type');
    if (type === 'reduction' && calculatedReduction) {
      // Format as "X hours" or "X hours Y minutes"
      let formattedValue = '';
      if (calculatedReduction.hours > 0 && calculatedReduction.minutes > 0) {
        formattedValue = `${calculatedReduction.hours} hour${calculatedReduction.hours > 1 ? 's' : ''} ${calculatedReduction.minutes} minute${calculatedReduction.minutes > 1 ? 's' : ''}`;
      } else if (calculatedReduction.hours > 0) {
        formattedValue = `${calculatedReduction.hours} hour${calculatedReduction.hours > 1 ? 's' : ''}`;
      } else if (calculatedReduction.minutes > 0) {
        formattedValue = `${calculatedReduction.minutes} minute${calculatedReduction.minutes > 1 ? 's' : ''}`;
      }
      
      if (formattedValue) {
        setValue('restReducedBy', formattedValue, { shouldValidate: false, shouldDirty: false });
      }
    } else if (type === 'reduction' && !calculatedReduction) {
      // Clear field if calculation is not available
      setValue('restReducedBy', '', { shouldValidate: false, shouldDirty: false });
    }
  }, [calculatedReduction, watch('type'), setValue]);

  // Force re-calculation when legs array changes (to ensure real-time updates)
  const legsValue = watch('legs');
  useEffect(() => {
    // This effect ensures that changes to legs array trigger recalculation
    // The useMemo hooks above will automatically recalculate when legs change
  }, [legsValue]);

  // Watch all legs fields individually to ensure real-time updates
  const legs0UtcActual = watch('legs.0.utcActual');
  const legs0UtcPlanned = watch('legs.0.utcPlanned');
  const legs9UtcActual = watch('legs.9.utcActual');
  const legs9UtcPlanned = watch('legs.9.utcPlanned');
  const legs10UtcActual = watch('legs.10.utcActual');
  const legs10UtcPlanned = watch('legs.10.utcPlanned');
  
  // Watch all Arrive rows for real-time updates
  const legs1UtcActual = watch('legs.1.utcActual');
  const legs1UtcPlanned = watch('legs.1.utcPlanned');
  const legs3UtcActual = watch('legs.3.utcActual');
  const legs3UtcPlanned = watch('legs.3.utcPlanned');
  const legs5UtcActual = watch('legs.5.utcActual');
  const legs5UtcPlanned = watch('legs.5.utcPlanned');
  const legs7UtcActual = watch('legs.7.utcActual');
  const legs7UtcPlanned = watch('legs.7.utcPlanned');
  
  // Calculate Actual FDP Duration (from Duty to Start to FDP to End)
  const actualFdpDuration = useMemo(() => {
    const legs = watch('legs');
    if (!legs || legs.length < 11) return null;
    
    const dutyToStart = legs[0];
    const fdpToEnd = legs[9]; // FDP to end is at index 9
    const actualFdp = legs[10]; // Actual FDP is at index 10
    
    // Use Actual times if available, otherwise Planned
    const dutyStartTime = dutyToStart?.utcActual || dutyToStart?.utcPlanned;
    let fdpEndTime: string | undefined = undefined;
    
    // Priority: Actual FDP row > FDP to end row > last Arrive row
    if (actualFdp?.utcActual) {
      fdpEndTime = actualFdp.utcActual;
    } else if (actualFdp?.utcPlanned) {
      fdpEndTime = actualFdp.utcPlanned;
    } else if (fdpToEnd?.utcActual) {
      fdpEndTime = fdpToEnd.utcActual;
    } else if (fdpToEnd?.utcPlanned) {
      fdpEndTime = fdpToEnd.utcPlanned;
    } else {
      // Find last "Arrive" row before "FDP to end"
      for (let i = 8; i >= 1; i--) {
        const row = legs[i];
        if (row?.label === 'Arrive') {
          fdpEndTime = row.utcActual || row.utcPlanned;
          if (fdpEndTime) break;
        }
      }
    }
    
    if (!dutyStartTime || !fdpEndTime) return null;
    
    return calculateTimeDifference(dutyStartTime, fdpEndTime, false);
  }, [
    legs0UtcActual, legs0UtcPlanned,
    legs9UtcActual, legs9UtcPlanned,
    legs10UtcActual, legs10UtcPlanned,
    legs1UtcActual, legs1UtcPlanned,
    legs3UtcActual, legs3UtcPlanned,
    legs5UtcActual, legs5UtcPlanned,
    legs7UtcActual, legs7UtcPlanned,
    watch('legs')
  ]);

  // Calculate Block Time for each leg (Depart → Arrive)
  const blockTimes = useMemo(() => {
    const legs = watch('legs');
    if (!legs || legs.length < 11) return [];
    
    const times: Array<{ label: string; blockTime: { hours: number; minutes: number } | null }> = [];
    
    // Find all Depart/Arrive pairs
    for (let i = 1; i < legs.length - 2; i++) {
      const leg = legs[i];
      if (leg.label === 'Depart') {
        const nextLeg = legs[i + 1];
        if (nextLeg?.label === 'Arrive') {
          const blockTime = calculateTimeDifference(
            leg.utcActual || leg.utcPlanned,
            nextLeg.utcActual || nextLeg.utcPlanned,
            false
          );
          times.push({
            label: `${leg.place || 'Depart'} → ${nextLeg.place || 'Arrive'}`,
            blockTime,
          });
        }
      }
    }
    
    return times;
  }, [watch('legs')]);

  // Calculate Total Block Time
  const totalBlockTime = useMemo(() => {
    if (blockTimes.length === 0) return null;
    
    let totalMinutes = 0;
    for (const { blockTime } of blockTimes) {
      if (blockTime) {
        totalMinutes += blockTime.hours * 60 + blockTime.minutes;
      }
    }
    
    if (totalMinutes === 0) return null;
    
    return {
      hours: Math.floor(totalMinutes / 60),
      minutes: totalMinutes % 60,
    };
  }, [blockTimes]);

  // Combine date and time fields into datetime strings for backward compatibility
  useEffect(() => {
    // Last Duty Started UTC
    const startedUtcDate = watch('lastDutyStartedUtcDate');
    const startedUtcTime = watch('lastDutyStartedUtcTime');
    if (startedUtcDate || startedUtcTime) {
      const combined = combineDateAndTime(startedUtcDate, startedUtcTime);
      setValue('lastDutyStartedUtc', combined || '', { shouldValidate: false, shouldDirty: false });
    }

    // Last Duty Started Local
    const startedLocalDate = watch('lastDutyStartedLocalDate');
    const startedLocalTime = watch('lastDutyStartedLocalTime');
    if (startedLocalDate || startedLocalTime) {
      const combined = combineDateAndTime(startedLocalDate, startedLocalTime);
      setValue('lastDutyStartedLocal', combined || '', { shouldValidate: false, shouldDirty: false });
    }

    // Last Duty Ended UTC
    const endedUtcDate = watch('lastDutyEndedUtcDate');
    const endedUtcTime = watch('lastDutyEndedUtcTime');
    if (endedUtcDate || endedUtcTime) {
      const combined = combineDateAndTime(endedUtcDate, endedUtcTime);
      setValue('lastDutyEndedUtc', combined || '', { shouldValidate: false, shouldDirty: false });
    }

    // Last Duty Ended Local
    const endedLocalDate = watch('lastDutyEndedLocalDate');
    const endedLocalTime = watch('lastDutyEndedLocalTime');
    if (endedLocalDate || endedLocalTime) {
      const combined = combineDateAndTime(endedLocalDate, endedLocalTime);
      setValue('lastDutyEndedLocal', combined || '', { shouldValidate: false, shouldDirty: false });
    }

    // Calculated Earliest Next Available UTC
    const calcEarliestUtcDate = watch('calculatedEarliestNextAvailableUtcDate');
    const calcEarliestUtcTime = watch('calculatedEarliestNextAvailableUtcTime');
    if (calcEarliestUtcDate || calcEarliestUtcTime) {
      const combined = combineDateAndTime(calcEarliestUtcDate, calcEarliestUtcTime);
      setValue('calculatedEarliestNextAvailableUtc', combined || '', { shouldValidate: false, shouldDirty: false });
    }

    // Calculated Earliest Next Available Local
    const calcEarliestLocalDate = watch('calculatedEarliestNextAvailableLocalDate');
    const calcEarliestLocalTime = watch('calculatedEarliestNextAvailableLocalTime');
    if (calcEarliestLocalDate || calcEarliestLocalTime) {
      const combined = combineDateAndTime(calcEarliestLocalDate, calcEarliestLocalTime);
      setValue('calculatedEarliestNextAvailableLocal', combined || '', { shouldValidate: false, shouldDirty: false });
    }

    // Actual Start Next FDP UTC
    const actualStartUtcDate = watch('actualStartNextFdpUtcDate');
    const actualStartUtcTime = watch('actualStartNextFdpUtcTime');
    if (actualStartUtcDate || actualStartUtcTime) {
      const combined = combineDateAndTime(actualStartUtcDate, actualStartUtcTime);
      setValue('actualStartNextFdpUtc', combined || '', { shouldValidate: false, shouldDirty: false });
    }

    // Actual Start Next FDP Local
    const actualStartLocalDate = watch('actualStartNextFdpLocalDate');
    const actualStartLocalTime = watch('actualStartNextFdpLocalTime');
    if (actualStartLocalDate || actualStartLocalTime) {
      const combined = combineDateAndTime(actualStartLocalDate, actualStartLocalTime);
      setValue('actualStartNextFdpLocal', combined || '', { shouldValidate: false, shouldDirty: false });
    }
  }, [
    watch('lastDutyStartedUtcDate'), watch('lastDutyStartedUtcTime'),
    watch('lastDutyStartedLocalDate'), watch('lastDutyStartedLocalTime'),
    watch('lastDutyEndedUtcDate'), watch('lastDutyEndedUtcTime'),
    watch('lastDutyEndedLocalDate'), watch('lastDutyEndedLocalTime'),
    watch('calculatedEarliestNextAvailableUtcDate'), watch('calculatedEarliestNextAvailableUtcTime'),
    watch('calculatedEarliestNextAvailableLocalDate'), watch('calculatedEarliestNextAvailableLocalTime'),
    watch('actualStartNextFdpUtcDate'), watch('actualStartNextFdpUtcTime'),
    watch('actualStartNextFdpLocalDate'), watch('actualStartNextFdpLocalTime'),
    setValue
  ]);


  const onSubmit = async (data: FormData) => {
    if (!canCreate) {
      toast({ title: 'Not allowed', description: 'Admins cannot create reports', variant: 'destructive' });
      return;
    }

    const summary: string[] = [];
    summary.push(`Commander Discretion (${data.type === 'extension' ? 'Extension of FDP/FH' : 'Reduction of Rest'})`);
    if (data.flightNumber) summary.push(`Flight: ${data.flightNumber}`);
    if (data.date) summary.push(`Date: ${data.date}`);
    if (data.aircraftType) summary.push(`AC Type: ${data.aircraftType}`);
    if (data.remarksActionTaken) summary.push(`Remarks: ${data.remarksActionTaken}`);

    const payload = {
      reportType: 'cdf',
      description: summary.join('\n'),
      flightNumber: data.flightNumber,
      aircraftType: data.aircraftType,
      eventDateTime: data.date ? new Date(`${data.date}T00:00:00`).toISOString() : undefined,
      extraData: data,
    } as any;

    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token');
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to create report');
      }
      const created = await res.json();
      toast({ title: 'Submitted', description: 'CDR created successfully' });
      setLocation(`/reports/${created.id}`);
    } catch (e: any) {
      toast({ title: 'Submission failed', description: e.message || 'Please try again', variant: 'destructive' });
    }
  };

  if (!canCreate) {
    return (
      <div className="flex-1 overflow-auto">
        <div className="container max-w-5xl mx-auto p-6">
          <Card className="p-6">Admins are not allowed to create reports.</Card>
        </div>
      </div>
    );
  }

  const type = watch('type');

  return (
    <div className="flex-1 overflow-auto">
      <div className="container max-w-6xl mx-auto p-3 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <h1 className="text-xl sm:text-2xl font-semibold">Commander's Discretion Report (CDR)</h1>
          <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
            <Link href="/reports">Back to Reports</Link>
          </Button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
          {/* Part A */}
          <Card className="p-4 sm:p-6 space-y-4">
            <h2 className="font-semibold">Part A</h2>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-sm">Airline</label>
                <Input {...register('airline')} />
              </div>
              <div>
                <label className="text-sm">Aircraft Type</label>
                <Input {...register('aircraftType')} />
              </div>
              <div>
                <label className="text-sm">Flight Number</label>
                <Input {...register('flightNumber')} />
              </div>
              <div>
                <label className="text-sm">Commander</label>
                <Input {...register('commander')} />
              </div>
              <div>
                <label className="text-sm">Date</label>
                <DateInputDDMMYYYY
                  value={watch('date')}
                  onChange={(val) => setValue('date', val)}
                />
              </div>
            </div>
          </Card>

          {/* Select CDR Type */}
          <Card className="p-4 sm:p-6">
            <div className="flex flex-wrap items-center gap-4">
              <label className="text-sm font-medium">Report Type</label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" value="extension" {...register('type')} defaultChecked /> Extension of FDP/Flying Hours
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" value="reduction" {...register('type')} /> Reduction of Rest
              </label>
            </div>
          </Card>

          {/* Part B - Extension */}
          {type === 'extension' && (
            <Card className="p-4 sm:p-6 space-y-6">
              <h2 className="font-semibold">Part B — Extension of FDP/Flying Hours</h2>
              
              {/* Crew & Rest Information */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">Crew & Rest Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox checked={!!watch('crewAcclimatised')} onCheckedChange={() => setValue('crewAcclimatised', !watch('crewAcclimatised'))} />
                      Crew Acclimatised
                    </label>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Length of Preceding Rest</label>
                    <Controller
                      name="precedingRestGroup"
                      control={control}
                      render={({ field }) => (
                        <div className="flex flex-wrap items-center gap-3 text-sm">
                          <label className="flex items-center gap-1">
                            <input 
                              type="radio" 
                              value="18to30" 
                              checked={field.value === "18to30"}
                              onChange={() => field.onChange("18to30")}
                              onBlur={field.onBlur}
                            />
                            18–30 hrs
                          </label>
                          <label className="flex items-center gap-1">
                            <input 
                              type="radio" 
                              value="under18" 
                              checked={field.value === "under18"}
                              onChange={() => field.onChange("under18")}
                              onBlur={field.onBlur}
                            />
                            Under 18 hrs
                          </label>
                          <label className="flex items-center gap-1">
                            <input 
                              type="radio" 
                              value="over30" 
                              checked={field.value === "over30"}
                              onChange={() => field.onChange("over30")}
                              onBlur={field.onBlur}
                            />
                            Over 30 hrs
                          </label>
                        </div>
                      )}
                    />
                  </div>
                </div>
              </div>

              {/* FDP Calculations */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">FDP Calculations</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Allowable FDP (Table A/B)</label>
                    <TimeInput24
                      value={watch('fdpFromTable')}
                      onChange={(val) => setValue('fdpFromTable', val)}
                      placeholder="e.g. 14:00"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Revised Allowable FDP</label>
                    <TimeInput24
                      value={watch('revisedAllowableFdp')}
                      onChange={(val) => setValue('revisedAllowableFdp', val)}
                      placeholder="e.g. 14:30"
                    />
                  </div>
                </div>
              </div>

              {/* Split Duty Credit */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">Split Duty Credit</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Time Off</label>
                    <TimeInput24
                      value={watch('splitDutyTimeOff')}
                      onChange={(val) => setValue('splitDutyTimeOff', val)}
                      placeholder="HH:MM"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Time On</label>
                    <TimeInput24
                      value={watch('splitDutyTimeOn')}
                      onChange={(val) => setValue('splitDutyTimeOn', val)}
                      placeholder="HH:MM"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Credit</label>
                    <TimeInput24
                      value={watch('splitDutyCredit')}
                      onChange={(val) => setValue('splitDutyCredit', val)}
                      placeholder="HH:MM"
                    />
                  </div>
                </div>
              </div>

              {/* In-Flight Relief Credit */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">In-Flight Relief Credit</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Rest Taken</label>
                    <TimeInput24
                      value={watch('inflightReliefRest')}
                      onChange={(val) => setValue('inflightReliefRest', val)}
                      placeholder="HH:MM"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Bunk/Seat</label>
                    <TimeInput24
                      value={watch('inflightReliefSeat')}
                      onChange={(val) => setValue('inflightReliefSeat', val)}
                      placeholder="HH:MM"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Credit</label>
                    <TimeInput24
                      value={watch('inflightReliefCredit')}
                      onChange={(val) => setValue('inflightReliefCredit', val)}
                      placeholder="HH:MM"
                    />
                  </div>
                </div>
              </div>

              {/* Voyage Details */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">Voyage Details <span className="text-xs text-muted-foreground font-normal">(24-hour format)</span></h3>
                <div className="overflow-auto">
                  <table className="w-full text-xs border border-border rounded-md">
                    <thead>
                      <tr className="bg-muted">
                        <th className="p-2 text-left border-r border-border">Label</th>
                        <th className="p-2 text-left border-r border-border">Place</th>
                        <th className="p-2 text-left border-r border-border">UTC (Planned)</th>
                        <th className="p-2 text-left border-r border-border">Local (Planned)</th>
                        <th className="p-2 text-left border-r border-border">UTC (Actual)</th>
                        <th className="p-2 text-left">Local (Actual)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {watch('legs')?.map((leg, idx) => {
                        // Check if this is "FDP to end" row (index 9) or "Actual FDP" row (index 10)
                        const isFdpToEndRow = idx === 9 && leg.label === 'FDP to end';
                        const isActualFdpRow = idx === 10 && leg.label === 'Actual FDP';
                        
                        // Calculate FDP Duration for "FDP to end" row (Planned only)
                        let calculatedFdpDurationStr: string | null = null;
                        
                        if (isFdpToEndRow) {
                          // Calculate FDP Duration for Planned times (UTC and Local) only
                          const dutyStartTimePlannedUtc = watch('legs.0.utcPlanned');
                          const dutyStartTimePlannedLocal = watch('legs.0.localPlanned');
                          
                          // Find FDP end time for Planned (UTC)
                          let fdpEndTimePlannedUtc: string | undefined = undefined;
                          const actualFdpPlannedUtc = watch('legs.10.utcPlanned');
                          const fdpToEndPlannedUtc = watch('legs.9.utcPlanned');
                          if (actualFdpPlannedUtc) {
                            fdpEndTimePlannedUtc = actualFdpPlannedUtc;
                          } else if (fdpToEndPlannedUtc) {
                            fdpEndTimePlannedUtc = fdpToEndPlannedUtc;
                          } else {
                            const allLegs = watch('legs');
                            for (let i = 8; i >= 1; i--) {
                              const row = allLegs?.[i];
                              if (row?.label === 'Arrive') {
                                fdpEndTimePlannedUtc = watch(`legs.${i}.utcPlanned`);
                                if (fdpEndTimePlannedUtc) break;
                              }
                            }
                          }
                          
                          // Find FDP end time for Planned (Local)
                          let fdpEndTimePlannedLocal: string | undefined = undefined;
                          const actualFdpPlannedLocal = watch('legs.10.localPlanned');
                          const fdpToEndPlannedLocal = watch('legs.9.localPlanned');
                          if (actualFdpPlannedLocal) {
                            fdpEndTimePlannedLocal = actualFdpPlannedLocal;
                          } else if (fdpToEndPlannedLocal) {
                            fdpEndTimePlannedLocal = fdpToEndPlannedLocal;
                          } else {
                            const allLegs = watch('legs');
                            for (let i = 8; i >= 1; i--) {
                              const row = allLegs?.[i];
                              if (row?.label === 'Arrive') {
                                fdpEndTimePlannedLocal = watch(`legs.${i}.localPlanned`);
                                if (fdpEndTimePlannedLocal) break;
                              }
                            }
                          }
                          
                          // Calculate durations for Planned only
                          let plannedUtcDuration: string | null = null;
                          if (dutyStartTimePlannedUtc && fdpEndTimePlannedUtc) {
                            const duration = calculateTimeDifference(dutyStartTimePlannedUtc, fdpEndTimePlannedUtc, false);
                            if (duration) {
                              plannedUtcDuration = `${duration.hours.toString().padStart(2, '0')}:${duration.minutes.toString().padStart(2, '0')}`;
                            }
                          }
                          
                          let plannedLocalDuration: string | null = null;
                          if (dutyStartTimePlannedLocal && fdpEndTimePlannedLocal) {
                            const duration = calculateTimeDifference(dutyStartTimePlannedLocal, fdpEndTimePlannedLocal, false);
                            if (duration) {
                              plannedLocalDuration = `${duration.hours.toString().padStart(2, '0')}:${duration.minutes.toString().padStart(2, '0')}`;
                            }
                          }
                          
                          // Use Planned UTC duration for Place column
                          calculatedFdpDurationStr = plannedUtcDuration;
                          
                          // Store calculated durations for each column
                          (leg as any).calculatedFdpPlannedUtc = plannedUtcDuration;
                          (leg as any).calculatedFdpPlannedLocal = plannedLocalDuration;
                        }
                        
                        // Calculate FDP Duration for "Actual FDP" row (Actual only)
                        if (isActualFdpRow) {
                          // Calculate FDP Duration for Actual times (UTC and Local) only
                          const dutyStartTimeActualUtc = watch('legs.0.utcActual');
                          const dutyStartTimeActualLocal = watch('legs.0.localActual');
                          
                          // Find FDP end time for Actual (UTC)
                          let fdpEndTimeActualUtc: string | undefined = undefined;
                          const actualFdpActualUtc = watch('legs.10.utcActual');
                          const fdpToEndActualUtc = watch('legs.9.utcActual');
                          if (actualFdpActualUtc) {
                            fdpEndTimeActualUtc = actualFdpActualUtc;
                          } else if (fdpToEndActualUtc) {
                            fdpEndTimeActualUtc = fdpToEndActualUtc;
                          } else {
                            const allLegs = watch('legs');
                            for (let i = 8; i >= 1; i--) {
                              const row = allLegs?.[i];
                              if (row?.label === 'Arrive') {
                                fdpEndTimeActualUtc = watch(`legs.${i}.utcActual`);
                                if (fdpEndTimeActualUtc) break;
                              }
                            }
                          }
                          
                          // Find FDP end time for Actual (Local)
                          let fdpEndTimeActualLocal: string | undefined = undefined;
                          const actualFdpActualLocal = watch('legs.10.localActual');
                          const fdpToEndActualLocal = watch('legs.9.localActual');
                          if (actualFdpActualLocal) {
                            fdpEndTimeActualLocal = actualFdpActualLocal;
                          } else if (fdpToEndActualLocal) {
                            fdpEndTimeActualLocal = fdpToEndActualLocal;
                          } else {
                            const allLegs = watch('legs');
                            for (let i = 8; i >= 1; i--) {
                              const row = allLegs?.[i];
                              if (row?.label === 'Arrive') {
                                fdpEndTimeActualLocal = watch(`legs.${i}.localActual`);
                                if (fdpEndTimeActualLocal) break;
                              }
                            }
                          }
                          
                          // Calculate durations for Actual only
                          let actualUtcDuration: string | null = null;
                          if (dutyStartTimeActualUtc && fdpEndTimeActualUtc) {
                            const duration = calculateTimeDifference(dutyStartTimeActualUtc, fdpEndTimeActualUtc, false);
                            if (duration) {
                              actualUtcDuration = `${duration.hours.toString().padStart(2, '0')}:${duration.minutes.toString().padStart(2, '0')}`;
                            }
                          }
                          
                          let actualLocalDuration: string | null = null;
                          if (dutyStartTimeActualLocal && fdpEndTimeActualLocal) {
                            const duration = calculateTimeDifference(dutyStartTimeActualLocal, fdpEndTimeActualLocal, false);
                            if (duration) {
                              actualLocalDuration = `${duration.hours.toString().padStart(2, '0')}:${duration.minutes.toString().padStart(2, '0')}`;
                            }
                          }
                          
                          // Store calculated durations for each column
                          (leg as any).calculatedFdpActualUtc = actualUtcDuration;
                          (leg as any).calculatedFdpActualLocal = actualLocalDuration;
                        }
                        
                        return (
                          <tr key={idx} className={`border-t border-border hover:bg-muted/30 ${isFdpToEndRow || isActualFdpRow ? 'bg-muted/20' : ''}`}>
                            <td className="p-2 border-r border-border font-medium">{leg.label}</td>
                            <td className="p-2 border-r border-border">
                              {isFdpToEndRow ? (
                                <div className="h-8 px-3 py-2 text-xs bg-muted rounded-md flex items-center text-muted-foreground">
                                  {calculatedFdpDurationStr ? `FDP: ${calculatedFdpDurationStr}` : 'FDP to end'}
                                </div>
                              ) : isActualFdpRow ? (
                                <div className="h-8 px-3 py-2 text-xs bg-muted rounded-md flex items-center text-muted-foreground">
                                  Actual FDP
                                </div>
                              ) : (
                                <Input {...register(`legs.${idx}.place` as const)} className="h-8 text-xs" />
                              )}
                            </td>
                            <td className="p-2 border-r border-border">
                              {isFdpToEndRow ? (
                                <div className="h-9 px-3 py-2 text-sm bg-primary/10 rounded-md flex items-center justify-center font-mono font-semibold text-primary border border-primary/20">
                                  {(leg as any).calculatedFdpPlannedUtc || '--:--'}
                                </div>
                              ) : isActualFdpRow ? (
                                <div className="h-9 px-3 py-2 text-sm bg-muted rounded-md flex items-center justify-center font-mono text-muted-foreground">
                                  -
                                </div>
                              ) : (
                                <TimeInput24
                                  value={watch(`legs.${idx}.utcPlanned`)}
                                  onChange={(val) => setValue(`legs.${idx}.utcPlanned`, val)}
                                />
                              )}
                            </td>
                            <td className="p-2 border-r border-border">
                              {isFdpToEndRow ? (
                                <div className="h-9 px-3 py-2 text-sm bg-primary/10 rounded-md flex items-center justify-center font-mono font-semibold text-primary border border-primary/20">
                                  {(leg as any).calculatedFdpPlannedLocal || '--:--'}
                                </div>
                              ) : isActualFdpRow ? (
                                <div className="h-9 px-3 py-2 text-sm bg-muted rounded-md flex items-center justify-center font-mono text-muted-foreground">
                                  -
                                </div>
                              ) : (
                                <TimeInput24
                                  value={watch(`legs.${idx}.localPlanned`)}
                                  onChange={(val) => setValue(`legs.${idx}.localPlanned`, val)}
                                />
                              )}
                            </td>
                            <td className="p-2 border-r border-border">
                              {isFdpToEndRow ? (
                                <div className="h-9 px-3 py-2 text-sm bg-muted rounded-md flex items-center justify-center font-mono text-muted-foreground">
                                  -
                                </div>
                              ) : isActualFdpRow ? (
                                <div className="h-9 px-3 py-2 text-sm bg-primary/10 rounded-md flex items-center justify-center font-mono font-semibold text-primary border border-primary/20">
                                  {(leg as any).calculatedFdpActualUtc || '--:--'}
                                </div>
                              ) : (
                                <TimeInput24
                                  value={watch(`legs.${idx}.utcActual`)}
                                  onChange={(val) => setValue(`legs.${idx}.utcActual`, val)}
                                />
                              )}
                            </td>
                            <td className="p-2">
                              {isFdpToEndRow ? (
                                <div className="h-9 px-3 py-2 text-sm bg-muted rounded-md flex items-center justify-center font-mono text-muted-foreground">
                                  -
                                </div>
                              ) : isActualFdpRow ? (
                                <div className="h-9 px-3 py-2 text-sm bg-primary/10 rounded-md flex items-center justify-center font-mono font-semibold text-primary border border-primary/20">
                                  {(leg as any).calculatedFdpActualLocal || '--:--'}
                                </div>
                              ) : (
                                <TimeInput24
                                  value={watch(`legs.${idx}.localActual`)}
                                  onChange={(val) => setValue(`legs.${idx}.localActual`, val)}
                                />
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                
              </div>

              {/* Commander's Discretion */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">Commander's Discretion</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Amount (Hours)</label>
                    <Input {...register('amountDiscretionHrs')} placeholder="0" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Amount (Minutes)</label>
                    <Input {...register('amountDiscretionMins')} placeholder="0" />
                  </div>
                  {calculatedExtension && (
                    <div className="sm:col-span-2 flex items-center gap-2 p-3 bg-muted/50 rounded-md border border-border">
                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Calculated Discretion:</span>{' '}
                        <span className="font-semibold text-primary">{calculatedExtension.hours}h {calculatedExtension.minutes}m</span>
                        <span className="text-muted-foreground ml-2">
                          {watch('revisedAllowableFdp') 
                            ? `(Actual FDP - Revised Allowable FDP)`
                            : '(Actual FDP duration - enter Revised Allowable FDP to calculate discretion)'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Maximum Flying Hours */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">Additional Information</h3>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Maximum Flying Hours Permitted Note</label>
                  <Input 
                    placeholder="e.g. in 28 days/1 year period. Hours flown ..." 
                    {...register('maxFlyingHoursNote')} 
                  />
                </div>
              </div>
            </Card>
          )}

          {/* Part B - Reduction of Rest */}
          {type === 'reduction' && (
            <Card className="p-4 sm:p-6 space-y-6">
              <h2 className="font-semibold">Part B — Reduction of Rest <span className="text-xs text-muted-foreground font-normal">(24-hour format)</span></h2>
              
              {/* Last Duty Section */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">Last Duty Period</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Started (UTC)</label>
                    <div className="grid grid-cols-2 gap-2">
                      <DateInputDDMMYYYY
                        value={watch('lastDutyStartedUtcDate')}
                        onChange={(val) => setValue('lastDutyStartedUtcDate', val)}
                      />
                      <TimeInput24
                        value={watch('lastDutyStartedUtcTime')}
                        onChange={(val) => setValue('lastDutyStartedUtcTime', val)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Started (Local)</label>
                    <div className="grid grid-cols-2 gap-2">
                      <DateInputDDMMYYYY
                        value={watch('lastDutyStartedLocalDate')}
                        onChange={(val) => setValue('lastDutyStartedLocalDate', val)}
                      />
                      <TimeInput24
                        value={watch('lastDutyStartedLocalTime')}
                        onChange={(val) => setValue('lastDutyStartedLocalTime', val)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Ended (UTC)</label>
                    <div className="grid grid-cols-2 gap-2">
                      <DateInputDDMMYYYY
                        value={watch('lastDutyEndedUtcDate')}
                        onChange={(val) => setValue('lastDutyEndedUtcDate', val)}
                      />
                      <TimeInput24
                        value={watch('lastDutyEndedUtcTime')}
                        onChange={(val) => setValue('lastDutyEndedUtcTime', val)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Ended (Local)</label>
                    <div className="grid grid-cols-2 gap-2">
                      <DateInputDDMMYYYY
                        value={watch('lastDutyEndedLocalDate')}
                        onChange={(val) => setValue('lastDutyEndedLocalDate', val)}
                      />
                      <TimeInput24
                        value={watch('lastDutyEndedLocalTime')}
                        onChange={(val) => setValue('lastDutyEndedLocalTime', val)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Rest Calculation Section */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">Rest & Next FDP Calculation</h3>
                <div className="space-y-4">
                  {/* Row 1: Rest Earned (Hours) - alone */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Rest Earned (Hours)</label>
                    <Input {...register('restEarnedHours')} placeholder="e.g. 12" defaultValue="12" />
                    {calculatedEarliestNextAvailable && (
                      <p className="text-xs text-muted-foreground">
                        Auto-calculated from Last Duty Ended + Rest Earned Hours
                      </p>
                    )}
                  </div>
                  
                  {/* Row 2: Calculated Earliest Next Available (UTC) and (Local) - Auto-calculated */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Calculated Earliest Next Available (UTC)</label>
                      {calculatedEarliestNextAvailable?.utc ? (
                        <div className="grid grid-cols-2 gap-2">
                          <div className="h-9 px-3 py-2 bg-primary/10 rounded-md flex items-center justify-center font-semibold text-primary border border-primary/20 text-sm">
                            {calculatedEarliestNextAvailable.utc.date}
                          </div>
                          <div className="h-9 px-3 py-2 bg-primary/10 rounded-md flex items-center justify-center font-mono font-semibold text-primary border border-primary/20 text-sm">
                            {calculatedEarliestNextAvailable.utc.time}
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          <DateInputDDMMYYYY
                            value={watch('calculatedEarliestNextAvailableUtcDate')}
                            onChange={(val) => setValue('calculatedEarliestNextAvailableUtcDate', val)}
                          />
                          <TimeInput24
                            value={watch('calculatedEarliestNextAvailableUtcTime')}
                            onChange={(val) => setValue('calculatedEarliestNextAvailableUtcTime', val)}
                          />
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {calculatedEarliestNextAvailable?.utc 
                          ? 'Auto-calculated (Read-only)' 
                          : 'Enter Last Duty Ended + Rest Earned to calculate'}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Calculated Earliest Next Available (Local)</label>
                      {calculatedEarliestNextAvailable?.local ? (
                        <div className="grid grid-cols-2 gap-2">
                          <div className="h-9 px-3 py-2 bg-primary/10 rounded-md flex items-center justify-center font-semibold text-primary border border-primary/20 text-sm">
                            {calculatedEarliestNextAvailable.local.date}
                          </div>
                          <div className="h-9 px-3 py-2 bg-primary/10 rounded-md flex items-center justify-center font-mono font-semibold text-primary border border-primary/20 text-sm">
                            {calculatedEarliestNextAvailable.local.time}
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          <DateInputDDMMYYYY
                            value={watch('calculatedEarliestNextAvailableLocalDate')}
                            onChange={(val) => setValue('calculatedEarliestNextAvailableLocalDate', val)}
                          />
                          <TimeInput24
                            value={watch('calculatedEarliestNextAvailableLocalTime')}
                            onChange={(val) => setValue('calculatedEarliestNextAvailableLocalTime', val)}
                          />
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {calculatedEarliestNextAvailable?.local 
                          ? 'Auto-calculated (Read-only)' 
                          : 'Enter Last Duty Ended + Rest Earned to calculate'}
                      </p>
                    </div>
                  </div>
                  
                  {/* Row 3: Actual Start of Next FDP (UTC) and (Local) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Actual Start of Next FDP (UTC)</label>
                      <div className="grid grid-cols-2 gap-2">
                        <DateInputDDMMYYYY
                          value={watch('actualStartNextFdpUtcDate')}
                          onChange={(val) => setValue('actualStartNextFdpUtcDate', val)}
                        />
                        <TimeInput24
                          value={watch('actualStartNextFdpUtcTime')}
                          onChange={(val) => setValue('actualStartNextFdpUtcTime', val)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Actual Start of Next FDP (Local)</label>
                      <div className="grid grid-cols-2 gap-2">
                        <DateInputDDMMYYYY
                          value={watch('actualStartNextFdpLocalDate')}
                          onChange={(val) => setValue('actualStartNextFdpLocalDate', val)}
                        />
                        <TimeInput24
                          value={watch('actualStartNextFdpLocalTime')}
                          onChange={(val) => setValue('actualStartNextFdpLocalTime', val)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Reduction Details Section */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">Reduction Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Rest Period Reduced By</label>
                    {calculatedReduction ? (
                      <div className="h-9 px-3 py-2 bg-primary/10 rounded-md flex items-center font-semibold text-primary border border-primary/20 text-sm">
                        {calculatedReduction.hours > 0 && calculatedReduction.minutes > 0
                          ? `${calculatedReduction.hours} hour${calculatedReduction.hours > 1 ? 's' : ''} ${calculatedReduction.minutes} minute${calculatedReduction.minutes > 1 ? 's' : ''}`
                          : calculatedReduction.hours > 0
                          ? `${calculatedReduction.hours} hour${calculatedReduction.hours > 1 ? 's' : ''}`
                          : calculatedReduction.minutes > 0
                          ? `${calculatedReduction.minutes} minute${calculatedReduction.minutes > 1 ? 's' : ''}`
                          : '0 hours'}
                      </div>
                    ) : (
                      <Input {...register('restReducedBy')} placeholder="" disabled />
                    )}
                    <p className="text-xs text-muted-foreground">
                      {calculatedReduction 
                        ? 'Auto-calculated (Read-only) - Calculated Earliest to Actual Start'
                        : 'Enter Actual Start of Next FDP to calculate'}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Crew Affected</label>
                    <Input {...register('crewAffected')} placeholder="e.g. Captain, FO" />
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Part C */}
          <Card className="p-4 sm:p-6 space-y-4">
            <h2 className="font-semibold">Part C — Commander's Report</h2>
            <div>
              <label className="text-sm">Remarks / Action Taken</label>
              <Textarea rows={6} {...register('remarksActionTaken')} />
            </div>
          </Card>

          <div className="flex justify-center sm:justify-end">
            <Button 
              type="button" 
              disabled={isSubmitting} 
              className="w-full sm:w-auto px-8"
              onClick={handleSubmit((data) => {
                setPendingSubmit(() => () => onSubmit(data));
                setShowConfirmDialog(true);
              })}
            >
              {isSubmitting ? 'Submitting...' : 'Submit CDR'}
            </Button>
          </div>
        </form>

        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Submission</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to submit this Commander's Discretion Report (CDR)? The report will be saved and submitted to the system.
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
      </div>
    </div>
  );
}


