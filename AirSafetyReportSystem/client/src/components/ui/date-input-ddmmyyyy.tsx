import { Input } from "./input";
import { forwardRef, useEffect, useState } from "react";

interface DateInputDDMMYYYYProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  name?: string;
}

export const DateInputDDMMYYYY = forwardRef<HTMLInputElement, DateInputDDMMYYYYProps>(
  ({ value, onChange, placeholder = "DD/MM/YYYY", className, name, ...props }, ref) => {
    const [displayValue, setDisplayValue] = useState("");

    // Convert YYYY-MM-DD to DD/MM/YYYY for display
    const formatDateForDisplay = (dateStr: string | undefined): string => {
      if (!dateStr) return "";
      // If already in YYYY-MM-DD format (from input type="date")
      if (dateStr.includes("-") && dateStr.length === 10) {
        const [year, month, day] = dateStr.split("-");
        return `${day}/${month}/${year}`;
      }
      // If already in DD/MM/YYYY format
      if (dateStr.includes("/") && dateStr.length === 10) {
        return dateStr;
      }
      return dateStr;
    };

    // Convert DD/MM/YYYY to YYYY-MM-DD for storage
    const formatDateForStorage = (dateStr: string): string | null => {
      if (!dateStr) return null;
      
      // Remove all non-digit characters
      const digitsOnly = dateStr.replace(/[^\d]/g, "");
      
      // Must have exactly 8 digits
      if (digitsOnly.length !== 8) return null;
      
      // Split into day, month, year
      const day = digitsOnly.slice(0, 2);
      const month = digitsOnly.slice(2, 4);
      const year = digitsOnly.slice(4, 8);
      
      // Validate day (1-31), month (1-12), year (4 digits)
      const dayNum = parseInt(day, 10);
      const monthNum = parseInt(month, 10);
      const yearNum = parseInt(year, 10);
      
      if (dayNum >= 1 && dayNum <= 31 && monthNum >= 1 && monthNum <= 12 && year.length === 4) {
        // Convert to YYYY-MM-DD for storage
        return `${year}-${month}-${day}`;
      }
      
      return null;
    };

    useEffect(() => {
      setDisplayValue(formatDateForDisplay(value));
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target.value;
      
      // Remove all non-digit characters except slashes
      let cleaned = input.replace(/[^\d/]/g, "");
      
      // Remove all slashes first, then we'll add them back in the right places
      const digitsOnly = cleaned.replace(/\//g, "");
      
      // Limit to 8 digits (DDMMYYYY)
      const limitedDigits = digitsOnly.slice(0, 8);
      
      // Auto-insert slashes in the correct positions
      let formatted = "";
      for (let i = 0; i < limitedDigits.length; i++) {
        if (i === 2) {
          formatted += "/";
        }
        if (i === 4) {
          formatted += "/";
        }
        formatted += limitedDigits[i];
      }
      
      // Limit to 10 characters (DD/MM/YYYY)
      if (formatted.length > 10) {
        formatted = formatted.slice(0, 10);
      }
      
      setDisplayValue(formatted);
      
      // Convert to YYYY-MM-DD and call onChange only if we have a complete date
      if (formatted.length === 10 && formatted.split("/").length === 3) {
        const storageFormat = formatDateForStorage(formatted);
        if (onChange && storageFormat && storageFormat.includes("-")) {
          onChange(storageFormat);
        }
      }
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      // Try to format and save the date
      const storageFormat = formatDateForStorage(displayValue);
      if (storageFormat && onChange && storageFormat.includes("-")) {
        // Valid date, save it
        onChange(storageFormat);
      } else if (displayValue && displayValue.length > 0) {
        // Invalid or incomplete date, but keep display value for user to see
        // Don't clear it, let user fix it
        // Only clear if completely invalid
        const digitsOnly = displayValue.replace(/[^\d]/g, "");
        if (digitsOnly.length === 0) {
          setDisplayValue("");
          if (onChange) onChange("");
        }
      }
    };

    return (
      <Input
        ref={ref}
        type="text"
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        pattern="^([0-2][0-9]|3[0-1])/(0[0-9]|1[0-2])/[0-9]{4}$"
        maxLength={10}
        className={className}
        name={name}
        {...props}
      />
    );
  }
);

DateInputDDMMYYYY.displayName = "DateInputDDMMYYYY";

