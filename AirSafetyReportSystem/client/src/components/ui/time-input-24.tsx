import * as React from "react";
import { cn } from "@/lib/utils";

interface TimeInput24Props extends Omit<React.ComponentProps<"input">, "type" | "value" | "onChange"> {
  value?: string;
  onChange?: (value: string) => void;
}

export const TimeInput24 = React.forwardRef<HTMLInputElement, TimeInput24Props>(
  ({ className, value = "", onChange, onBlur, placeholder, ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState(value);

    React.useEffect(() => {
      setDisplayValue(value || "");
    }, [value]);

    const formatTime24 = (input: string): string => {
      // Remove all non-digit characters
      let cleaned = input.replace(/[^\d]/g, "");
      
      // Auto-insert colon after 2 digits if no colon exists
      if (!input.includes(":") && cleaned.length > 2) {
        cleaned = cleaned.slice(0, 2) + ":" + cleaned.slice(2, 4);
      } else if (input.includes(":")) {
        // If colon exists, split and handle
        const parts = input.split(":");
        const digitsOnly = parts.map(p => p.replace(/[^\d]/g, ""));
        cleaned = digitsOnly.slice(0, 2).join(":");
      }
      
      // Limit to 4 digits max (HHMM)
      if (!cleaned.includes(":")) {
        if (cleaned.length > 4) cleaned = cleaned.slice(0, 4);
        if (cleaned.length > 2) {
          cleaned = cleaned.slice(0, 2) + ":" + cleaned.slice(2, 4);
        }
      } else {
        const parts = cleaned.split(":");
        if (parts[0] && parts[0].length > 2) {
          parts[0] = parts[0].slice(0, 2);
        }
        if (parts[1] && parts[1].length > 2) {
          parts[1] = parts[1].slice(0, 2);
        }
        cleaned = parts.slice(0, 2).join(":");
      }
      
      // Limit hours to 23, minutes to 59
      const timeParts = cleaned.split(":");
      if (timeParts.length >= 1 && timeParts[0]) {
        let hours = parseInt(timeParts[0], 10);
        if (!isNaN(hours) && hours > 23) {
          hours = 23;
          timeParts[0] = "23";
        }
      }
      if (timeParts.length >= 2 && timeParts[1]) {
        let minutes = parseInt(timeParts[1], 10);
        if (!isNaN(minutes) && minutes > 59) {
          minutes = 59;
          timeParts[1] = "59";
        }
      }
      
      return timeParts.join(":");
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = formatTime24(e.target.value);
      setDisplayValue(newValue);
      if (onChange) {
        onChange(newValue);
      }
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      // Only format if there's actual input, don't change empty fields
      if (!displayValue || displayValue.trim() === "") {
        // Keep empty, don't change to 00:00
        if (onBlur) {
          onBlur(e);
        }
        return;
      }
      
      // Format to HH:MM only if there's input
      let formatted = displayValue;
      const parts = formatted.split(":").slice(0, 2); // Take only first 2 parts
      
      if (parts.length === 1 && parts[0] && parts[0].trim() !== "") {
        // Only hours entered, pad minutes
        const hours = parts[0].replace(/[^\d]/g, "");
        if (hours && hours.length > 0) {
          formatted = `${hours.padStart(2, "0")}:00`;
        } else {
          // No valid hours, keep original value
          formatted = displayValue;
        }
      } else if (parts.length === 2) {
        // Hours and minutes
        const hours = parts[0]?.replace(/[^\d]/g, "") || "";
        const minutes = parts[1]?.replace(/[^\d]/g, "") || "";
        
        if (hours && hours.length > 0) {
          // Has hours, format it
          formatted = `${hours.padStart(2, "0")}:${minutes.length > 0 ? minutes.padStart(2, "0") : "00"}`;
        } else {
          // No valid hours, keep original value
          formatted = displayValue;
        }
      } else {
        // No valid format, keep original value (don't change to 00:00)
        formatted = displayValue;
      }
      
      // Only update if formatted value is different and valid
      if (formatted !== displayValue && formatted !== "" && formatted.match(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)) {
        setDisplayValue(formatted);
        if (onChange) {
          onChange(formatted);
        }
      }
      
      if (onBlur) {
        onBlur(e);
      }
    };

    return (
      <input
        type="text"
        ref={ref}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm font-mono",
          className
        )}
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder || "HH:MM"}
        pattern="^([0-1][0-9]|2[0-3]):[0-5][0-9]$"
        maxLength={5}
        {...props}
      />
    );
  }
);

TimeInput24.displayName = "TimeInput24";

