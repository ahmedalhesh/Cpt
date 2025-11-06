import * as React from "react";
import { cn } from "@/lib/utils";

interface DateTimeInput24Props extends Omit<React.ComponentProps<"input">, "type" | "value" | "onChange"> {
  value?: string;
  onChange?: (value: string) => void;
}

export const DateTimeInput24 = React.forwardRef<HTMLInputElement, DateTimeInput24Props>(
  ({ className, value = "", onChange, onBlur, ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState(value);

    React.useEffect(() => {
      setDisplayValue(value || "");
    }, [value]);

    const formatDateTime24 = (input: string): string => {
      // Format: YYYY-MM-DDTHH:MM or YYYY-MM-DDTHH:MM:SS
      if (!input) return "";
      
      // If it's already in ISO format, validate it
      if (input.includes("T")) {
        const [datePart, timePart] = input.split("T");
        if (timePart) {
          const timeParts = timePart.split(":");
          if (timeParts.length >= 1) {
            let hours = parseInt(timeParts[0], 10);
            if (!isNaN(hours) && hours > 23) {
              hours = 23;
              timeParts[0] = "23";
            }
          }
          if (timeParts.length >= 2) {
            let minutes = parseInt(timeParts[1], 10);
            if (!isNaN(minutes) && minutes > 59) {
              minutes = 59;
              timeParts[1] = "59";
            }
          }
          if (timeParts.length >= 3) {
            let seconds = parseInt(timeParts[2], 10);
            if (!isNaN(seconds) && seconds > 59) {
              seconds = 59;
              timeParts[2] = "59";
            }
          }
          return `${datePart}T${timeParts.join(":")}`;
        }
      }
      
      return input;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = formatDateTime24(e.target.value);
      setDisplayValue(newValue);
      if (onChange) {
        onChange(newValue);
      }
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      let formatted = displayValue;
      
      // Ensure proper format YYYY-MM-DDTHH:MM or YYYY-MM-DDTHH:MM:SS
      if (formatted.includes("T")) {
        const [datePart, timePart] = formatted.split("T");
        if (datePart && timePart) {
          const timeParts = timePart.split(":").slice(0, 2); // Take only HH:MM
          if (timeParts.length === 1 && timeParts[0]) {
            formatted = `${datePart}T${timeParts[0].padStart(2, "0")}:00`;
          } else if (timeParts.length === 2) {
            formatted = `${datePart}T${timeParts[0].padStart(2, "0")}:${timeParts[1].padStart(2, "0")}`;
          } else {
            // No time part, add default
            formatted = `${datePart}T00:00`;
          }
        }
      } else if (formatted && formatted.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // Only date, add time
        formatted = `${formatted}T00:00`;
      }
      
      setDisplayValue(formatted);
      if (onChange) {
        onChange(formatted);
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
        placeholder="YYYY-MM-DDTHH:MM"
        pattern="^\d{4}-\d{2}-\d{2}T([0-1][0-9]|2[0-3]):[0-5][0-9]$"
        {...props}
      />
    );
  }
);

DateTimeInput24.displayName = "DateTimeInput24";

