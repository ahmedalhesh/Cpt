import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useRoute, Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ReportTypeBadge } from "@/components/report-type-badge";
import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { usePublicCompanySettings } from "@/hooks/usePublicCompanySettings";
import { 
  ArrowLeft, 
  Calendar, 
  User, 
  MessageSquare, 
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Download,
  Eye,
} from "lucide-react";
import { format } from "date-fns";
import type { Report, Comment, User as UserType } from "@shared/schema";
// @ts-ignore - third-party module without TypeScript types
import arabicReshaper from "arabic-reshaper";
// Ensure Amiri font is always registered at load time (side-effect import)
// @ts-ignore - generated jsPDF font module has no types
import "@/lib/fonts/Amiri-Regular-normal.js";

// Helper function to process Arabic text for jsPDF
const processArabicText = (text: string): string => {
  if (!text) return '';
  try {
    // Check if text contains Arabic characters
    const hasArabic = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
    if (!hasArabic) return text;
    
    // Reshape Arabic text
    const reshaped = arabicReshaper.reshape(text);
    return reshaped || text;
  } catch (error) {
    console.error('Error processing Arabic text:', error);
    return text;
  }
};

// Helper function to format date to DD/MM/YYYY HH:MM
const formatDateTimeToDDMMYYYYHHMM = (dateTimeStr: string | Date | undefined): string => {
  if (!dateTimeStr) return '';
  try {
    const date = typeof dateTimeStr === 'string' ? new Date(dateTimeStr) : dateTimeStr;
    if (isNaN(date.getTime())) {
      // If it's not a valid date, try to parse as DD/MM/YYYY HH:MM or return as is
      return typeof dateTimeStr === 'string' ? dateTimeStr : '';
    }
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return typeof dateTimeStr === 'string' ? dateTimeStr : '';
  }
};

// Helper function to format date to DD/MM/YYYY (without time)
const formatDateToDDMMYYYY = (dateStr: string | Date | undefined): string => {
  if (!dateStr) return '';
  try {
    const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    if (isNaN(date.getTime())) {
      return typeof dateStr === 'string' ? dateStr : '';
    }
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return typeof dateStr === 'string' ? dateStr : '';
  }
};

// Helper function to format date with time to DD/MM/YYYY HH:MM:SS (for PDF footer)
const formatDateTimeToDDMMYYYYHHMMSS = (dateTimeStr: string | Date | undefined): string => {
  if (!dateTimeStr) return '';
  try {
    const date = typeof dateTimeStr === 'string' ? new Date(dateTimeStr) : dateTimeStr;
    if (isNaN(date.getTime())) {
      return typeof dateTimeStr === 'string' ? dateTimeStr : '';
    }
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  } catch {
    return typeof dateTimeStr === 'string' ? dateTimeStr : '';
  }
};

type ReportWithUser = Report & {
  submitter: UserType;
  comments: (Comment & { user: UserType })[];
  // Optional extra fields sent by client for ASR plots
  planImage?: string; // base64 image (PNG or JPEG)
  elevImage?: string; // base64 image (PNG or JPEG)
  planUnits?: string;
  planGridX?: number;
  planGridY?: number;
  planDistanceX?: number;
  planDistanceY?: number;
  elevGridCol?: number;
  elevGridRow?: number;
  elevDistanceHorizM?: number;
  elevDistanceVertFt?: number;
  // Generic container for additional form data (e.g., NCR Arabic form)
  extraData?: any;
};

export default function ReportDetail() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: companySettings } = usePublicCompanySettings();
  const [, params] = useRoute("/reports/:id");
  const [commentText, setCommentText] = useState("");
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isOpeningPDF, setIsOpeningPDF] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
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
  }, [isAuthenticated, authLoading, toast]);

  const { data: report, isLoading } = useQuery<ReportWithUser>({
    queryKey: ["/api/reports", params?.id],
    enabled: !!params?.id,
  });

  const addCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      await apiRequest("POST", "/api/comments", {
        reportId: params?.id,
        content,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports", params?.id] });
      setCommentText("");
      toast({
        title: "Comment added",
        description: "Your comment has been posted successfully.",
      });
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
        description: "Failed to add comment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      console.log(`🔄 [CLIENT] Starting status update: ${newStatus} for report ${params?.id}`);
      console.log(`🔄 [CLIENT] User role: ${user?.role}, User ID: ${user?.id}`);
      console.log(`🔄 [CLIENT] Current report status: ${report?.status}`);
      
      try {
        const response = await apiRequest("PATCH", `/api/reports/${params?.id}/status`, { status: newStatus });
        console.log(`✅ [CLIENT] API request successful, status: ${response.status}`);
        
        const result = await response.json();
        console.log(`✅ [CLIENT] Response data:`, result);
        return result;
      } catch (error) {
        console.error(`❌ [CLIENT] API request failed:`, error);
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log(`✅ [CLIENT] Mutation successful, invalidating queries...`);
      queryClient.invalidateQueries({ queryKey: ["/api/reports", params?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/stats"] });
      console.log(`✅ [CLIENT] Queries invalidated, showing success toast`);
      
      toast({
        title: "Status updated",
        description: "Report status has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      console.error(`❌ [CLIENT] Mutation failed:`, error);
      console.error(`❌ [CLIENT] Error details:`, {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      if (isUnauthorizedError(error)) {
        console.log(`🔐 [CLIENT] Unauthorized error detected, redirecting to login`);
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
      
      console.log(`❌ [CLIENT] Showing error toast: ${error.message}`);
      toast({
        title: "Error",
        description: `Failed to update status: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const handleAddComment = () => {
    if (commentText.trim()) {
      addCommentMutation.mutate(commentText);
    }
  };

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    const first = firstName?.[0] || "";
    const last = lastName?.[0] || "";
    return (first + last).toUpperCase() || "U";
  };

  // Helper function to create and populate PDF (shared by both openPDF and generatePDF)
  // Helper function to convert time string (HH:MM) to minutes
  const timeToMinutes = (timeStr: string | undefined): number | null => {
    if (!timeStr || !timeStr.includes(':')) return null;
    const [hours, minutes] = timeStr.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return null;
    return hours * 60 + minutes;
  };

  // Helper function to calculate difference between two times
  const calculateTimeDifference = (startTime: string | undefined, endTime: string | undefined): { hours: number; minutes: number } | null => {
    const startMins = timeToMinutes(startTime);
    const endMins = timeToMinutes(endTime);
    
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

  // Helper function to get display name for report type (CDF -> CDR)
  const getReportTypeDisplayName = (reportType: string): string => {
    if (reportType.toLowerCase() === 'cdf') {
      return 'CDR';
    }
    return reportType.toUpperCase();
  };

  // Helper function to calculate FDP Duration for each column type
  const calculateFdpDurationForColumn = (
    legs: any[],
    columnType: 'utcPlanned' | 'localPlanned' | 'utcActual' | 'localActual'
  ): string | null => {
    if (!legs || legs.length < 11) return null;
    
    const dutyToStart = legs[0];
    const fdpToEnd = legs[9];
    const actualFdp = legs[10];
    
    const dutyStartTime = dutyToStart?.[columnType];
    let fdpEndTime: string | undefined = undefined;
    
    // Priority: Actual FDP > FDP to end > last Arrive
    if (actualFdp?.[columnType]) {
      fdpEndTime = actualFdp[columnType];
    } else if (fdpToEnd?.[columnType]) {
      fdpEndTime = fdpToEnd[columnType];
    } else {
      // Find last "Arrive" row before "FDP to end"
      for (let i = 8; i >= 1; i--) {
        const row = legs[i];
        if (row?.label === 'Arrive') {
          fdpEndTime = row[columnType];
          if (fdpEndTime) break;
        }
      }
    }
    
    if (!dutyStartTime || !fdpEndTime) return null;
    
    const duration = calculateTimeDifference(dutyStartTime, fdpEndTime);
    if (!duration) return null;
    
    return `${duration.hours.toString().padStart(2, '0')}:${duration.minutes.toString().padStart(2, '0')}`;
  };

  const createPDF = async () => {
    if (!report) return null;

    const jsPDF = (await import('jspdf')).default;
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    // Amiri is statically imported above; mark available
    const arabicFontAvailable = true;
    
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 12;
    const contentWidth = pageWidth - (margin * 2);
    let yPosition = margin;

      // Helper function to add a new page if needed
      const checkNewPage = (requiredHeight: number) => {
        if (yPosition + requiredHeight > pageHeight - 20) {
          pdf.addPage();
          yPosition = margin;
          return true;
        }
        return false;
      };

      // Helper function to check if text contains Arabic characters
      const hasArabicChars = (text: string): boolean => {
        return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
      };

      // Helper function to add text with word wrap (black/white only)
      // NCR: render Arabic as real text using Amiri (no images)
      const addText = async (text: string, fontSize: number, isBold: boolean = false): Promise<number> => {
        const isNCR = report.reportType === 'ncr';
        const containsArabic = hasArabicChars(text);

        pdf.setFontSize(fontSize);
        pdf.setTextColor(0, 0, 0);

        if (isNCR && (containsArabic || arabicFontAvailable)) {
          const processed = processArabicText(text);
          // Try to use Amiri for Arabic
          if (arabicFontAvailable) {
            try {
              pdf.setFont('Amiri-Regular', 'normal');
            } catch {
              pdf.setFont('helvetica', isBold ? 'bold' : 'normal');
            }
          } else {
            pdf.setFont('helvetica', isBold ? 'bold' : 'normal');
          }

          const lines = pdf.splitTextToSize(processed, contentWidth);
          const lineHeight = fontSize * 0.4;
          checkNewPage(lines.length * lineHeight + 5);
          lines.forEach((line: string) => {
            pdf.text(line, margin, yPosition);
            yPosition += lineHeight;
          });
          yPosition += 3;
          return lines.length * lineHeight;
        }

        // Non-NCR (or non-Arabic): default rendering
        pdf.setFont('helvetica', isBold ? 'bold' : 'normal');
        const lines = pdf.splitTextToSize(text, contentWidth);
        const lineHeight = fontSize * 0.4;
        checkNewPage(lines.length * lineHeight + 5);
        lines.forEach((line: string) => {
          pdf.text(line, margin, yPosition);
          yPosition += lineHeight;
        });
        yPosition += 3;
        return lines.length * lineHeight;
      };

      // Helper function to add a table (for Voyage Details)
      const addTable = async (headers: string[], rows: string[][], tableTitle?: string): Promise<number> => {
        const fontSize = 9;
        const rowHeight = 7;
        const headerHeight = 8;
        const cellPadding = 2;
        const numCols = headers.length;
        const colWidth = contentWidth / numCols;
        
        // Check if we need a new page
        const requiredHeight = tableTitle ? headerHeight + rowHeight + (rows.length * rowHeight) + 5 : rowHeight + (rows.length * rowHeight) + 5;
        checkNewPage(requiredHeight);
        
        // Add table title if provided
        if (tableTitle) {
          pdf.setFontSize(fontSize);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(0, 0, 0);
          pdf.text(tableTitle, margin, yPosition + 4);
          yPosition += 5;
        }
        
        // Draw table header
        pdf.setFillColor(245, 245, 245); // Light gray background for header
        pdf.setDrawColor(200, 200, 200); // Border color
        pdf.setLineWidth(0.2);
        
        // Header background
        pdf.rect(margin, yPosition, contentWidth, headerHeight, 'FD');
        
        // Draw header text
        pdf.setFontSize(fontSize);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(0, 0, 0);
        
        headers.forEach((header, colIndex) => {
          const xPos = margin + (colIndex * colWidth) + cellPadding;
          const maxHeaderWidth = colWidth - (cellPadding * 2);
          const headerText = pdf.splitTextToSize(header, maxHeaderWidth);
          const displayHeader = headerText.length > 0 ? headerText[0] : header;
          pdf.text(displayHeader, xPos, yPosition + 5);
        });
        
        yPosition += headerHeight;
        
        // Draw rows
        pdf.setFont('helvetica', 'normal');
        rows.forEach((row, rowIndex) => {
          // Check if we need a new page for this row
          checkNewPage(rowHeight);
          
          // Draw row background (alternating colors for better readability)
          if (rowIndex % 2 === 0) {
            pdf.setFillColor(255, 255, 255); // White
          } else {
            pdf.setFillColor(250, 250, 250); // Very light gray
          }
          pdf.rect(margin, yPosition, contentWidth, rowHeight, 'F');
          
          // Draw row borders
          pdf.setDrawColor(200, 200, 200);
          pdf.setLineWidth(0.1);
          
          // Top border
          pdf.line(margin, yPosition, margin + contentWidth, yPosition);
          
          // Vertical dividers
          for (let i = 1; i < numCols; i++) {
            const xPos = margin + (i * colWidth);
            pdf.line(xPos, yPosition, xPos, yPosition + rowHeight);
          }
          
          // Draw cell text
          pdf.setFontSize(fontSize - 1);
          row.forEach((cell, colIndex) => {
            const xPos = margin + (colIndex * colWidth) + cellPadding;
            const maxCellWidth = colWidth - (cellPadding * 2);
            const cellText = pdf.splitTextToSize(cell || '-', maxCellWidth);
            
            // Show text, truncate if too long to keep row height consistent
            const displayText = cellText.length > 0 ? cellText[0] : '-';
            // Truncate if still too long (add ellipsis)
            const truncatedText = displayText.length > 20 ? displayText.substring(0, 17) + '...' : displayText;
            pdf.text(truncatedText, xPos, yPosition + 4.5);
          });
          
          yPosition += rowHeight;
        });
        
        // Draw bottom border
        pdf.setDrawColor(200, 200, 200);
        pdf.setLineWidth(0.2);
        pdf.line(margin, yPosition, margin + contentWidth, yPosition);
        
        // Draw side borders
        pdf.line(margin, yPosition - (rows.length * rowHeight) - headerHeight, margin, yPosition);
        pdf.line(margin + contentWidth, yPosition - (rows.length * rowHeight) - headerHeight, margin + contentWidth, yPosition);
        
        yPosition += 5; // Add spacing after table
        
        return requiredHeight;
      };

      // Helper function to add section header (matching UI design)
      // Supports Arabic text via html2canvas for NCR reports
      const addSectionHeader = async (text: string, isNCR: boolean = false) => {
        checkNewPage(12);
        
        // Gray background with border (matching bg-muted border border-border)
        pdf.setFillColor(245, 245, 245); // Light gray background (muted)
        pdf.setDrawColor(230, 230, 230); // Border color
        pdf.setLineWidth(0.1);
        
        // Rounded rectangle effect (simulated with padding)
        const headerHeight = 7;
        const padding = 2;
        pdf.rect(margin, yPosition, contentWidth, headerHeight, 'FD'); // Fill and Draw
        
        // Text (matching text-xs font-bold uppercase tracking-wide)
        // For NCR reports, use Arabic fonts directly (no images)
        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(9);
        // Process Arabic text before adding to PDF
        const processedText = isNCR ? processArabicText(text) : text;
        
        // Try to use Arabic font if available, otherwise use helvetica
        if (arabicFontAvailable) {
          try {
            pdf.setFont('Amiri-Regular', 'normal');
          } catch {
            pdf.setFont('helvetica', 'bold');
          }
        } else {
          pdf.setFont('helvetica', 'bold');
        }
        
        // Use splitTextToSize for Arabic text to handle wrapping
        const textLines = pdf.splitTextToSize(processedText, contentWidth - (padding * 2));
        textLines.forEach((line: string, index: number) => {
          if (isNCR) {
            // RTL header alignment
            pdf.text(line, margin + contentWidth - padding, yPosition + 5 + (index * 3.5), { align: 'right' });
          } else {
            pdf.text(line, margin + padding, yPosition + 5 + (index * 3.5));
          }
        });
        
        yPosition += headerHeight + 5; // Add spacing after header
      };

      // Helper function to add field in grid layout (2 columns)
      // Supports Arabic in value via html2canvas
      let currentRowFields: { label: string; value: string }[] = [];
      const fieldWidth = (contentWidth - 4) / 2; // Two columns with gap
      const fieldGap = 4;

      const flushRow = async (isNCR: boolean = false) => {
        if (currentRowFields.length === 0) return;
        
        const maxHeight = Math.max(
          ...currentRowFields.map(f => {
            // Estimate height needed - For NCR, use text height calculation (no images)
            const valueLines = pdf.splitTextToSize(f.value.toString(), fieldWidth - 4);
            const labelLines = pdf.splitTextToSize(f.label, fieldWidth - 4);
            return (labelLines.length * 3.5) + (valueLines.length * 3.5) + 2; // Label height + value height + gap
          })
        );
        
        checkNewPage(maxHeight + 2);
        
        const startY = yPosition;
        let maxY = startY;
        
        for (let i = 0; i < currentRowFields.length; i++) {
          const field = currentRowFields[i];
          const xPos = isNCR
            ? (margin + contentWidth - fieldWidth - (i * (fieldWidth + fieldGap)))
            : (margin + (i * (fieldWidth + fieldGap)));
          let fieldY = startY;
          
          // Label (text-xs text-muted-foreground) - For NCR, use Arabic fonts directly
          pdf.setFontSize(8);
          pdf.setTextColor(115, 115, 115);
          const processedLabel = isNCR ? processArabicText(field.label) : field.label;
          // Try to use Arabic font if available
          if (arabicFontAvailable) {
            try {
              pdf.setFont('Amiri-Regular', 'normal');
            } catch {
              pdf.setFont('helvetica', 'normal');
            }
          } else {
            pdf.setFont('helvetica', 'normal');
          }
          const labelLines = pdf.splitTextToSize(processedLabel, fieldWidth - 4);
          labelLines.forEach((line: string, idx: number) => {
            if (isNCR) {
              pdf.text(line, xPos + fieldWidth - 2, fieldY - (idx * 3.5), { align: 'right' });
            } else {
              pdf.text(line, xPos, fieldY - (idx * 3.5));
            }
          });
          fieldY += 3.5;
          
          // Value (text-sm font-medium) - For NCR, use Arabic fonts directly
          const valueStr = field.value.toString();
          const processedValue = isNCR ? processArabicText(valueStr) : valueStr;
          pdf.setFontSize(9);
          pdf.setTextColor(0, 0, 0);
          // Try to use Arabic font if available
          if (arabicFontAvailable) {
            try {
              pdf.setFont('Amiri-Regular', 'normal');
            } catch {
              pdf.setFont('helvetica', 'medium');
            }
          } else {
            pdf.setFont('helvetica', 'medium');
          }
          const valueLines = pdf.splitTextToSize(processedValue, fieldWidth - 4);
          valueLines.forEach((line: string, idx: number) => {
            if (isNCR) {
              pdf.text(line, xPos + fieldWidth - 2, fieldY + (idx * 3.5), { align: 'right' });
            } else {
              pdf.text(line, xPos, fieldY + (idx * 3.5));
            }
          });
          fieldY += valueLines.length * 3.5;
          
          maxY = Math.max(maxY, fieldY);
        }
        
        yPosition = maxY + 4; // Gap between rows (gap-4)
        currentRowFields = [];
      };

      const addField = async (label: string, value: string | null | undefined, spanColumns: number = 1, isNCR: boolean = false) => {
        if (!value) return;
        
        // If field spans 2 columns, flush current row and display full width
        if (spanColumns === 2) {
          await flushRow();
          checkNewPage(15);
          
          const startY = yPosition;
          
          // Label - For NCR, use Arabic fonts directly
          pdf.setFontSize(8);
          pdf.setTextColor(115, 115, 115);
          const processedLabel = processArabicText(label);
          // Try to use Arabic font if available
          if (arabicFontAvailable) {
            try {
              pdf.setFont('Amiri-Regular', 'normal');
            } catch {
              pdf.setFont('helvetica', 'normal');
            }
          } else {
            pdf.setFont('helvetica', 'normal');
          }
          const labelLines = pdf.splitTextToSize(processedLabel, contentWidth - 4);
          labelLines.forEach((line: string, idx: number) => {
            if (isNCR) {
              pdf.text(line, margin + contentWidth - 2, startY - (idx * 3.5), { align: 'right' });
            } else {
              pdf.text(line, margin, startY - (idx * 3.5));
            }
          });
          yPosition = startY + 3.5;
          
          // Value - For NCR, use Arabic fonts directly
          const valueStr = value.toString();
          const processedValue = processArabicText(valueStr);
          pdf.setFontSize(9);
          pdf.setTextColor(0, 0, 0);
          // Try to use Arabic font if available
          if (arabicFontAvailable) {
            try {
              pdf.setFont('Amiri-Regular', 'normal');
            } catch {
              pdf.setFont('helvetica', 'medium');
            }
          } else {
            pdf.setFont('helvetica', 'medium');
          }
          const valueLines = pdf.splitTextToSize(processedValue, contentWidth - 4);
          valueLines.forEach((line: string) => {
            if (isNCR) {
              pdf.text(line, margin + contentWidth - 2, yPosition, { align: 'right' });
            } else {
              pdf.text(line, margin, yPosition);
            }
            yPosition += 3.5;
          });
          
          yPosition += 4;
          return;
        }
        
        // Add to current row
        currentRowFields.push({ label, value: value.toString() });
        
        // If row is full, flush row (pass isNCR flag)
        if (currentRowFields.length >= 2) {
          await flushRow(isNCR);
        }
      };

      // Helper function to add long text field with background (matching bg-muted/50 p-3 rounded)
      const addLongTextField = async (label: string, text: string, isNCR: boolean = false) => {
        await flushRow(isNCR); // Flush any pending fields
        
        checkNewPage(20);
        
        // Label - For NCR, use Arabic fonts directly
        pdf.setFontSize(8);
        pdf.setTextColor(115, 115, 115);
        const processedLabel = processArabicText(label);
        // Try to use Arabic font if available
        if (arabicFontAvailable) {
          try {
            pdf.setFont('Amiri-Regular', 'normal');
          } catch {
            pdf.setFont('helvetica', 'normal');
          }
        } else {
          pdf.setFont('helvetica', 'normal');
        }
        const labelLines = pdf.splitTextToSize(processedLabel, contentWidth - 8);
        labelLines.forEach((line: string, idx: number) => {
          if (isNCR) {
            pdf.text(line, margin + contentWidth - 4, yPosition - (idx * 3.5), { align: 'right' });
          } else {
            pdf.text(line, margin, yPosition - (idx * 3.5));
          }
        });
        yPosition += 4;
        
        // Text box with background (bg-muted/50) - For NCR, use Arabic fonts directly
        pdf.setFillColor(250, 250, 250); // bg-muted/50
        pdf.setDrawColor(230, 230, 230); // border
        pdf.setLineWidth(0.1);
        const processedText = processArabicText(text);
        const textLines = pdf.splitTextToSize(processedText, contentWidth - 14);
        const boxHeight = Math.min(textLines.length * 3.5 + 6, 50);
        pdf.roundedRect(margin, yPosition, contentWidth - 8, boxHeight, 2, 2, 'FD');
        
        pdf.setFontSize(9);
        pdf.setTextColor(0, 0, 0);
        // Try to use Arabic font if available
        if (arabicFontAvailable) {
          try {
            pdf.setFont('Amiri-Regular', 'normal');
          } catch {
            pdf.setFont('helvetica', 'normal');
          }
        } else {
          pdf.setFont('helvetica', 'normal');
        }
        textLines.forEach((line: string, idx: number) => {
          if (isNCR) {
            pdf.text(line, margin + contentWidth - 5, yPosition + 3 + (idx * 3.5), { align: 'right' });
          } else {
            pdf.text(line, margin + 3, yPosition + 3 + (idx * 3.5));
          }
        });
        yPosition += boxHeight + 4;
      };

      // Helper function to render ASR plot with scales to image using html2canvas
      const renderASRPlotToImage = async (
        type: 'plan' | 'elev',
        plotData: {
          gridX?: number;
          gridY?: number;
          gridCol?: number;
          gridRow?: number;
          units?: string;
          distanceX?: number;
          distanceY?: number;
          distanceHorizM?: number;
          distanceVertFt?: number;
          image?: string;
        }
      ): Promise<string | null> => {
        try {
          const html2canvas = (await import('html2canvas')).default;
          
          // Create temporary container
          const tempContainer = document.createElement('div');
          tempContainer.style.position = 'absolute';
          tempContainer.style.left = '-9999px';
          tempContainer.style.top = '-9999px';
          tempContainer.style.width = '600px';
          tempContainer.style.backgroundColor = '#ffffff';
          tempContainer.style.padding = '10px';
          tempContainer.style.fontFamily = 'Inter, Arial, sans-serif';
          
          const COLS = 29;
          const ROWS = 21;
          const centerCol = Math.floor(COLS / 2);
          const centerRow = Math.floor(ROWS / 2);
          
          if (type === 'plan') {
            const { gridX, gridY, units = 'M', distanceX, distanceY, image } = plotData;
            
            // Create wrapper for plot with scales
            const plotWrapper = document.createElement('div');
            plotWrapper.style.position = 'relative';
            plotWrapper.style.width = '100%';
            plotWrapper.style.height = '450px';
            plotWrapper.style.display = 'flex';
            plotWrapper.style.flexDirection = 'column';
            
            // Scales container (above plot)
            const topScale = document.createElement('div');
            topScale.style.display = 'grid';
            topScale.style.gridTemplateColumns = `repeat(${COLS}, 1fr)`;
            topScale.style.width = '580px';
            topScale.style.height = '20px';
            topScale.style.fontSize = '10px';
            topScale.style.color = '#666666';
            topScale.style.marginBottom = '2px';
            Array.from({ length: COLS }).forEach((_, i) => {
              const label = document.createElement('div');
              label.style.textAlign = 'center';
              const fromLeft = i;
              const labelValue = fromLeft <= centerCol ? (centerCol - fromLeft) : (fromLeft - centerCol);
              label.textContent = String(labelValue);
              topScale.appendChild(label);
            });
            
            // Plot container with side scales
            const plotContainer = document.createElement('div');
            plotContainer.style.position = 'relative';
            plotContainer.style.display = 'flex';
            plotContainer.style.width = '580px';
            plotContainer.style.height = '350px';
            
            // Left scale
            const leftScale = document.createElement('div');
            leftScale.style.display = 'flex';
            leftScale.style.flexDirection = 'column';
            leftScale.style.justifyContent = 'space-between';
            leftScale.style.width = '20px';
            leftScale.style.fontSize = '10px';
            leftScale.style.color = '#666666';
            leftScale.style.paddingRight = '5px';
            Array.from({ length: ROWS }).forEach((_, i) => {
              const label = document.createElement('div');
              const labelValue = Math.abs(i - centerRow);
              label.textContent = String(labelValue);
              leftScale.appendChild(label);
            });
            
            // Grid area
            const gridArea = document.createElement('div');
            gridArea.style.position = 'relative';
            gridArea.style.flex = '1';
            gridArea.style.height = '100%';
            gridArea.style.border = '1px solid #cccccc';
            gridArea.style.backgroundColor = '#ffffff';
            
            // Draw grid using canvas
            const canvas = document.createElement('canvas');
            canvas.width = 560;
            canvas.height = 350;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.strokeStyle = '#e0e0e0';
              ctx.lineWidth = 1;
              // Vertical lines
              for (let i = 0; i < COLS; i++) {
                const x = (i / (COLS - 1)) * 560;
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, 350);
                ctx.stroke();
              }
              // Horizontal lines
              for (let i = 0; i < ROWS; i++) {
                const y = (i / (ROWS - 1)) * 350;
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(560, y);
                ctx.stroke();
              }
              
              // Center marker (triangle)
              const centerX = 280;
              const centerY = 175;
              ctx.fillStyle = '#000000';
              ctx.beginPath();
              ctx.moveTo(centerX, centerY - 10);
              ctx.lineTo(centerX - 8, centerY + 10);
              ctx.lineTo(centerX + 8, centerY + 10);
              ctx.closePath();
              ctx.fill();
              
              // Selected point if available
              if (typeof gridX === 'number' && typeof gridY === 'number') {
                const leftPct = (gridX + centerCol) / (COLS - 1);
                const topPct = (-gridY + centerRow) / (ROWS - 1);
                const pointX = leftPct * 560;
                const pointY = topPct * 350;
                
                ctx.fillStyle = '#2563eb';
                ctx.beginPath();
                ctx.arc(pointX, pointY, 6, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.stroke();
              }
            }
            gridArea.appendChild(canvas);
            
            // Fallback image if grid data not available
            if (!gridX && !gridY && image) {
              const img = document.createElement('img');
              img.src = image;
              img.style.position = 'absolute';
              img.style.top = '0';
              img.style.left = '0';
              img.style.width = '100%';
              img.style.height = '100%';
              img.style.objectFit = 'contain';
              gridArea.appendChild(img);
            }
            
            plotContainer.appendChild(leftScale);
            plotContainer.appendChild(gridArea);
            plotWrapper.appendChild(topScale);
            plotWrapper.appendChild(plotContainer);
            
            // Add metadata
            const metadata = document.createElement('div');
            metadata.style.marginTop = '10px';
            metadata.style.fontSize = '11px';
            metadata.style.color = '#333333';
            const metadataText = `Selected: x=${gridX ?? '-'}, y=${gridY ?? '-'} (${units}) · Distances: X=${distanceX !== undefined ? distanceX.toFixed(units === 'M' ? 0 : 2) : '-'}${units.toLowerCase()}, Y=${distanceY !== undefined ? distanceY.toFixed(units === 'M' ? 0 : 2) : '-'}${units.toLowerCase()}`;
            metadata.textContent = metadataText;
            plotWrapper.appendChild(metadata);
            
            tempContainer.appendChild(plotWrapper);
          } else {
            // Elevation view
            const { gridCol, gridRow, distanceHorizM, distanceVertFt, image } = plotData;
            
            const plotWrapper = document.createElement('div');
            plotWrapper.style.position = 'relative';
            plotWrapper.style.width = '100%';
            plotWrapper.style.height = '450px';
            plotWrapper.style.display = 'flex';
            plotWrapper.style.flexDirection = 'column';
            
            // Top scale
            const topScale = document.createElement('div');
            topScale.style.display = 'flex';
            topScale.style.justifyContent = 'space-between';
            topScale.style.width = '580px';
            topScale.style.height = '20px';
            topScale.style.fontSize = '10px';
            topScale.style.color = '#666666';
            topScale.style.marginBottom = '2px';
            Array.from({ length: COLS }).forEach((_, i) => {
              const label = document.createElement('span');
              const offsetCells = Math.abs(i - centerCol);
              const labelValue = Math.round((offsetCells * 10) / centerCol);
              label.textContent = String(labelValue);
              topScale.appendChild(label);
            });
            
            // Plot container
            const plotContainer = document.createElement('div');
            plotContainer.style.position = 'relative';
            plotContainer.style.display = 'flex';
            plotContainer.style.width = '580px';
            plotContainer.style.height = '350px';
            
            // Left scale
            const leftScale = document.createElement('div');
            leftScale.style.display = 'flex';
            leftScale.style.flexDirection = 'column';
            leftScale.style.justifyContent = 'space-between';
            leftScale.style.width = '20px';
            leftScale.style.fontSize = '10px';
            leftScale.style.color = '#666666';
            leftScale.style.paddingRight = '5px';
            Array.from({ length: ROWS }).forEach((_, i) => {
              const label = document.createElement('div');
              const offsetCells = Math.abs(i - centerRow);
              label.textContent = String(offsetCells);
              leftScale.appendChild(label);
            });
            
            // Grid area
            const gridArea = document.createElement('div');
            gridArea.style.position = 'relative';
            gridArea.style.flex = '1';
            gridArea.style.height = '100%';
            gridArea.style.border = '1px solid #cccccc';
            gridArea.style.backgroundColor = '#ffffff';
            
            // Draw grid
            const canvas = document.createElement('canvas');
            canvas.width = 560;
            canvas.height = 350;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.strokeStyle = '#e0e0e0';
              ctx.lineWidth = 1;
              // Grid lines
              for (let i = 0; i < COLS; i++) {
                const x = (i / (COLS - 1)) * 560;
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, 350);
                ctx.stroke();
              }
              for (let i = 0; i < ROWS; i++) {
                const y = (i / (ROWS - 1)) * 350;
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(560, y);
                ctx.stroke();
              }
              
              // Center dot
              const centerX = 280;
              const centerY = 175;
              ctx.fillStyle = '#000000';
              ctx.beginPath();
              ctx.arc(centerX - 50, centerY, 4, 0, Math.PI * 2);
              ctx.fill();
              
              // Selected point
              if (typeof gridCol === 'number' && typeof gridRow === 'number') {
                const pointX = (gridCol / (COLS - 1)) * 560;
                const pointY = (gridRow / (ROWS - 1)) * 350;
                
                ctx.fillStyle = '#2563eb';
                ctx.beginPath();
                ctx.arc(pointX, pointY, 6, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.stroke();
              }
            }
            gridArea.appendChild(canvas);
            
            // Fallback image
            if (!gridCol && !gridRow && image) {
              const img = document.createElement('img');
              img.src = image;
              img.style.position = 'absolute';
              img.style.top = '0';
              img.style.left = '0';
              img.style.width = '100%';
              img.style.height = '100%';
              img.style.objectFit = 'contain';
              gridArea.appendChild(img);
            }
            
            plotContainer.appendChild(leftScale);
            plotContainer.appendChild(gridArea);
            plotWrapper.appendChild(topScale);
            plotWrapper.appendChild(plotContainer);
            
            // Metadata
            const metadata = document.createElement('div');
            metadata.style.marginTop = '10px';
            metadata.style.fontSize = '11px';
            metadata.style.color = '#333333';
            const metadataText = `Selected: row=${gridRow ?? '-'}, col=${gridCol ?? '-'} · Distances: H=${distanceHorizM ?? '-'}m, V=${distanceVertFt ?? '-'}ft`;
            metadata.textContent = metadataText;
            plotWrapper.appendChild(metadata);
            
            tempContainer.appendChild(plotWrapper);
          }
          
          document.body.appendChild(tempContainer);
          
          const canvas = await html2canvas(tempContainer, {
            backgroundColor: '#ffffff',
            scale: 2,
            useCORS: true,
            logging: false,
          });
          
          document.body.removeChild(tempContainer);
          
          return canvas.toDataURL('image/png');
        } catch (error) {
          console.error('Error rendering ASR plot to image:', error);
          return null;
        }
      };

      // Helper function to add two images side by side (updated to use rendered plots)
      const addImagesSideBySide = async (
        planData: { gridX?: number; gridY?: number; units?: string; distanceX?: number; distanceY?: number; image?: string } | null,
        elevData: { gridCol?: number; gridRow?: number; distanceHorizM?: number; distanceVertFt?: number; image?: string } | null,
        caption1?: string,
        caption2?: string
      ) => {
        if (!planData && !elevData) return;

        try {
          // Render plots to images with scales
          const [planImage, elevImage] = await Promise.all([
            planData ? renderASRPlotToImage('plan', planData) : Promise.resolve(null),
            elevData ? renderASRPlotToImage('elev', elevData) : Promise.resolve(null),
          ]);

          if (!planImage && !elevImage) return;

          const imgWidth = (contentWidth - 4) / 2;
          const maxHeight = 90;

          // Calculate heights
          const getImageHeight = (imgData: string): Promise<number> => {
            return new Promise((resolve) => {
              const img = new Image();
              img.onload = () => {
                const aspectRatio = img.height / img.width;
                const calculatedHeight = imgWidth * aspectRatio;
                resolve(Math.min(calculatedHeight, maxHeight));
              };
              img.onerror = () => resolve(0);
              img.src = imgData;
            });
          };

          const heights = await Promise.all([
            planImage ? getImageHeight(planImage) : Promise.resolve(0),
            elevImage ? getImageHeight(elevImage) : Promise.resolve(0),
          ]);

          const maxImgHeight = Math.max(...heights);
          const requiredHeight = maxImgHeight + (caption1 || caption2 ? 8 : 0) + 5;

          checkNewPage(requiredHeight);

          // Add images side by side
          if (planImage && heights[0] > 0) {
            pdf.addImage(planImage, 'PNG', margin, yPosition, imgWidth, heights[0]);
            
            if (caption1) {
              pdf.setFontSize(7);
              pdf.setTextColor(60, 60, 60);
              pdf.setFont('helvetica', 'bold');
              pdf.text(caption1, margin, yPosition + heights[0] + 4);
            }
          }

          if (elevImage && heights[1] > 0) {
            pdf.addImage(elevImage, 'PNG', margin + imgWidth + 4, yPosition, imgWidth, heights[1]);
            
            if (caption2) {
              pdf.setFontSize(7);
              pdf.setTextColor(60, 60, 60);
              pdf.setFont('helvetica', 'bold');
              pdf.text(caption2, margin + imgWidth + 4, yPosition + heights[1] + 4);
            }
          }

          yPosition += maxImgHeight + (caption1 || caption2 ? 8 : 0) + 5;
        } catch (error) {
          console.error('Error adding ASR plots to PDF:', error);
        }
      };

      // === HEADER (Clean, professional, no colors) ===
      // No header border line - removed per user request
      
      // Company Logo (if available) - convert to grayscale
      if (companySettings?.logo) {
        try {
          const logoWidth = 15;
          const logoHeight = 15;
          pdf.addImage(companySettings.logo, 'PNG', margin, yPosition, logoWidth, logoHeight);
        } catch (error) {
          console.error('Error adding logo to PDF:', error);
        }
      }
      
      // Company Name and Report Type
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(14);
      // Use Arabic font for NCR reports
      if (report.reportType === 'ncr' && arabicFontAvailable) {
        try {
          pdf.setFont('Amiri-Regular', 'normal');
        } catch {
          pdf.setFont('helvetica', 'bold');
        }
      } else {
        pdf.setFont('helvetica', 'bold');
      }
      pdf.text(companySettings?.companyName || 'Report Sys', margin + (companySettings?.logo ? 18 : 0), yPosition + 5);
      
      pdf.setFontSize(10);
      // Use Arabic font for NCR reports
      if (report.reportType === 'ncr' && arabicFontAvailable) {
        try {
          pdf.setFont('Amiri-Regular', 'normal');
        } catch {
          pdf.setFont('helvetica', 'normal');
        }
      } else {
        pdf.setFont('helvetica', 'normal');
      }
      const reportTypeDisplay = report.reportType.toLowerCase() === 'cdf' ? 'CDR' : report.reportType.toUpperCase();
      pdf.text(`${reportTypeDisplay} Report`, margin + (companySettings?.logo ? 18 : 0), yPosition + 10);
      
      // Right side: Report ID, Date, Status
      pdf.setFontSize(8);
      pdf.setTextColor(60, 60, 60);
      // Use Arabic font for NCR reports
      if (report.reportType === 'ncr' && arabicFontAvailable) {
        try {
          pdf.setFont('Amiri-Regular', 'normal');
        } catch {
          pdf.setFont('helvetica', 'normal');
        }
      } else {
        pdf.setFont('helvetica', 'normal');
      }
      pdf.text(`Report ID: #${report.id.slice(0, 5).toUpperCase()}`, pageWidth - margin, yPosition + 3, { align: 'right' });
      if (report.createdAt) {
        pdf.text(`Date: ${formatDateTimeToDDMMYYYYHHMM(report.createdAt)}`, pageWidth - margin, yPosition + 7, { align: 'right' });
      }
      // Use Arabic font for NCR reports
      if (report.reportType === 'ncr' && arabicFontAvailable) {
        try {
          pdf.setFont('Amiri-Regular', 'normal');
        } catch {
          pdf.setFont('helvetica', 'bold');
        }
      } else {
        pdf.setFont('helvetica', 'bold');
      }
      pdf.text(`Status: ${report.status.toUpperCase().replace('_', ' ')}`, pageWidth - margin, yPosition + 11, { align: 'right' });
      
      yPosition += 18;
      
      // Divider line
      pdf.setDrawColor(200, 200, 200);
      pdf.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 8;

      // === BASIC INFORMATION ===
      // Don't show for Captain Reports (handled in CAPTAIN REPORT DETAILS section)
      if (report.reportType !== 'captain') {
        const isNCR = report.reportType === 'ncr';
        await addSectionHeader('BASIC INFORMATION', isNCR);
        
        if (!report.isAnonymous) {
          await addField('Submitted By', 
            report.submitter?.firstName && report.submitter?.lastName
              ? `${report.submitter.firstName} ${report.submitter.lastName}`
              : report.submitter?.email || 'Unknown', 1, isNCR);
        } else {
          await addField('Submitted By', 'Anonymous Report', 1, isNCR);
        }

        await addField('Flight Number', report.flightNumber, 1, isNCR);
        await addField('Aircraft Type', report.aircraftType, 1, isNCR);
        
        // Route - only show if meaningful (not empty or just separator)
        if (report.route && report.route.trim() && report.route.trim() !== '/') {
          await addField('Route', report.route, 1, isNCR);
        }
        
        await addField('Location', report.location, 1, isNCR);
      }

      // === DESCRIPTION ===
      // Only show if meaningful content (not just "Standard: UTC" or whitespace)
      // Don't show for Captain Reports, ASR, NCR, CDF, CHR, OR, and RIR (handled in their respective DETAILS sections)
      if (report.description && report.reportType !== 'captain' && report.reportType !== 'asr' && report.reportType !== 'ncr' && report.reportType !== 'cdf' && report.reportType !== 'chr' && report.reportType !== 'or' && report.reportType !== 'rir') {
        const desc = report.description.trim();
        if (desc && desc !== 'Standard: UTC' && desc.length > 3) {
          addSectionHeader('DESCRIPTION');
          await addText(report.description, 9);
        }
      }

      // === REPORT TYPE SPECIFIC DATA ===
      
      // ASR Details - Matching form order exactly
      if (report.reportType === 'asr' && report.extraData) {
        addSectionHeader('AIR SAFETY REPORT (ASR) DETAILS');
        
        // 1. Header Information
        if (report.extraData.isReportable) {
          await addField('Reportable Occurrence', report.extraData.isReportable.toUpperCase());
        }
        if (report.extraData.cm1 || report.extraData.cm2 || report.extraData.cm3) {
          await addField('Crew Members (CM1, CM2, CM3)', [report.extraData.cm1, report.extraData.cm2, report.extraData.cm3].filter(Boolean).join(' | '));
        }
        if (report.extraData.eventTypes && Array.isArray(report.extraData.eventTypes) && report.extraData.eventTypes.length > 0) {
          await addField('Type of Event', report.extraData.eventTypes.join(', '), 2); // Span 2 columns
        }
        await flushRow(); // Ensure row is flushed
        
        // 2. Date/Time/Standard
        if (report.extraData.date) {
          await addField('Date', report.extraData.date);
        }
        if (report.extraData.time) {
          await addField(`Time ${report.extraData.timeStandard ? `(${report.extraData.timeStandard})` : ''}`, report.extraData.time);
        }
        // Only show Standard if it's explicitly set and not just default "UTC", and time is not set
        if (report.extraData.timeStandard && 
            report.extraData.timeStandard !== 'UTC' && 
            !report.extraData.time) {
          await addField('Standard', report.extraData.timeStandard);
        }
        await flushRow();
        
        // 3. Callsign, From, To
        if (report.extraData.callsign) {
          await addField('Callsign', report.extraData.callsign);
        }
        if (report.extraData.routeFrom) {
          await addField('From', report.extraData.routeFrom);
        }
        if (report.extraData.routeTo) {
          await addField('To', report.extraData.routeTo);
        }
        await flushRow();
        
        // 4. Diverted To, Aircraft Type, Registration, Passengers/Crew
        if (report.extraData.divertedTo) {
          await addField('Diverted To', report.extraData.divertedTo);
        }
        if (report.extraData.aircraftType) {
          await addField('Aircraft Type', report.extraData.aircraftType);
        }
        if (report.extraData.registration) {
          await addField('Registration', report.extraData.registration);
        }
        if (report.extraData.paxCrew) {
          await addField('Passengers/Crew', report.extraData.paxCrew);
        }
        await flushRow();
        
        // 5. Tech Log Page, Phase of Flight, Altitude, Speed/Mach
        if (report.extraData.techLogPage) {
          await addField('Tech Log Page', report.extraData.techLogPage);
        }
        if (report.extraData.phaseOfFlight) {
          await addField('Phase of Flight', report.extraData.phaseOfFlight);
        }
        if (report.extraData.altitude) {
          await addField('Altitude (ft)', report.extraData.altitude);
        }
        if (report.extraData.speedMach) {
          await addField('Speed/Mach', report.extraData.speedMach);
        }
        await flushRow();
        
        // 6. Fuel Dump, MET Conditions, VMC Distance, Runway
        if (report.extraData.fuelDumpKg) {
          await addField('Fuel Dump (Kg)', report.extraData.fuelDumpKg);
        }
        if (report.extraData.metConditions) {
          await addField('MET Conditions', report.extraData.metConditions);
        }
        if (report.extraData.vmcDistanceKm) {
          await addField('VMC Distance (km)', report.extraData.vmcDistanceKm);
        }
        if (report.extraData.runwayDesignator || report.extraData.runwaySide || report.extraData.runwayCondition) {
          await addField('Runway', [report.extraData.runwayDesignator, report.extraData.runwaySide, report.extraData.runwayCondition].filter(Boolean).join('/'));
        }
        await flushRow();
        
        // 7. Weather Information
        if (report.extraData.wxWind) {
          await addField('Wind', report.extraData.wxWind);
        }
        if (report.extraData.wxVisibility) {
          await addField('Visibility/RVR', report.extraData.wxVisibility);
        }
        if (report.extraData.wxClouds) {
          await addField('Clouds', report.extraData.wxClouds);
        }
        if (report.extraData.wxTemp) {
          await addField('Temp (°C)', report.extraData.wxTemp);
        }
        if (report.extraData.wxQnh) {
          await addField('QNH (hPa)', report.extraData.wxQnh);
        }
        if (report.extraData.wxSignificant && Array.isArray(report.extraData.wxSignificant) && report.extraData.wxSignificant.length > 0) {
          await addField('Significant WX', report.extraData.wxSignificant.join(', '), 2); // Span 2 columns
        }
        await flushRow();
        
        // 8. Aircraft Configuration
        if (report.extraData.cfgAutopilot !== undefined) {
          await addField('Autopilot', report.extraData.cfgAutopilot ? 'ON' : 'OFF');
        }
        if (report.extraData.cfgGear !== undefined) {
          await addField('Gear', report.extraData.cfgGear ? 'DOWN' : 'UP');
        }
        if (report.extraData.cfgFlaps !== undefined) {
          await addField('Flaps', report.extraData.cfgFlaps ? 'SET' : 'UP');
        }
        if (report.extraData.cfgSlat !== undefined) {
          await addField('Slat', report.extraData.cfgSlat ? 'SET' : 'UP');
        }
        if (report.extraData.cfgSpoiler !== undefined) {
          await addField('Spoiler', report.extraData.cfgSpoiler ? 'EXT' : 'RET');
        }
        await flushRow();
        
        // Long text fields - Event Summary, Action Taken, Other Info
        if (report.extraData.eventSummary) {
          await addLongTextField('Event Summary', report.extraData.eventSummary);
        }
        
        if (report.extraData.actionTaken) {
          await addLongTextField('Action Taken / Results / Subsequent Events', report.extraData.actionTaken);
        }
        
        if (report.extraData.otherInfo) {
          await addLongTextField('Other Information and Suggestions', report.extraData.otherInfo);
        }
        
        // 9. AIRPROX / ATC INCIDENT / TCAS
        if (report.extraData.airproxSeverity || report.extraData.airproxAvoidingAction || report.extraData.airproxReportedToAtc || report.extraData.airproxAtcInstruction || report.extraData.airproxFreq || report.extraData.airproxHeading || report.extraData.airproxVertSep || report.extraData.airproxHorizSep || report.extraData.airproxSquawk || report.extraData.airproxTcasAlert || report.extraData.airproxRaFollowed || report.extraData.airproxVertDeviation || report.extraData.airproxOtherAcType || report.extraData.airproxOtherAcMarkings || report.extraData.airproxOtherAcCallsign) {
          await flushRow();
          addSectionHeader('AIRPROX / ATC INCIDENT / TCAS');
          
          // Incident Details
          if (report.extraData.airproxSeverity) {
            await addField('Severity', report.extraData.airproxSeverity.charAt(0).toUpperCase() + report.extraData.airproxSeverity.slice(1));
          }
          if (report.extraData.airproxAvoidingAction) {
            await addField('Avoiding Action', report.extraData.airproxAvoidingAction.charAt(0).toUpperCase() + report.extraData.airproxAvoidingAction.slice(1));
          }
          await flushRow();
          
          // ATC Information
          if (report.extraData.airproxReportedToAtc) {
            await addField('ATC Unit', report.extraData.airproxReportedToAtc);
          }
          if (report.extraData.airproxFreq) {
            await addField('Frequency', report.extraData.airproxFreq);
          }
          if (report.extraData.airproxAtcInstruction) {
            await addLongTextField('ATC Instruction', report.extraData.airproxAtcInstruction);
          }
          if (report.extraData.airproxHeading) {
            await addField('Heading (deg)', report.extraData.airproxHeading);
          }
          await flushRow();
          
          // Separation Details
          if (report.extraData.airproxVertSep) {
            await addField('Vertical Separation (ft)', report.extraData.airproxVertSep);
          }
          if (report.extraData.airproxHorizSep) {
            await addField('Horizontal Separation (M/NM)', report.extraData.airproxHorizSep);
          }
          if (report.extraData.airproxSquawk) {
            await addField('Squawk', report.extraData.airproxSquawk);
          }
          await flushRow();
          
          // TCAS Information
          if (report.extraData.airproxTcasAlert) {
            await addField('TCAS Alert', report.extraData.airproxTcasAlert);
          }
          if (report.extraData.airproxRaFollowed) {
            await addField('RA Followed', report.extraData.airproxRaFollowed.charAt(0).toUpperCase() + report.extraData.airproxRaFollowed.slice(1));
          }
          if (report.extraData.airproxVertDeviation) {
            await addField('Vertical Deviation (ft)', report.extraData.airproxVertDeviation);
          }
          await flushRow();
          
          // Other Aircraft Information
          if (report.extraData.airproxOtherAcType) {
            await addField('Aircraft Type', report.extraData.airproxOtherAcType);
          }
          if (report.extraData.airproxOtherAcMarkings) {
            await addLongTextField('Markings/Colour', report.extraData.airproxOtherAcMarkings);
          }
          if (report.extraData.airproxOtherAcCallsign) {
            await addField('Callsign/Registration', report.extraData.airproxOtherAcCallsign);
          }
          await flushRow();
        }
        
        // ASR PLOTS (Side by side in one page) - Only show if there are images or meaningful data
        // Helper function to check if a value is a valid non-zero number
        const isNonZeroNumber = (val: any): boolean => {
          return typeof val === 'number' && val !== 0 && !isNaN(val);
        };
        
        // Helper function to check if a value is a valid number (including 0)
        const isValidNumber = (val: any): boolean => {
          return typeof val === 'number' && !isNaN(val);
        };
        
        const hasPlanImage = !!(report.planImage && report.planImage.length > 100 && report.planImage.startsWith('data:'));
        const hasElevImage = !!(report.elevImage && report.elevImage.length > 100 && report.elevImage.startsWith('data:'));
        
        // PLAN VIEW: Check if plan view has meaningful data
        const planGridX = report.planGridX;
        const planGridY = report.planGridY;
        const planDistanceX = report.planDistanceX;
        const planDistanceY = report.planDistanceY;
        
        const planHasValidGrid = isValidNumber(planGridX) && isValidNumber(planGridY);
        const planIsAtCenter = planHasValidGrid && planGridX === 0 && planGridY === 0;
        const planHasNonZeroDistances = isNonZeroNumber(planDistanceX) || isNonZeroNumber(planDistanceY);
        
        // Plan is meaningful if: has image OR (has valid grid AND (not at center OR has non-zero distances))
        const planIsMeaningful = hasPlanImage || (planHasValidGrid && (!planIsAtCenter || planHasNonZeroDistances));
        
        // ELEVATION VIEW: Check if elevation view has meaningful data
        const centerCol = 14; // COLS / 2 - 1 = 29/2 - 1 = 14
        const centerRow = 10; // ROWS / 2 - 1 = 21/2 - 1 = 10
        
        const elevGridCol = report.elevGridCol;
        const elevGridRow = report.elevGridRow;
        const elevDistanceHorizM = report.elevDistanceHorizM;
        const elevDistanceVertFt = report.elevDistanceVertFt;
        
        const elevHasValidGrid = isValidNumber(elevGridCol) && isValidNumber(elevGridRow);
        const elevIsAtCenter = elevHasValidGrid && elevGridCol === centerCol && elevGridRow === centerRow;
        const elevHasNonZeroDistances = isNonZeroNumber(elevDistanceHorizM) || isNonZeroNumber(elevDistanceVertFt);
        
        // Elevation is meaningful if: has image OR (has valid grid AND (not at center OR has non-zero distances))
        const elevIsMeaningful = hasElevImage || (elevHasValidGrid && (!elevIsAtCenter || elevHasNonZeroDistances));
        
        if (planIsMeaningful || elevIsMeaningful) {
          await flushRow();
          addSectionHeader('ASR PLOTS');
          await addImagesSideBySide(
            {
              gridX: report.planGridX,
              gridY: report.planGridY,
              units: report.planUnits,
              distanceX: report.planDistanceX,
              distanceY: report.planDistanceY,
              image: report.planImage,
            },
            {
              gridCol: report.elevGridCol,
              gridRow: report.elevGridRow,
              distanceHorizM: report.elevDistanceHorizM,
              distanceVertFt: report.elevDistanceVertFt,
              image: report.elevImage,
            },
            'VIEW FROM ABOVE',
            'VIEW FROM ASTERN'
          );
        }
        
        // 10. WAKE TURBULENCE
        if (report.extraData.wakeHeading || report.extraData.wakeTurning || report.extraData.wakeGs || report.extraData.wakeEcl || report.extraData.wakeChangeAtt || report.extraData.wakeChangeAlt || report.extraData.wakeVrtAccel || report.extraData.wakeBuffet || report.extraData.wakePreceding || report.extraData.wakeAwareBefore || report.extraData.wakeSuspectReason) {
          await flushRow();
          addSectionHeader('WAKE TURBULENCE');
          
          // Flight Configuration
          if (report.extraData.wakeHeading) {
            await addField('Heading (deg)', report.extraData.wakeHeading);
          }
          if (report.extraData.wakeTurning) {
            await addField('Turning', report.extraData.wakeTurning);
          }
          if (report.extraData.wakeGs) {
            await addField('Glideslope', report.extraData.wakeGs);
          }
          if (report.extraData.wakeEcl) {
            await addField('Ext Centerline', report.extraData.wakeEcl);
          }
          await flushRow();
          
          // Aircraft Effects
          if (report.extraData.wakeChangeAtt) {
            await addField('Change in Attitude (deg)', report.extraData.wakeChangeAtt);
          }
          if (report.extraData.wakeChangeAlt) {
            await addField('Change in Altitude (ft)', report.extraData.wakeChangeAlt);
          }
          if (report.extraData.wakeVrtAccel) {
            await addField('Vertical Acceleration', report.extraData.wakeVrtAccel);
          }
          if (report.extraData.wakeBuffet) {
            await addField('Buffet', report.extraData.wakeBuffet.charAt(0).toUpperCase() + report.extraData.wakeBuffet.slice(1));
          }
          await flushRow();
          
          // Wake Turbulence Details
          if (report.extraData.wakePreceding) {
            await addField('Preceding Aircraft', report.extraData.wakePreceding);
          }
          if (report.extraData.wakeAwareBefore) {
            await addField('Aware Before?', report.extraData.wakeAwareBefore.charAt(0).toUpperCase() + report.extraData.wakeAwareBefore.slice(1));
          }
          if (report.extraData.wakeSuspectReason) {
            await addLongTextField('Why Suspect Wake Turbulence?', report.extraData.wakeSuspectReason);
          }
          await flushRow();
        }
        
        // 11. BIRD STRIKE
        if (report.extraData.birdLocation || report.extraData.birdType || report.extraData.nrSeen3_1 !== undefined || report.extraData.nrSeen3_2_10 !== undefined || report.extraData.nrSeen3_11_100 !== undefined || report.extraData.nrSeen3_more !== undefined || report.extraData.nrSeen4_1 !== undefined || report.extraData.nrSeen4_2_10 !== undefined || report.extraData.nrSeen4_11_100 !== undefined || report.extraData.nrSeen4_more !== undefined || report.extraData.nrSeen5_1 !== undefined || report.extraData.nrSeen5_2_10 !== undefined || report.extraData.nrSeen5_11_100 !== undefined || report.extraData.nrSeen5_more !== undefined) {
          await flushRow();
          addSectionHeader('BIRD STRIKE');
          
          if (report.extraData.birdLocation) {
            await addField('1. LOCATION', report.extraData.birdLocation);
          }
          if (report.extraData.birdType) {
            await addField('2. TYPE OF BIRDS', report.extraData.birdType);
          }
          await flushRow();
          
          // Number Seen
          const nrSeen: string[] = [];
          if (report.extraData.nrSeen3_1 !== undefined || report.extraData.nrSeen3_2_10 !== undefined || report.extraData.nrSeen3_11_100 !== undefined || report.extraData.nrSeen3_more !== undefined) {
            const engine3 = [];
            if (report.extraData.nrSeen3_1 !== undefined) engine3.push(`1=${report.extraData.nrSeen3_1 ? 'Y' : 'N'}`);
            if (report.extraData.nrSeen3_2_10 !== undefined) engine3.push(`2-10=${report.extraData.nrSeen3_2_10 ? 'Y' : 'N'}`);
            if (report.extraData.nrSeen3_11_100 !== undefined) engine3.push(`11-100=${report.extraData.nrSeen3_11_100 ? 'Y' : 'N'}`);
            if (report.extraData.nrSeen3_more !== undefined) engine3.push(`MORE=${report.extraData.nrSeen3_more ? 'Y' : 'N'}`);
            if (engine3.length > 0) nrSeen.push(`3. NR SEEN: ${engine3.join(' ')}`);
          }
          if (report.extraData.nrSeen4_1 !== undefined || report.extraData.nrSeen4_2_10 !== undefined || report.extraData.nrSeen4_11_100 !== undefined || report.extraData.nrSeen4_more !== undefined) {
            const engine4 = [];
            if (report.extraData.nrSeen4_1 !== undefined) engine4.push(`1=${report.extraData.nrSeen4_1 ? 'Y' : 'N'}`);
            if (report.extraData.nrSeen4_2_10 !== undefined) engine4.push(`2-10=${report.extraData.nrSeen4_2_10 ? 'Y' : 'N'}`);
            if (report.extraData.nrSeen4_11_100 !== undefined) engine4.push(`11-100=${report.extraData.nrSeen4_11_100 ? 'Y' : 'N'}`);
            if (report.extraData.nrSeen4_more !== undefined) engine4.push(`MORE=${report.extraData.nrSeen4_more ? 'Y' : 'N'}`);
            if (engine4.length > 0) nrSeen.push(`4. NR SEEN: ${engine4.join(' ')}`);
          }
          if (report.extraData.nrSeen5_1 !== undefined || report.extraData.nrSeen5_2_10 !== undefined || report.extraData.nrSeen5_11_100 !== undefined || report.extraData.nrSeen5_more !== undefined) {
            const engine5 = [];
            if (report.extraData.nrSeen5_1 !== undefined) engine5.push(`1=${report.extraData.nrSeen5_1 ? 'Y' : 'N'}`);
            if (report.extraData.nrSeen5_2_10 !== undefined) engine5.push(`2-10=${report.extraData.nrSeen5_2_10 ? 'Y' : 'N'}`);
            if (report.extraData.nrSeen5_11_100 !== undefined) engine5.push(`11-100=${report.extraData.nrSeen5_11_100 ? 'Y' : 'N'}`);
            if (report.extraData.nrSeen5_more !== undefined) engine5.push(`MORE=${report.extraData.nrSeen5_more ? 'Y' : 'N'}`);
            if (engine5.length > 0) nrSeen.push(`5. NR SEEN: ${engine5.join(' ')}`);
          }
          if (nrSeen.length > 0) {
            await addField('NR SEEN', nrSeen.join(' | '), 2); // Span 2 columns
          }
          await flushRow();
        }
        
        // 12. Sign-off
        if (report.extraData.reporterName || report.extraData.reporterRank || report.extraData.reporterDate) {
          await flushRow();
          addSectionHeader('SIGN-OFF');
          
          if (report.extraData.reporterName) {
            await addField('Reporter Name', report.extraData.reporterName);
          }
          if (report.extraData.reporterRank) {
            await addField('Reporter Rank', report.extraData.reporterRank);
          }
          if (report.extraData.reporterDate) {
            await addField('Reporter Date', report.extraData.reporterDate);
          }
          await flushRow();
        }
        
        // Final flush to ensure all fields are rendered
        await flushRow();
      }
      
      // NCR Details
      if (report.reportType === 'ncr' && report.extraData) {
        await addSectionHeader('تقرير عدم المطابقة (NCR)', true);
        
        // 1. المعلومات العامة
        await addField('التاريخ', report.extraData.date, 1, true);
        await addField('تاريخ الرحلة', report.extraData.flightDate, 1, true);
        await addField('رقم الرحلة', report.extraData.flightNumber, 1, true);
        await addField('نوع الطائرة', report.extraData.aircraftType, 1, true);
        await addField('رقم تسجيل الطائرة', report.extraData.aircraftReg, 1, true);
        await addField('اسم قائد الطائرة', report.extraData.captainName, 1, true);
        await addField('اسم مساعد قائد الطائرة', report.extraData.foName, 1, true);
        await flushRow(true);
        
        // 2. مصادر عدم المطابقة
        const sources: string[] = [];
        if (report.extraData.srcSurvey) sources.push('استبيانات مسح رضى العملاء');
        if (report.extraData.srcCustomerComplaint) sources.push('شكوى عميل');
        if (report.extraData.srcPilotObservation) sources.push('ملاحظات مراقبة من الطيار');
        if (report.extraData.srcMaintenanceOfficer) sources.push('ضابط الصيانة');
        if (report.extraData.srcOtherMonitoring) sources.push('نشاطات مراقبة أخرى');
        if (report.extraData.srcInternalAudit) sources.push('الفحص الداخلي');
        if (report.extraData.srcOpsTax) sources.push('أداء ضريبة العمليات');
        if (report.extraData.srcOtherText) sources.push(`أخرى: ${report.extraData.srcOtherText}`);
        if (sources.length > 0) {
          await addField('مصادر عدم المطابقة', sources.join('، '), 2, true);
        }
        
        // 3. نوع عدم المطابقة
        const types: string[] = [];
        if (report.extraData.nonconform_service) types.push('الخدمية');
        if (report.extraData.nonconform_safety) types.push('تؤثر على السلامة');
        if (report.extraData.nonconform_security) types.push('تؤثر على الأمن');
        if (types.length > 0) {
          await addField('نوع عدم المطابقة', types.join('، '), 2, true);
        }
        
        // 4. حقول النص الطويلة
        if (report.extraData.nonconformDetails) {
          await addLongTextField('تفاصيل عدم المطابقة', report.extraData.nonconformDetails, true);
        }
        if (report.extraData.recommendationFix) {
          await addLongTextField('التوصية بخصوص التصحيح اللازم', report.extraData.recommendationFix, true);
        }
        if (report.extraData.recommendationAction) {
          await addLongTextField('التوصية بخصوص الإجراء التصحيحي اللازم', report.extraData.recommendationAction, true);
        }
        
        // 5. معلومات المكتشف
        await addField('اسم مكتشف الخدمة غير المطابقة', report.extraData.discovererName, 1, true);
        await addField('الوظيفة', report.extraData.discovererTitle, 1, true);
        await addField('التاريخ', report.extraData.discovererDate, 1, true);
        await flushRow(true);
        
        // 6. تحليل الأسباب الرئيسية
        if (report.extraData.rootCauseAnalysis) {
          await addLongTextField('تحليل الأسباب الرئيسية لحالة عدم المطابقة', report.extraData.rootCauseAnalysis, true);
        }
        await addField('الاسم', report.extraData.analystName, 1, true);
        await addField('اسم ووظيفة الشخص الذي حدد الأسباب الرئيسية', report.extraData.analystTitle, 1, true);
        await addField('التاريخ', report.extraData.analystDate, 1, true);
        await flushRow(true);
        
        // 7. تقرير المسؤول المباشر
        if (report.extraData.directManagerNotes) {
          await addLongTextField('ملاحظات المسؤول المباشر', report.extraData.directManagerNotes, true);
        }
        if (report.extraData.needsCorrection) {
          await addField('الحالة', report.extraData.needsCorrection === 'yes' ? 'نعم - الحالة تحتاج إلى تصحيح' : 'لا - الحالة لا تحتاج إلى تصحيح', 1, true);
        }
        if (report.extraData.correctionDetails) {
          await addLongTextField('تفاصيل التصحيح (عند الحاجة له)', report.extraData.correctionDetails, true);
        }
        await addField('التاريخ المطلوب لإنهاء التصحيح', report.extraData.correctionDueDate, 1, true);
        await addField('الاسم', report.extraData.personAssignedName, 1, true);
        await addField('اسم ووظيفة الشخص الذي حُدد لتنفيذ التصحيح', report.extraData.personAssignedTitle, 1, true);
        await flushRow(true);
        
        // 8. الملاحظات على الإجراء التصحيحي المقترح
        if (report.extraData.proposalApprove) {
          await addField('الموافقة', report.extraData.proposalApprove === 'yes' ? 'نعم - أقرّح القيام بإجراء تصحيحي' : 'لا - لا أقرّح القيام بإجراء تصحيحي', 1, true);
        }
        if (report.extraData.proposalNotes) {
          await addLongTextField('ملاحظات المسؤول المباشر', report.extraData.proposalNotes, true);
        }
        await addField('اسم الشخص الذي أقرّ الإجراء التصحيحي', report.extraData.proposalSignerName, 1, true);
        await addField('وظيفته', report.extraData.proposalSignerTitle, 1, true);
        await addField('التاريخ', report.extraData.proposalSignerDate, 1, true);
        await flushRow(true);
        
        // 9. نتائج التصحيح
        if (report.extraData.correctionResultDetails) {
          await addLongTextField('نتائج التصحيح', report.extraData.correctionResultDetails, true);
        }
        await addField('التاريخ', report.extraData.correctionResponsibleDate, 1, true);
        await flushRow(true);
        
        // 10. نتائج المتابعة
        if (report.extraData.followupResult) {
          await addLongTextField('نتائج المتابعة', report.extraData.followupResult, true);
        }
        await addField('تاريخ المتابعة', report.extraData.followupDate, 1, true);
        await flushRow(true);
        
        // 11. إغلاق التقرير
        if (report.extraData.reportClosureNotes) {
          await addLongTextField('إغلاق التقرير (إن تمّت عن الشخص المُسند في هذه المهمة)', report.extraData.reportClosureNotes, true);
        }
        await addField('تاريخ الإغلاق', report.extraData.closureDate, 1, true);
        await flushRow(true);
      }

      // OR Details - Matching form order with grid layout
      if (report.reportType === 'or' && report.extraData) {
        await addSectionHeader('OCCURRENCE REPORT (OR) DETAILS');
        
        // Header Information (matching form order)
        if (report.extraData.acReg) {
          await addField('A/C Reg.', report.extraData.acReg);
        }
        if (report.extraData.headerDate) {
          await addField('Date', report.extraData.headerDate);
        }
        if (report.extraData.reportRef) {
          await addField('Report Ref.', report.extraData.reportRef);
        }
        
        // Date of Occurrence (matching form order)
        if (report.extraData.occDate) {
          await addField('Date of Occurrence', report.extraData.occDate);
        }
        if (report.extraData.occTime) {
          await addField('Time', report.extraData.occTime);
        }
        if (report.extraData.occLocation) {
          await addLongTextField('Location', report.extraData.occLocation, false);
        }
        
        // Type of Occurrence (matching form order)
        if (report.extraData.typeOfOccurrence) {
          await addLongTextField('Type of Occurrence', report.extraData.typeOfOccurrence, false);
        }
        
        // Staff Involved (matching form order)
        if (report.extraData.staffInvolved) {
          await addLongTextField('Name(s) of staff involved', report.extraData.staffInvolved, false);
        }
        
        // Details (matching form order)
        if (report.extraData.details) {
          await addLongTextField('Detail and Circumstances of Occurrence', report.extraData.details, false);
        }
        if (report.extraData.damageExtent) {
          await addLongTextField('Extent of damage or injury to personnel, if any', report.extraData.damageExtent, false);
        }
        if (report.extraData.rectification) {
          await addLongTextField('Rectification action taken, if any', report.extraData.rectification, false);
        }
        if (report.extraData.remarks) {
          await addLongTextField('Remarks / Comments', report.extraData.remarks, false);
        }
        if (report.extraData.qaEngineer) {
          await addField('Quality Assurance Engineer', report.extraData.qaEngineer);
        }
        if (report.extraData.qaDate) {
          await addField('Date', report.extraData.qaDate);
        }
      }

      // CDF Details
      if (report.reportType === 'cdf' && report.extraData) {
        addSectionHeader('COMMANDER\'S DISCRETION (CDR) DETAILS');
        
        // Part A - Basic Information
        if (report.extraData.airline) {
          await addField('Airline', report.extraData.airline);
        }
        if (report.extraData.aircraftType) {
          await addField('Aircraft Type', report.extraData.aircraftType);
        }
        if (report.extraData.flightNumber) {
          await addField('Flight Number', report.extraData.flightNumber);
        }
        if (report.extraData.commander) {
          await addField('Commander', report.extraData.commander);
        }
        if (report.extraData.date) {
          await addField('Date', report.extraData.date);
        }
        
        if (report.extraData.type) {
          await addField('Report Type', report.extraData.type === 'extension' ? 'Extension of FDP/Flying Hours' : 'Reduction of Rest');
        }
        
        // Part B - Extension of FDP/Flying Hours (matching form order)
        if (report.extraData.type === 'extension') {
          // Crew & Rest Information Section
          if (report.extraData.crewAcclimatised !== undefined) {
            await addField('Crew Acclimatised', report.extraData.crewAcclimatised ? 'Yes' : 'No');
          }
          if (report.extraData.precedingRestGroup) {
            const restLabels: { [key: string]: string } = {
              '18to30': '18–30 hrs',
              'under18': 'Under 18 hrs',
              'over30': 'Over 30 hrs'
            };
            await addField('Length of Preceding Rest', restLabels[report.extraData.precedingRestGroup] || report.extraData.precedingRestGroup);
          }
          
          // FDP Calculations Section
          if (report.extraData.fdpFromTable) {
            await addField('Allowable FDP (Table A/B)', report.extraData.fdpFromTable);
          }
          if (report.extraData.revisedAllowableFdp) {
            await addField('Revised Allowable FDP', report.extraData.revisedAllowableFdp);
          }
          
          // Split Duty Credit Section
          if (report.extraData.splitDutyTimeOff) {
            await addField('Split Duty - Time Off', report.extraData.splitDutyTimeOff);
          }
          if (report.extraData.splitDutyTimeOn) {
            await addField('Split Duty - Time On', report.extraData.splitDutyTimeOn);
          }
          if (report.extraData.splitDutyCredit) {
            await addField('Split Duty - Credit', report.extraData.splitDutyCredit);
          }
          
          // In-Flight Relief Credit Section
          if (report.extraData.inflightReliefRest) {
            await addField('In-Flight Relief - Rest Taken', report.extraData.inflightReliefRest);
          }
          if (report.extraData.inflightReliefSeat) {
            await addField('In-Flight Relief - Bunk/Seat', report.extraData.inflightReliefSeat);
          }
          if (report.extraData.inflightReliefCredit) {
            await addField('In-Flight Relief - Credit', report.extraData.inflightReliefCredit);
          }
        }
        
        // Voyage Details (Extension) - After In-Flight Relief, before Commander's Discretion
        if (report.extraData.type === 'extension' && report.extraData.legs && Array.isArray(report.extraData.legs)) {
          const validLegs = report.extraData.legs.filter((leg: any) => 
            leg.label || leg.place || leg.utcPlanned || leg.localPlanned || leg.utcActual || leg.localActual
          );
          
          if (validLegs.length > 0) {
            const headers = ['Label', 'Place', 'UTC (Planned)', 'Local (Planned)', 'UTC (Actual)', 'Local (Actual)'];
            const rows = validLegs.map((leg: any, idx: number) => {
              const isFdpToEndRow = idx === 9 && leg.label === 'FDP to end';
              const isActualFdpRow = idx === 10 && leg.label === 'Actual FDP';
              
              // Calculate FDP Duration for "FDP to end" row (Planned only)
              let plannedUtcDuration: string | null = null;
              let plannedLocalDuration: string | null = null;
              
              if (isFdpToEndRow) {
                plannedUtcDuration = calculateFdpDurationForColumn(report.extraData.legs, 'utcPlanned');
                plannedLocalDuration = calculateFdpDurationForColumn(report.extraData.legs, 'localPlanned');
              }
              
              // Calculate FDP Duration for "Actual FDP" row (Actual only)
              let actualUtcDuration: string | null = null;
              let actualLocalDuration: string | null = null;
              
              if (isActualFdpRow) {
                actualUtcDuration = calculateFdpDurationForColumn(report.extraData.legs, 'utcActual');
                actualLocalDuration = calculateFdpDurationForColumn(report.extraData.legs, 'localActual');
              }
              
              return [
                leg.label || `Leg ${idx + 1}` || '-',
                isFdpToEndRow ? (plannedUtcDuration ? `FDP: ${plannedUtcDuration}` : 'FDP to end') : isActualFdpRow ? 'Actual FDP' : (leg.place || '-'),
                isFdpToEndRow ? (plannedUtcDuration || '--:--') : isActualFdpRow ? '-' : (leg.utcPlanned || '-'),
                isFdpToEndRow ? (plannedLocalDuration || '--:--') : isActualFdpRow ? '-' : (leg.localPlanned || '-'),
                isFdpToEndRow ? '-' : isActualFdpRow ? (actualUtcDuration || '--:--') : (leg.utcActual || '-'),
                isFdpToEndRow ? '-' : isActualFdpRow ? (actualLocalDuration || '--:--') : (leg.localActual || '-')
              ];
            });
            
            await addTable(headers, rows, 'Voyage Details');
          }
        }
        
        // Commander's Discretion Section (Extension) - After Voyage Details
        if (report.extraData.type === 'extension') {
          if (report.extraData.amountDiscretionHrs !== undefined && 
              report.extraData.amountDiscretionHrs !== null && 
              report.extraData.amountDiscretionHrs !== '' && 
              Number(report.extraData.amountDiscretionHrs) !== 0) {
            await addField('Commander\'s Discretion - Amount (Hours)', report.extraData.amountDiscretionHrs.toString());
          }
          if (report.extraData.amountDiscretionMins !== undefined && 
              report.extraData.amountDiscretionMins !== null && 
              report.extraData.amountDiscretionMins !== '' && 
              Number(report.extraData.amountDiscretionMins) !== 0) {
            await addField('Commander\'s Discretion - Amount (Minutes)', report.extraData.amountDiscretionMins.toString());
          }
          
          // Additional Information Section
          if (report.extraData.maxFlyingHoursNote) {
            await addLongTextField('Maximum Flying Hours Permitted Note', report.extraData.maxFlyingHoursNote, false);
          }
        }
        
        // Part B - Reduction of Rest (matching form order)
        if (report.extraData.type === 'reduction') {
          const formatDateTime24 = (dateTimeStr: string | undefined) => {
            if (!dateTimeStr) return undefined;
            return formatDateTimeToDDMMYYYYHHMM(dateTimeStr);
          };
          
          // Helper function to convert YYYY-MM-DD to DD/MM/YYYY
          const formatDateToDDMMYYYY = (dateStr: string | undefined): string => {
            if (!dateStr) return '';
            // If already in YYYY-MM-DD format (from storage)
            if (dateStr.includes('-') && dateStr.length === 10) {
              const [year, month, day] = dateStr.split('-');
              return `${day}/${month}/${year}`;
            }
            // If already in DD/MM/YYYY format, return as is
            return dateStr;
          };
          
          const formatDateTimeFromParts = (dateStr: string | undefined, timeStr: string | undefined) => {
            if (!dateStr && !timeStr) return undefined;
            const formattedDate = formatDateToDDMMYYYY(dateStr);
            return [formattedDate, timeStr].filter(Boolean).join(' ') || undefined;
          };
          
          // Last Duty Started UTC
          if (report.extraData.lastDutyStartedUtc || report.extraData.lastDutyStartedUtcDate || report.extraData.lastDutyStartedUtcTime) {
            const value = report.extraData.lastDutyStartedUtc 
              ? (formatDateTime24(report.extraData.lastDutyStartedUtc) || report.extraData.lastDutyStartedUtc)
              : formatDateTimeFromParts(report.extraData.lastDutyStartedUtcDate, report.extraData.lastDutyStartedUtcTime);
            if (value) await addField('Last Duty Started (UTC)', value);
          }
          
          // Last Duty Started Local
          if (report.extraData.lastDutyStartedLocal || report.extraData.lastDutyStartedLocalDate || report.extraData.lastDutyStartedLocalTime) {
            const value = report.extraData.lastDutyStartedLocal
              ? (formatDateTime24(report.extraData.lastDutyStartedLocal) || report.extraData.lastDutyStartedLocal)
              : formatDateTimeFromParts(report.extraData.lastDutyStartedLocalDate, report.extraData.lastDutyStartedLocalTime);
            if (value) await addField('Last Duty Started (Local)', value);
          }
          
          // Last Duty Ended UTC
          if (report.extraData.lastDutyEndedUtc || report.extraData.lastDutyEndedUtcDate || report.extraData.lastDutyEndedUtcTime) {
            const value = report.extraData.lastDutyEndedUtc
              ? (formatDateTime24(report.extraData.lastDutyEndedUtc) || report.extraData.lastDutyEndedUtc)
              : formatDateTimeFromParts(report.extraData.lastDutyEndedUtcDate, report.extraData.lastDutyEndedUtcTime);
            if (value) await addField('Last Duty Ended (UTC)', value);
          }
          
          // Last Duty Ended Local
          if (report.extraData.lastDutyEndedLocal || report.extraData.lastDutyEndedLocalDate || report.extraData.lastDutyEndedLocalTime) {
            const value = report.extraData.lastDutyEndedLocal
              ? (formatDateTime24(report.extraData.lastDutyEndedLocal) || report.extraData.lastDutyEndedLocal)
              : formatDateTimeFromParts(report.extraData.lastDutyEndedLocalDate, report.extraData.lastDutyEndedLocalTime);
            if (value) await addField('Last Duty Ended (Local)', value);
          }
          
          // Rest & Next FDP Calculation Section
          if (report.extraData.restEarnedHours) {
            await addField('Rest Earned (Hours)', report.extraData.restEarnedHours);
          }
          
          // Calculated Earliest Next Available UTC
          if (report.extraData.calculatedEarliestNextAvailableUtc || report.extraData.calculatedEarliestNextAvailableUtcDate || report.extraData.calculatedEarliestNextAvailableUtcTime) {
            const value = report.extraData.calculatedEarliestNextAvailableUtc
              ? (formatDateTime24(report.extraData.calculatedEarliestNextAvailableUtc) || report.extraData.calculatedEarliestNextAvailableUtc)
              : formatDateTimeFromParts(report.extraData.calculatedEarliestNextAvailableUtcDate, report.extraData.calculatedEarliestNextAvailableUtcTime);
            if (value) await addField('Calculated Earliest Next Available (UTC)', value);
          }
          
          // Calculated Earliest Next Available Local
          if (report.extraData.calculatedEarliestNextAvailableLocal || report.extraData.calculatedEarliestNextAvailableLocalDate || report.extraData.calculatedEarliestNextAvailableLocalTime) {
            const value = report.extraData.calculatedEarliestNextAvailableLocal
              ? (formatDateTime24(report.extraData.calculatedEarliestNextAvailableLocal) || report.extraData.calculatedEarliestNextAvailableLocal)
              : formatDateTimeFromParts(report.extraData.calculatedEarliestNextAvailableLocalDate, report.extraData.calculatedEarliestNextAvailableLocalTime);
            if (value) await addField('Calculated Earliest Next Available (Local)', value);
          }
          
          // Actual Start Next FDP UTC
          if (report.extraData.actualStartNextFdpUtc || report.extraData.actualStartNextFdpUtcDate || report.extraData.actualStartNextFdpUtcTime) {
            const value = report.extraData.actualStartNextFdpUtc
              ? (formatDateTime24(report.extraData.actualStartNextFdpUtc) || report.extraData.actualStartNextFdpUtc)
              : formatDateTimeFromParts(report.extraData.actualStartNextFdpUtcDate, report.extraData.actualStartNextFdpUtcTime);
            if (value) await addField('Actual Start of Next FDP (UTC)', value);
          }
          
          // Actual Start Next FDP Local
          if (report.extraData.actualStartNextFdpLocal || report.extraData.actualStartNextFdpLocalDate || report.extraData.actualStartNextFdpLocalTime) {
            const value = report.extraData.actualStartNextFdpLocal
              ? (formatDateTime24(report.extraData.actualStartNextFdpLocal) || report.extraData.actualStartNextFdpLocal)
              : formatDateTimeFromParts(report.extraData.actualStartNextFdpLocalDate, report.extraData.actualStartNextFdpLocalTime);
            if (value) await addField('Actual Start of Next FDP (Local)', value);
          }
          
          // Reduction Details Section
          if (report.extraData.restReducedBy) {
            await addField('Rest Period Reduced By', report.extraData.restReducedBy);
          }
          if (report.extraData.crewAffected) {
            await addField('Crew Affected', report.extraData.crewAffected);
          }
        }
        
        // Part C - Commander's Report
        if (report.extraData.remarksActionTaken) {
          await addLongTextField('Remarks / Action Taken', report.extraData.remarksActionTaken, false);
        }
      }

      // CHR Details - Arabic labels with RTL layout
      if (report.reportType === 'chr' && report.extraData) {
        await addSectionHeader('تفاصيل تقرير المخاطر السرية (CHR)', true);
        
        // Hazard Description and Recommendations
        if (report.extraData.hazardDescription) {
          await addLongTextField('وصف الخطر', report.extraData.hazardDescription, true);
        }
        if (report.extraData.recommendations) {
          await addLongTextField('التوصيات', report.extraData.recommendations, true);
        }
        
        // Reporter Information
        if (report.extraData.reporterName) {
          await addField('اسم المُبلِّغ', report.extraData.reporterName, 1, true);
        }
        if (report.extraData.reporterPosition) {
          await addField('الوظيفة', report.extraData.reporterPosition, 1, true);
        }
        if (report.extraData.reporterIdNo) {
          await addField('رقم الهوية', report.extraData.reporterIdNo, 1, true);
        }
        if (report.extraData.reporterDate) {
          await addField('تاريخ البلاغ', report.extraData.reporterDate, 1, true);
        }
        
        // Safety Officer Information
        if (report.extraData.validationNotes) {
          await addLongTextField('ملاحظات التحقق', report.extraData.validationNotes, true);
        }
        if (report.extraData.safetyOfficerName) {
          await addField('اسم مسؤول السلامة', report.extraData.safetyOfficerName, 1, true);
        }
        if (report.extraData.safetyOfficerDate) {
          await addField('تاريخ مسؤول السلامة', report.extraData.safetyOfficerDate, 1, true);
        }
        
        // Corrective Action
        if (report.extraData.correctiveActionNotes) {
          await addLongTextField('ملاحظات الإجراء التصحيحي', report.extraData.correctiveActionNotes, true);
        }
        if (report.extraData.correctiveName) {
          await addField('اسم مُنفّذ الإجراء', report.extraData.correctiveName, 1, true);
        }
        if (report.extraData.correctiveDate) {
          await addField('تاريخ الإجراء التصحيحي', report.extraData.correctiveDate, 1, true);
        }
        
        // Follow-Up
        if (report.extraData.followUpActionTaken) {
          await addLongTextField('إجراء المتابعة المتخذ', report.extraData.followUpActionTaken, true);
        }
        if (report.extraData.followUpDecision) {
          const decisionLabels: { [key: string]: string } = {
            'SAT': 'SAT (مقبول)',
            'UNSAT': 'UNSAT (غير مقبول)',
            'NEXT_AUDIT': 'NEXT AUDIT (التدقيق القادم)'
          };
          await addField('قرار المتابعة', decisionLabels[report.extraData.followUpDecision] || report.extraData.followUpDecision, 1, true);
        }
      }

      // Captain Report Details - Matching form order
      if (report.reportType === 'captain' && report.extraData) {
        await addSectionHeader('CAPTAIN REPORT DETAILS');
        
        // Flight Information Section - Matching form order
        await addSectionHeader('Flight Information');
        
        if (report.extraData.aircraftReg) {
          await addField('Aircraft reg', report.extraData.aircraftReg);
        }
        if (report.flightNumber) {
          await addField('Flight number', report.flightNumber);
        }
        if (report.eventDateTime) {
          try {
            const eventDate = new Date(report.eventDateTime);
            if (!isNaN(eventDate.getTime())) {
              await addField('Date of flight', formatDateToDDMMYYYY(eventDate));
            }
          } catch {
            // Invalid date, skip
          }
        }
        if (report.extraData.aircraftType) {
          await addField('Aircraft Type', report.extraData.aircraftType);
        }
        if (report.extraData.captainEmail) {
          await addField('Captain email', report.extraData.captainEmail);
        }
        
        // Crew Information Section - Matching form order
        if (report.extraData.cm1 || report.extraData.cm2 || report.extraData.chiefCabin) {
          await addSectionHeader('Crew Information');
          
          if (report.extraData.cm1) {
            await addField('CM 1', report.extraData.cm1);
          }
          if (report.extraData.cm2) {
            await addField('CM 2', report.extraData.cm2);
          }
          if (report.extraData.chiefCabin) {
            await addField('Chief Cabin', report.extraData.chiefCabin);
          }
        }
        
        // Captain report content
        if (report.description && report.description.trim()) {
          yPosition += 3;
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'bold');
          pdf.text('Captain report', margin, yPosition);
          yPosition += 5;
          pdf.setFont('helvetica', 'normal');
          await addText(report.description, 9);
        }
        
        // Captain comments
        if (report.extraData.captainComments && report.extraData.captainComments.trim()) {
          yPosition += 3;
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'bold');
          pdf.text('Captain comments', margin, yPosition);
          yPosition += 5;
          pdf.setFont('helvetica', 'normal');
          await addText(report.extraData.captainComments, 9);
        }
      }

      // RIR Details - Matching form order with grid layout
      if (report.reportType === 'rir' && report.extraData) {
        await addSectionHeader('RAMP INCIDENT REPORT (RIR) DETAILS');
        
        // Incident Information (matching form order)
        if (report.extraData.incidentTitle) {
          await addLongTextField('Incident Title', report.extraData.incidentTitle, false);
        }
        if (report.extraData.damageIn) {
          await addField('Damage In', report.extraData.damageIn);
        }
        
        // Damage By (matching form order)
        if (report.extraData.damageByAircraft || report.extraData.damageByRampEq || report.extraData.damageByVehicle || report.extraData.damageByForeignObj || report.extraData.damageByJetBlast || report.extraData.damageByUnknown || report.extraData.damageByOther) {
          const damageBy = [
            report.extraData.damageByAircraft && 'Aircraft',
            report.extraData.damageByRampEq && 'Ramp Equipment',
            report.extraData.damageByVehicle && 'Vehicle',
            report.extraData.damageByForeignObj && 'Foreign Object',
            report.extraData.damageByJetBlast && 'Jet Blast',
            report.extraData.damageByUnknown && 'Unknown',
            report.extraData.damageByOther
          ].filter(Boolean).join(', ');
          await addField('Damage By', damageBy);
        }
        
        // Date and Time (matching form order)
        if (report.extraData.date) {
          await addField('Date', report.extraData.date);
        }
        if (report.extraData.timeOfOccurrence) {
          await addField('Time of Occurrence', report.extraData.timeOfOccurrence);
        }
        
        // Phase and Location (matching form order)
        if (report.extraData.phaseOfOperation) {
          await addField('Phase of Operation', report.extraData.phaseOfOperation);
        }
        if (report.extraData.areaStand) {
          await addField('Area / Stand', report.extraData.areaStand);
        }
        
        // Aircraft Information (matching form order)
        if (report.extraData.aircraftRegistration) {
          await addField('Aircraft Registration', report.extraData.aircraftRegistration);
        }
        if (report.extraData.aircraftType) {
          await addField('Aircraft Type', report.extraData.aircraftType);
        }
        if (report.extraData.flightNo) {
          await addField('Flight No.', report.extraData.flightNo);
        }
        if (report.extraData.scheduledGroundTime) {
          await addField('Scheduled Ground Time', report.extraData.scheduledGroundTime);
        }
        
        // Flight Delay (matching form order)
        if (report.extraData.flightDelayHrs || report.extraData.flightDelayMin) {
          await addField('Flight Delay', `${report.extraData.flightDelayHrs || '0'} hrs ${report.extraData.flightDelayMin || '0'} min`);
        }
        if (report.extraData.flightCancelled) {
          await addField('Flight Cancelled', report.extraData.flightCancelled === 'yes' ? 'Yes' : 'No');
        }
        
        // Type of Occurrence (matching form order)
        if (report.extraData.typeOfOccurrence) {
          await addLongTextField('Type of Occurrence', report.extraData.typeOfOccurrence, false);
        }
        
        // Casualties (matching form order)
        if (report.extraData.casualtiesEmployeesFatal || report.extraData.casualtiesEmployeesNonFatal || report.extraData.casualtiesPassengersFatal || report.extraData.casualtiesPassengersNonFatal || report.extraData.casualtiesOthersFatal || report.extraData.casualtiesOthersNonFatal) {
          const casualties = [
            report.extraData.casualtiesEmployeesFatal && `Employees Fatal: ${report.extraData.casualtiesEmployeesFatal}`,
            report.extraData.casualtiesEmployeesNonFatal && `Employees Non-Fatal: ${report.extraData.casualtiesEmployeesNonFatal}`,
            report.extraData.casualtiesPassengersFatal && `Passengers Fatal: ${report.extraData.casualtiesPassengersFatal}`,
            report.extraData.casualtiesPassengersNonFatal && `Passengers Non-Fatal: ${report.extraData.casualtiesPassengersNonFatal}`,
            report.extraData.casualtiesOthersFatal && `Others Fatal: ${report.extraData.casualtiesOthersFatal}`,
            report.extraData.casualtiesOthersNonFatal && `Others Non-Fatal: ${report.extraData.casualtiesOthersNonFatal}`
          ].filter(Boolean).join(' | ');
          await addField('Casualties', casualties);
        }
        
        // Vehicle/Ramp Equipment Information (matching form order)
        if (report.extraData.serialFleetNr) {
          await addField('Serial / Fleet Nr.', report.extraData.serialFleetNr);
        }
        if (report.extraData.vehicleType) {
          await addField('Vehicle Type', report.extraData.vehicleType);
        }
        if (report.extraData.owner) {
          await addField('Owner', report.extraData.owner);
        }
        if (report.extraData.areaVehicle) {
          await addField('Area Vehicle', report.extraData.areaVehicle);
        }
        
        // Vehicle Condition (matching form order)
        if (report.extraData.tiresSvc || report.extraData.tiresFault || report.extraData.brakesSvc || report.extraData.brakesFault || report.extraData.steeringSvc || report.extraData.steeringFault || report.extraData.lightsSvc || report.extraData.lightsFault || report.extraData.wipersSvc || report.extraData.wipersFault || report.extraData.protectionSvc || report.extraData.protectionFault || report.extraData.warningSvc || report.extraData.warningFault || report.extraData.stabilizersSvc || report.extraData.stabilizersFault || report.extraData.towHitchSvc || report.extraData.towHitchFault || report.extraData.fieldVisionSvc || report.extraData.fieldVisionFault) {
          const vehicleCondition = [
            report.extraData.tiresSvc && 'Tires: Serviceable',
            report.extraData.tiresFault && 'Tires: Faulty',
            report.extraData.brakesSvc && 'Brakes: Serviceable',
            report.extraData.brakesFault && 'Brakes: Faulty',
            report.extraData.steeringSvc && 'Steering: Serviceable',
            report.extraData.steeringFault && 'Steering: Faulty',
            report.extraData.lightsSvc && 'Lights: Serviceable',
            report.extraData.lightsFault && 'Lights: Faulty',
            report.extraData.wipersSvc && 'Wipers: Serviceable',
            report.extraData.wipersFault && 'Wipers: Faulty',
            report.extraData.protectionSvc && 'Protection: Serviceable',
            report.extraData.protectionFault && 'Protection: Faulty',
            report.extraData.warningSvc && 'Warning: Serviceable',
            report.extraData.warningFault && 'Warning: Faulty',
            report.extraData.stabilizersSvc && 'Stabilizers: Serviceable',
            report.extraData.stabilizersFault && 'Stabilizers: Faulty',
            report.extraData.towHitchSvc && 'Tow Hitch: Serviceable',
            report.extraData.towHitchFault && 'Tow Hitch: Faulty',
            report.extraData.fieldVisionSvc && 'Field Vision: Serviceable',
            report.extraData.fieldVisionFault && 'Field Vision: Faulty'
          ].filter(Boolean).join(' | ');
          await addField('Vehicle/Ramp Equipment Condition', vehicleCondition);
        }
        
        // Weather/Surface/Lighting (matching form order)
        if (report.extraData.wRain || report.extraData.wSnow || report.extraData.wSleet || report.extraData.wHail || report.extraData.wFog || report.extraData.visibilityKm || report.extraData.windGustKts || report.extraData.temperatureC) {
          const weather = [
            report.extraData.wRain && 'Rain',
            report.extraData.wSnow && 'Snow',
            report.extraData.wSleet && 'Sleet',
            report.extraData.wHail && 'Hail',
            report.extraData.wFog && 'Fog',
            report.extraData.visibilityKm && `Visibility: ${report.extraData.visibilityKm} km`,
            report.extraData.windGustKts && `Wind Gust: ${report.extraData.windGustKts} kts`,
            report.extraData.temperatureC && `Temperature: ${report.extraData.temperatureC}°C`
          ].filter(Boolean).join(' | ');
          await addField('Weather', weather);
        }
        if (report.extraData.sDry || report.extraData.sWet || report.extraData.sSnow || report.extraData.sSlush || report.extraData.sIce || report.extraData.sContamination) {
          const surface = [
            report.extraData.sDry && 'Dry',
            report.extraData.sWet && 'Wet',
            report.extraData.sSnow && 'Snow',
            report.extraData.sSlush && 'Slush',
            report.extraData.sIce && 'Ice',
            report.extraData.sContamination && 'Contamination'
          ].filter(Boolean).join(' | ');
          await addField('Surface', surface);
        }
        if (report.extraData.lGood || report.extraData.lPoor || report.extraData.lDay || report.extraData.lNight || report.extraData.lTwilight) {
          const lighting = [
            report.extraData.lGood && 'Good',
            report.extraData.lPoor && 'Poor',
            report.extraData.lDay && 'Day',
            report.extraData.lNight && 'Night',
            report.extraData.lTwilight && 'Twilight'
          ].filter(Boolean).join(' | ');
          await addField('Lighting', lighting);
        }
        
        // Contributory Factors (matching form order)
        if (report.extraData.contributoryMajor) {
          await addLongTextField('Contributory Major', report.extraData.contributoryMajor, false);
        }
        if (report.extraData.contributoryOther) {
          await addLongTextField('Contributory Other', report.extraData.contributoryOther, false);
        }
        
        // Personnel (matching form order)
        if (report.extraData.personnel && Array.isArray(report.extraData.personnel) && report.extraData.personnel.length > 0) {
          const personnel = report.extraData.personnel.map((p: any, idx: number) => 
            p.name || p.jobTitle || p.company ? 
              `Person ${idx + 1}: ${[p.name, p.jobTitle, p.company, p.staffNr, p.license].filter(Boolean).join(' - ')}` : 
              null
          ).filter(Boolean).join(' | ');
          if (personnel) {
            await addField('Personnel', personnel);
          }
        }
        
        // Report Prepared By (matching form order)
        if (report.extraData.reportPreparedBy) {
          await addField('Report Prepared By', report.extraData.reportPreparedBy);
        }
        if (report.extraData.reportPosition) {
          await addField('Report Position', report.extraData.reportPosition);
        }
        
        // Remarks (matching form order)
        if (report.extraData.remarks) {
          await addLongTextField('Remarks', report.extraData.remarks, false);
        }
      }

      // === COMMENTS ===
      if (report.comments && report.comments.length > 0) {
        addSectionHeader(`COMMENTS (${report.comments.length})`);
        
        for (const comment of report.comments) {
          checkNewPage(20);
          
          // Light gray background for comment box
          pdf.setFillColor(248, 248, 248);
          pdf.setDrawColor(220, 220, 220);
          
          // Calculate comment content height first (no images for NCR)
          let commentContentHeight = 10;
          if (report.reportType === 'ncr') {
            const processedComment = processArabicText(comment.content);
            const lines = pdf.splitTextToSize(processedComment, contentWidth - 6);
            commentContentHeight = lines.length * 4;
          } else if (hasArabicChars(comment.content)) {
            // Non-NCR Arabic: fallback logic (unchanged)
            const lines = pdf.splitTextToSize(comment.content, contentWidth - 6);
            commentContentHeight = lines.length * 4;
          } else {
            // Regular text height calculation
            const lines = pdf.splitTextToSize(comment.content, contentWidth - 6);
            commentContentHeight = lines.length * 4;
          }
          
          const totalCommentHeight = Math.max(15, commentContentHeight + 12);
          pdf.rect(margin, yPosition, contentWidth, totalCommentHeight, 'FD');
          
          // User name
          pdf.setFontSize(8);
          pdf.setTextColor(0, 0, 0);
          // Use Arabic font for NCR reports
          if (report.reportType === 'ncr' && arabicFontAvailable) {
            try {
              pdf.setFont('Amiri-Regular', 'normal');
            } catch {
              pdf.setFont('helvetica', 'bold');
            }
          } else {
            pdf.setFont('helvetica', 'bold');
          }
          const userName = comment.user?.firstName && comment.user?.lastName
            ? `${comment.user.firstName} ${comment.user.lastName}`
            : comment.user?.email || 'Unknown';
          pdf.text(userName, margin + 2, yPosition + 5);
          
          // Timestamp
          if (comment.createdAt) {
            // Use Arabic font for NCR reports
            if (report.reportType === 'ncr' && arabicFontAvailable) {
              try {
                pdf.setFont('Amiri-Regular', 'normal');
              } catch {
                pdf.setFont('helvetica', 'normal');
              }
            } else {
              pdf.setFont('helvetica', 'normal');
            }
            pdf.setTextColor(100, 100, 100);
            pdf.text(formatDateTimeToDDMMYYYYHHMM(comment.createdAt), pageWidth - margin - 40, yPosition + 5);
          }
          
          // Comment content - handle Arabic text for NCR reports
          const commentStartY = yPosition + 10;
          const isNCRComment = report.reportType === 'ncr';
          if (isNCRComment && arabicFontAvailable) {
            // For NCR reports, use Arabic font directly with text processing
            pdf.setFontSize(9);
            pdf.setTextColor(0, 0, 0);
            try {
              pdf.setFont('Amiri-Regular', 'normal');
            } catch {
              pdf.setFont('helvetica', 'normal');
            }
            const processedComment = processArabicText(comment.content);
            const commentLines = pdf.splitTextToSize(processedComment, contentWidth - 6);
            commentLines.forEach((line: string, lineIndex: number) => {
              pdf.text(line, margin + contentWidth - 2, commentStartY + (lineIndex * 4), { align: 'right' });
            });
            yPosition += totalCommentHeight + 3;
          } else {
            // Regular text rendering for non-Arabic
            pdf.setFontSize(9);
            pdf.setTextColor(0, 0, 0);
            pdf.setFont('helvetica', 'normal');
            const commentLines = pdf.splitTextToSize(comment.content, contentWidth - 6);
            commentLines.forEach((line: string, lineIndex: number) => {
              pdf.text(line, margin + 2, commentStartY + (lineIndex * 4));
            });
            yPosition += totalCommentHeight + 3;
          }
        }
      }

      // === FOOTER ===
      const totalPages = pdf.internal.pages.length - 1;
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        
        // Footer line (gray)
        pdf.setDrawColor(200, 200, 200);
        pdf.setLineWidth(0.2);
        pdf.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
        
        // Footer text (small, gray)
        pdf.setFontSize(7);
        pdf.setTextColor(120, 120, 120);
        // Use Arabic font for NCR reports
        if (report.reportType === 'ncr' && arabicFontAvailable) {
          try {
            pdf.setFont('Amiri-Regular', 'normal');
          } catch {
            pdf.setFont('helvetica', 'normal');
          }
        } else {
          pdf.setFont('helvetica', 'normal');
        }
        pdf.text(`Generated on ${formatDateTimeToDDMMYYYYHHMMSS(new Date())}`, margin, pageHeight - 8);
        
        // Page number
        pdf.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
        
        // Company info (centered if space allows) - email only, no phone
        if (companySettings?.email) {
          const textWidth = pdf.getTextWidth(companySettings.email);
          if (textWidth < contentWidth - 80) {
            pdf.text(companySettings.email, pageWidth / 2, pageHeight - 8, { align: 'center' });
          }
        }
      }

    return pdf;
  };

  // Function to open PDF directly in new tab (view only)
  const openPDF = async () => {
    if (!report || isOpeningPDF || isGeneratingPDF) return;

    // Update UI immediately for better responsiveness
    setIsOpeningPDF(true);
    
    // Use setTimeout to allow React to update UI before heavy work
    await new Promise(resolve => setTimeout(resolve, 0));
    
    try {
      const pdf = await createPDF();
      if (!pdf) {
        setIsOpeningPDF(false);
        return;
      }
      
      const blob = pdf.output('blob');
      const url = URL.createObjectURL(blob);
      
      // Detect iOS devices
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      
      // For iOS, use <a> tag with click() to avoid pop-up blocker
      // For other browsers, use window.open() or <a> tag
      if (isIOS) {
        // Create a temporary link element and click it
        // This avoids pop-up blocker on iOS Safari
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.style.display = 'none';
        document.body.appendChild(link);
        
        // Trigger click immediately (synchronous user action)
        link.click();
        
        // Clean up after a delay
        setTimeout(() => {
          document.body.removeChild(link);
          // Keep URL alive longer for iOS (allow PDF to fully load)
          setTimeout(() => {
            URL.revokeObjectURL(url);
          }, 5000);
        }, 100);
        
        toast({
          title: "PDF Opened",
          description: "PDF opened in new tab for viewing.",
        });
      } else {
        // For non-iOS, try window.open first
        const newWindow = window.open(url, '_blank');
        if (newWindow) {
          toast({
            title: "PDF Opened",
            description: "PDF opened in new tab for viewing.",
          });
          setTimeout(() => {
            URL.revokeObjectURL(url);
          }, 2000);
        } else {
          // Fallback: use <a> tag for non-iOS if pop-up blocked
          const link = document.createElement('a');
          link.href = url;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.style.display = 'none';
          document.body.appendChild(link);
          link.click();
          
          setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
          }, 2000);
          
          toast({
            title: "PDF Opened",
            description: "PDF opened in new tab for viewing.",
          });
        }
      }
    } catch (error) {
      console.error('Error opening PDF:', error);
      toast({
        title: "Error",
        description: "Failed to open PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsOpeningPDF(false);
    }
  };

  // Function to export PDF (save/share only, no opening)
  const generatePDF = async () => {
    if (!report || isGeneratingPDF || isOpeningPDF) return;

    // Update UI immediately for better responsiveness
    setIsGeneratingPDF(true);
    
    // Use setTimeout to allow React to update UI before heavy work
    await new Promise(resolve => setTimeout(resolve, 0));
    
    try {
      const pdf = await createPDF();
      if (!pdf) {
        setIsGeneratingPDF(false);
        return;
      }
      
      // Save/Share PDF - Support all devices (Desktop, iOS, iPad, Android)
      const reportTypeDisplay = report.reportType.toLowerCase() === 'cdf' ? 'CDR' : report.reportType.toUpperCase();
      const fileName = `${reportTypeDisplay}-Report-${report.id.slice(0, 5).toUpperCase()}.pdf`;
      
      // Generate blob from PDF
      const blob = pdf.output('blob');
      const url = URL.createObjectURL(blob);
      
      // Detect mobile devices
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      
      // Try Web Share API first for mobile devices
      if (isMobile && navigator.share) {
        try {
          const file = new File([blob], fileName, { type: 'application/pdf' });
          
          // Check if can share files (iOS 14.5+ and Android Chrome 76+)
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: `${getReportTypeDisplayName(report.reportType)} Report`,
              text: `Report #${report.id.slice(0, 5).toUpperCase()}`,
              files: [file]
            });
            toast({
              title: "PDF Shared",
              description: "Report PDF has been shared successfully.",
            });
            URL.revokeObjectURL(url);
            return;
          } else if (!isIOS) {
            // For Android, try sharing without files (older versions)
            await navigator.share({
              title: `${getReportTypeDisplayName(report.reportType)} Report`,
              text: `Report #${report.id.slice(0, 5).toUpperCase()}`,
            });
            toast({
              title: "PDF Shared",
              description: "PDF shared. Check your device for download options.",
            });
            URL.revokeObjectURL(url);
            return;
          }
        } catch (error: any) {
          // User cancelled or share failed, fall through to download
          if (error.name !== 'AbortError') {
            console.log('Share not available or failed, using download:', error);
          }
        }
      }
      
      // Download method for desktop or when share fails
      try {
        // Create a temporary link and trigger download
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        
        // Clean up after a short delay
        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }, 100);
        
        toast({
          title: "PDF Downloaded",
          description: "Report PDF has been downloaded successfully.",
        });
      } catch (error) {
        console.error('Download failed:', error);
        // Final fallback: use save method (works on most browsers)
        pdf.save(fileName);
        toast({
          title: "PDF Generated",
          description: "Report PDF has been generated. Please check your downloads.",
        });
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Error",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  if (authLoading || !isAuthenticated) {
    return null;
  }

  const canUpdateStatus = user?.role === 'admin';

  return (
    <div className="flex-1 overflow-auto">
      <div className="container max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">

        {isLoading ? (
          <div className="space-y-6">
            <Card className="p-8">
              <Skeleton className="h-8 w-64 mb-4" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-3/4" />
            </Card>
          </div>
        ) : report ? (
          <>
            {/* Report Header - PDF Style */}
            <div className="bg-card border border-border rounded-lg shadow-sm mb-6">
              <div className="p-6 border-b border-border">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex items-start gap-4">
                    {companySettings?.logo && (
                      <img 
                        src={companySettings.logo} 
                        alt="Company Logo" 
                        className="w-12 h-12 object-contain"
                      />
                    )}
                    <div>
                      <h1 className="text-xl font-bold text-card-foreground">
                        {companySettings?.companyName || 'Report Sys'}
                      </h1>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {getReportTypeDisplayName(report.reportType)} Report
                      </p>
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground space-y-1">
                    <p className="font-mono">Report ID: #{report.id.slice(0, 5).toUpperCase()}</p>
                    {report.createdAt && (
                      <p className="font-mono">Report Time: {format(new Date(report.createdAt), 'dd/MM/yyyy HH:mm')}</p>
                    )}
                    {report.updatedAt && report.updatedAt !== report.createdAt && (
                      <p className="font-mono text-muted-foreground/70">Last Updated: {format(new Date(report.updatedAt), 'dd/MM/yyyy HH:mm')}</p>
                    )}
                    <p className="font-bold">Status: {report.status.toUpperCase().replace('_', ' ')}</p>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                  <Button variant="ghost" asChild className="w-full sm:w-auto">
                    <Link href="/reports">
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back to Reports
                    </Link>
                  </Button>
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <Button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        openPDF();
                      }}
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto"
                      disabled={isOpeningPDF || isGeneratingPDF}
                    >
                      <Eye className="h-4 w-4" />
                      <span>{isOpeningPDF ? "Opening..." : "Open PDF"}</span>
                    </Button>
                    <Button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        generatePDF();
                      }}
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto"
                      disabled={isOpeningPDF || isGeneratingPDF}
                    >
                      <Download className="h-4 w-4" />
                      <span>{isGeneratingPDF ? "Exporting..." : "Export PDF"}</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Report Details - PDF Style */}
            <div className="bg-card border border-border rounded-lg shadow-sm mb-6">
              <div className="p-6 sm:p-8 space-y-8" id="report-content">
                {/* Description Section */}
                {report.description && report.reportType !== 'captain' && report.reportType !== 'asr' && report.reportType !== 'ncr' && report.reportType !== 'cdf' && report.reportType !== 'chr' && report.reportType !== 'or' && report.reportType !== 'rir' && (() => {
                  const desc = report.description.trim();
                  if (desc && desc !== 'Standard: UTC' && desc.length > 3) {
                    return (
                      <div className="mt-4">
                        <div className="text-xs text-muted-foreground mb-1">Description</div>
                        <div className="text-sm leading-relaxed whitespace-pre-wrap bg-muted/50 p-3 rounded">{report.description}</div>
                </div>
                    );
                  }
                  return null;
                })()}

                {/* ASR Details */}
                {report.reportType === 'asr' && report.extraData && (
                  <div>
                    <div className="bg-muted border border-border rounded px-3 py-2 mb-4">
                      <h3 className="text-xs font-bold text-card-foreground uppercase tracking-wide">AIR SAFETY REPORT (ASR) DETAILS</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* 1. Header Information - Matching form order */}
                      {report.extraData.isReportable && (
                        <div>
                          <div className="text-xs text-muted-foreground">Reportable Occurrence</div>
                          <div className="text-sm font-medium uppercase">{report.extraData.isReportable}</div>
                        </div>
                      )}
                      {(report.extraData.cm1 || report.extraData.cm2 || report.extraData.cm3) && (
                        <div>
                          <div className="text-xs text-muted-foreground">Crew Members (CM1, CM2, CM3)</div>
                          <div className="text-sm font-medium">
                            {[report.extraData.cm1, report.extraData.cm2, report.extraData.cm3].filter(Boolean).join(' | ')}
                </div>
                </div>
                      )}
                      {report.extraData.eventTypes && Array.isArray(report.extraData.eventTypes) && report.extraData.eventTypes.length > 0 && (
                        <div className="col-span-1 md:col-span-2">
                          <div className="text-xs text-muted-foreground">Type of Event</div>
                          <div className="text-sm font-medium">{report.extraData.eventTypes.join(', ')}</div>
              </div>
                      )}
                      
                      {/* 2. Date/Time/Standard */}
                      {report.extraData.date && (
                        <div>
                          <div className="text-xs text-muted-foreground">Date</div>
                          <div className="text-sm font-medium">{report.extraData.date}</div>
                        </div>
                      )}
                      {report.extraData.time && (
                        <div>
                          <div className="text-xs text-muted-foreground">Time {report.extraData.timeStandard ? `(${report.extraData.timeStandard})` : ''}</div>
                          <div className="text-sm font-medium">{report.extraData.time}</div>
                        </div>
                      )}
                      {/* Only show Standard if it's explicitly set and not just default "UTC", and time is not set */}
                      {report.extraData.timeStandard && 
                       report.extraData.timeStandard !== 'UTC' && 
                       !report.extraData.time && (
                        <div>
                          <div className="text-xs text-muted-foreground">Standard</div>
                          <div className="text-sm font-medium">{report.extraData.timeStandard}</div>
                        </div>
                      )}
                      
                      {/* 3. Callsign, From, To */}
                      {report.extraData.callsign && (
                  <div>
                          <div className="text-xs text-muted-foreground">Callsign</div>
                          <div className="text-sm font-medium">{report.extraData.callsign}</div>
                        </div>
                      )}
                      {report.extraData.routeFrom && (
                        <div>
                          <div className="text-xs text-muted-foreground">From</div>
                          <div className="text-sm font-medium">{report.extraData.routeFrom}</div>
                        </div>
                      )}
                      {report.extraData.routeTo && (
                        <div>
                          <div className="text-xs text-muted-foreground">To</div>
                          <div className="text-sm font-medium">{report.extraData.routeTo}</div>
                  </div>
                )}

                      {/* 4. Diverted To, Aircraft Type, Registration, Passengers/Crew */}
                      {report.extraData.divertedTo && (
                  <div>
                          <div className="text-xs text-muted-foreground">Diverted To</div>
                          <div className="text-sm font-medium">{report.extraData.divertedTo}</div>
                        </div>
                      )}
                      {report.extraData.aircraftType && (
                        <div>
                          <div className="text-xs text-muted-foreground">Aircraft Type</div>
                          <div className="text-sm font-medium">{report.extraData.aircraftType}</div>
                        </div>
                      )}
                      {report.extraData.registration && (
                        <div>
                          <div className="text-xs text-muted-foreground">Registration</div>
                          <div className="text-sm font-medium">{report.extraData.registration}</div>
                        </div>
                      )}
                      {report.extraData.paxCrew && (
                        <div>
                          <div className="text-xs text-muted-foreground">Passengers/Crew</div>
                          <div className="text-sm font-medium">{report.extraData.paxCrew}</div>
                  </div>
                )}

                      {/* 5. Tech Log Page, Phase of Flight, Altitude, Speed/Mach */}
                      {report.extraData.techLogPage && (
                  <div>
                          <div className="text-xs text-muted-foreground">Tech Log Page</div>
                          <div className="text-sm font-medium">{report.extraData.techLogPage}</div>
                        </div>
                      )}
                      {report.extraData.phaseOfFlight && (
                        <div>
                          <div className="text-xs text-muted-foreground">Phase of Flight</div>
                          <div className="text-sm font-medium">{report.extraData.phaseOfFlight}</div>
                        </div>
                      )}
                      {report.extraData.altitude && (
                        <div>
                          <div className="text-xs text-muted-foreground">Altitude (ft)</div>
                          <div className="text-sm font-medium">{report.extraData.altitude}</div>
                        </div>
                      )}
                      {report.extraData.speedMach && (
                        <div>
                          <div className="text-xs text-muted-foreground">Speed/Mach</div>
                          <div className="text-sm font-medium">{report.extraData.speedMach}</div>
                  </div>
                )}

                      {/* 6. Fuel Dump, MET Conditions, VMC Distance, Runway */}
                      {report.extraData.fuelDumpKg && (
                  <div>
                          <div className="text-xs text-muted-foreground">Fuel Dump (Kg)</div>
                          <div className="text-sm font-medium">{report.extraData.fuelDumpKg}</div>
                        </div>
                      )}
                      {report.extraData.metConditions && (
                        <div>
                          <div className="text-xs text-muted-foreground">MET Conditions</div>
                          <div className="text-sm font-medium">{report.extraData.metConditions}</div>
                        </div>
                      )}
                      {report.extraData.vmcDistanceKm && (
                        <div>
                          <div className="text-xs text-muted-foreground">VMC Distance (km)</div>
                          <div className="text-sm font-medium">{report.extraData.vmcDistanceKm}</div>
                        </div>
                      )}
                      {(report.extraData.runwayDesignator || report.extraData.runwaySide || report.extraData.runwayCondition) && (
                        <div>
                          <div className="text-xs text-muted-foreground">Runway</div>
                          <div className="text-sm font-medium">
                            {[report.extraData.runwayDesignator, report.extraData.runwaySide, report.extraData.runwayCondition].filter(Boolean).join('/')}
                          </div>
                  </div>
                )}

                      {/* 7. Weather Information */}
                      {report.extraData.wxWind && (
                <div>
                          <div className="text-xs text-muted-foreground">Wind</div>
                          <div className="text-sm font-medium">{report.extraData.wxWind}</div>
                </div>
                      )}
                      {report.extraData.wxVisibility && (
                        <div>
                          <div className="text-xs text-muted-foreground">Visibility/RVR</div>
                          <div className="text-sm font-medium">{report.extraData.wxVisibility}</div>
                        </div>
                      )}
                      {report.extraData.wxClouds && (
                        <div>
                          <div className="text-xs text-muted-foreground">Clouds</div>
                          <div className="text-sm font-medium">{report.extraData.wxClouds}</div>
                        </div>
                      )}
                      {report.extraData.wxTemp && (
                        <div>
                          <div className="text-xs text-muted-foreground">Temp (°C)</div>
                          <div className="text-sm font-medium">{report.extraData.wxTemp}</div>
                        </div>
                      )}
                      {report.extraData.wxQnh && (
                        <div>
                          <div className="text-xs text-muted-foreground">QNH (hPa)</div>
                          <div className="text-sm font-medium">{report.extraData.wxQnh}</div>
                        </div>
                      )}
                      {report.extraData.wxSignificant && Array.isArray(report.extraData.wxSignificant) && report.extraData.wxSignificant.length > 0 && (
                        <div className="col-span-1 md:col-span-2">
                          <div className="text-xs text-muted-foreground">Significant WX</div>
                          <div className="text-sm font-medium">{report.extraData.wxSignificant.join(', ')}</div>
                        </div>
                      )}
                      
                      {/* 8. Aircraft Configuration */}
                      {report.extraData.cfgAutopilot !== undefined && (
                  <div>
                          <div className="text-xs text-muted-foreground">Autopilot</div>
                          <div className="text-sm font-medium">{report.extraData.cfgAutopilot ? 'ON' : 'OFF'}</div>
                  </div>
                )}
                      {report.extraData.cfgGear !== undefined && (
                        <div>
                          <div className="text-xs text-muted-foreground">Gear</div>
                          <div className="text-sm font-medium">{report.extraData.cfgGear ? 'DOWN' : 'UP'}</div>
                        </div>
                      )}
                      {report.extraData.cfgFlaps !== undefined && (
                        <div>
                          <div className="text-xs text-muted-foreground">Flaps</div>
                          <div className="text-sm font-medium">{report.extraData.cfgFlaps ? 'SET' : 'UP'}</div>
                        </div>
                      )}
                      {report.extraData.cfgSlat !== undefined && (
                        <div>
                          <div className="text-xs text-muted-foreground">Slat</div>
                          <div className="text-sm font-medium">{report.extraData.cfgSlat ? 'SET' : 'UP'}</div>
                        </div>
                      )}
                      {report.extraData.cfgSpoiler !== undefined && (
                        <div>
                          <div className="text-xs text-muted-foreground">Spoiler</div>
                          <div className="text-sm font-medium">{report.extraData.cfgSpoiler ? 'EXT' : 'RET'}</div>
                        </div>
                      )}
                    </div>
                    
                    {/* Long text fields - Event Summary, Action Taken, Other Info */}
                    {report.extraData.eventSummary && (
                      <div className="mt-4">
                        <div className="text-xs text-muted-foreground mb-1">Event Summary</div>
                        <div className="text-sm leading-relaxed whitespace-pre-wrap bg-muted/50 p-3 rounded">{report.extraData.eventSummary}</div>
                      </div>
                    )}
                    {report.extraData.actionTaken && (
                      <div className="mt-4">
                        <div className="text-xs text-muted-foreground mb-1">Action Taken / Results / Subsequent Events</div>
                        <div className="text-sm leading-relaxed whitespace-pre-wrap bg-muted/50 p-3 rounded">{report.extraData.actionTaken}</div>
                      </div>
                    )}
                    {report.extraData.otherInfo && (
                      <div className="mt-4">
                        <div className="text-xs text-muted-foreground mb-1">Other Information and Suggestions</div>
                        <div className="text-sm leading-relaxed whitespace-pre-wrap bg-muted/50 p-3 rounded">{report.extraData.otherInfo}</div>
                      </div>
                    )}
                    
                    {/* 9. AIRPROX / ATC INCIDENT / TCAS */}
                    {(report.extraData.airproxSeverity || report.extraData.airproxAvoidingAction || report.extraData.airproxReportedToAtc || report.extraData.airproxAtcInstruction || report.extraData.airproxFreq || report.extraData.airproxHeading || report.extraData.airproxVertSep || report.extraData.airproxHorizSep || report.extraData.airproxSquawk || report.extraData.airproxTcasAlert || report.extraData.airproxRaFollowed || report.extraData.airproxVertDeviation || report.extraData.airproxOtherAcType || report.extraData.airproxOtherAcMarkings || report.extraData.airproxOtherAcCallsign) && (
                      <>
                        <div className="mt-6 mb-4">
                          <div className="bg-muted border border-border rounded px-3 py-2">
                            <h3 className="text-xs font-bold text-card-foreground uppercase tracking-wide">AIRPROX / ATC INCIDENT / TCAS</h3>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Incident Details */}
                          {report.extraData.airproxSeverity && (
                  <div>
                              <div className="text-xs text-muted-foreground">Severity</div>
                              <div className="text-sm font-medium capitalize">{report.extraData.airproxSeverity}</div>
                            </div>
                          )}
                          {report.extraData.airproxAvoidingAction && (
                            <div>
                              <div className="text-xs text-muted-foreground">Avoiding Action</div>
                              <div className="text-sm font-medium capitalize">{report.extraData.airproxAvoidingAction}</div>
                  </div>
                )}

                          {/* ATC Information */}
                          {report.extraData.airproxReportedToAtc && (
                  <div>
                              <div className="text-xs text-muted-foreground">ATC Unit</div>
                              <div className="text-sm font-medium">{report.extraData.airproxReportedToAtc}</div>
                            </div>
                          )}
                          {report.extraData.airproxFreq && (
                            <div>
                              <div className="text-xs text-muted-foreground">Frequency</div>
                              <div className="text-sm font-medium">{report.extraData.airproxFreq}</div>
                            </div>
                          )}
                          {report.extraData.airproxAtcInstruction && (
                            <div className="col-span-1 md:col-span-2">
                              <div className="text-xs text-muted-foreground">ATC Instruction</div>
                              <div className="text-sm font-medium whitespace-pre-wrap">{report.extraData.airproxAtcInstruction}</div>
                            </div>
                          )}
                          {report.extraData.airproxHeading && (
                            <div>
                              <div className="text-xs text-muted-foreground">Heading (deg)</div>
                              <div className="text-sm font-medium">{report.extraData.airproxHeading}</div>
                  </div>
                )}

                          {/* Separation Details */}
                          {report.extraData.airproxVertSep && (
                  <div>
                              <div className="text-xs text-muted-foreground">Vertical Separation (ft)</div>
                              <div className="text-sm font-medium">{report.extraData.airproxVertSep}</div>
                  </div>
                )}
                          {report.extraData.airproxHorizSep && (
                            <div>
                              <div className="text-xs text-muted-foreground">Horizontal Separation (M/NM)</div>
                              <div className="text-sm font-medium">{report.extraData.airproxHorizSep}</div>
              </div>
                          )}
                          {report.extraData.airproxSquawk && (
                            <div>
                              <div className="text-xs text-muted-foreground">Squawk</div>
                              <div className="text-sm font-medium">{report.extraData.airproxSquawk}</div>
                            </div>
                          )}
                          
                          {/* TCAS Information */}
                          {report.extraData.airproxTcasAlert && (
                            <div>
                              <div className="text-xs text-muted-foreground">TCAS Alert</div>
                              <div className="text-sm font-medium">{report.extraData.airproxTcasAlert}</div>
                            </div>
                          )}
                          {report.extraData.airproxRaFollowed && (
                            <div>
                              <div className="text-xs text-muted-foreground">RA Followed</div>
                              <div className="text-sm font-medium capitalize">{report.extraData.airproxRaFollowed}</div>
                            </div>
                          )}
                          {report.extraData.airproxVertDeviation && (
                            <div>
                              <div className="text-xs text-muted-foreground">Vertical Deviation (ft)</div>
                              <div className="text-sm font-medium">{report.extraData.airproxVertDeviation}</div>
                            </div>
                          )}
                          
                          {/* Other Aircraft Information */}
                          {report.extraData.airproxOtherAcType && (
                            <div>
                              <div className="text-xs text-muted-foreground">Aircraft Type</div>
                              <div className="text-sm font-medium">{report.extraData.airproxOtherAcType}</div>
                            </div>
                          )}
                          {report.extraData.airproxOtherAcMarkings && (
                            <div className="col-span-1 md:col-span-2">
                              <div className="text-xs text-muted-foreground">Markings/Colour</div>
                              <div className="text-sm font-medium whitespace-pre-wrap">{report.extraData.airproxOtherAcMarkings}</div>
                            </div>
                          )}
                          {report.extraData.airproxOtherAcCallsign && (
                            <div>
                              <div className="text-xs text-muted-foreground">Callsign/Registration</div>
                              <div className="text-sm font-medium">{report.extraData.airproxOtherAcCallsign}</div>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                    
                    {/* ASR Plots - Only show if there are images or meaningful data (not all default/zero values) */}
                    {(() => {
                      // Helper function to check if a value is a valid non-zero number
                      const isNonZeroNumber = (val: any): boolean => {
                        return typeof val === 'number' && val !== 0 && !isNaN(val);
                      };
                      
                      // Helper function to check if a value is a valid number (including 0)
                      const isValidNumber = (val: any): boolean => {
                        return typeof val === 'number' && !isNaN(val);
                      };
                      
                      // Check if there are actual images (base64 encoded images with meaningful length)
                      const hasPlanImage = !!(report.planImage && report.planImage.length > 100 && report.planImage.startsWith('data:'));
                      const hasElevImage = !!(report.elevImage && report.elevImage.length > 100 && report.elevImage.startsWith('data:'));
                      
                      // PLAN VIEW: Check if plan view has meaningful data
                      // Plan is meaningful ONLY if:
                      // 1. Has actual image, OR
                      // 2. Grid coordinates exist and are NOT at center (0,0), OR
                      // 3. Grid coordinates are at center (0,0) BUT distances are non-zero
                      const planGridX = report.planGridX;
                      const planGridY = report.planGridY;
                      const planDistanceX = report.planDistanceX;
                      const planDistanceY = report.planDistanceY;
                      
                      const planHasValidGrid = isValidNumber(planGridX) && isValidNumber(planGridY);
                      const planIsAtCenter = planHasValidGrid && planGridX === 0 && planGridY === 0;
                      const planHasNonZeroDistances = isNonZeroNumber(planDistanceX) || isNonZeroNumber(planDistanceY);
                      
                      // Plan is meaningful if: has image OR (has valid grid AND (not at center OR has non-zero distances))
                      const planIsMeaningful = hasPlanImage || (planHasValidGrid && (!planIsAtCenter || planHasNonZeroDistances));
                      
                      // ELEVATION VIEW: Check if elevation view has meaningful data
                      const centerCol = 14; // COLS / 2 - 1 = 29/2 - 1 = 14
                      const centerRow = 10; // ROWS / 2 - 1 = 21/2 - 1 = 10
                      
                      const elevGridCol = report.elevGridCol;
                      const elevGridRow = report.elevGridRow;
                      const elevDistanceHorizM = report.elevDistanceHorizM;
                      const elevDistanceVertFt = report.elevDistanceVertFt;
                      
                      const elevHasValidGrid = isValidNumber(elevGridCol) && isValidNumber(elevGridRow);
                      const elevIsAtCenter = elevHasValidGrid && elevGridCol === centerCol && elevGridRow === centerRow;
                      const elevHasNonZeroDistances = isNonZeroNumber(elevDistanceHorizM) || isNonZeroNumber(elevDistanceVertFt);
                      
                      // Elevation is meaningful if: has image OR (has valid grid AND (not at center OR has non-zero distances))
                      const elevIsMeaningful = hasElevImage || (elevHasValidGrid && (!elevIsAtCenter || elevHasNonZeroDistances));
                      
                      // Show only if at least one view has meaningful data (not just default values)
                      return planIsMeaningful || elevIsMeaningful;
                    })() && (
                      <div>
                        <div className="bg-muted border border-border rounded px-3 py-2 mb-4">
                          <h3 className="text-xs font-bold text-card-foreground uppercase tracking-wide">ASR Plots</h3>
                        </div>
                        <div>
                          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6 mt-2">
                          {/* VIEW FROM ABOVE - Only show if there's actual image or meaningful grid data */}
                          {(() => {
                            // Helper function to check if a value is a valid non-zero number
                            const isNonZeroNumber = (val: any): boolean => {
                              return typeof val === 'number' && val !== 0 && !isNaN(val);
                            };
                            
                            // Helper function to check if a value is a valid number (including 0)
                            const isValidNumber = (val: any): boolean => {
                              return typeof val === 'number' && !isNaN(val);
                            };
                            
                            const hasPlanImage = !!(report.planImage && report.planImage.length > 100 && report.planImage.startsWith('data:'));
                            
                            const planGridX = report.planGridX;
                            const planGridY = report.planGridY;
                            const planDistanceX = report.planDistanceX;
                            const planDistanceY = report.planDistanceY;
                            
                            const planHasValidGrid = isValidNumber(planGridX) && isValidNumber(planGridY);
                            const planIsAtCenter = planHasValidGrid && planGridX === 0 && planGridY === 0;
                            const planHasNonZeroDistances = isNonZeroNumber(planDistanceX) || isNonZeroNumber(planDistanceY);
                            
                            // Only show if: has image OR (has valid grid AND (not at center OR has non-zero distances))
                            return hasPlanImage || (planHasValidGrid && (!planIsAtCenter || planHasNonZeroDistances));
                          })() && (
                            <Card className="p-3 sm:p-4">
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 gap-2">
                                <h3 className="font-medium text-sm sm:text-base">VIEW FROM ABOVE</h3>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <span>Hundreds of metres</span>
                                  <span>→</span>
                                </div>
                              </div>
                              {(() => {
                                const COLS = 29; // -14..+14 hundreds
                                const ROWS = 21; // -10..+10 hundreds
                                const centerCol = Math.floor(COLS / 2);
                                const centerRow = Math.floor(ROWS / 2);
                                const planX = report.planGridX;
                                const planY = report.planGridY;
                                const unit = report.planUnits || 'M';
                                const cell = unit === 'M' ? 100 : 0.1; // 100m per cell or 0.1NM per cell
                                const leftPct = typeof planX === 'number' ? ((planX + centerCol) / (COLS - 1)) * 100 : undefined;
                                const topPct = typeof planY === 'number' ? ((-planY + centerRow) / (ROWS - 1)) * 100 : undefined;
                                return (
                                  <>
                                    <div
                                      className="relative w-full h-64 sm:h-80 lg:h-96 rounded-md overflow-visible border mt-4 sm:mt-6 lg:mt-8"
                                      style={{
                                        backgroundImage: `
                                          linear-gradient(hsl(var(--muted)) 1px, transparent 1px),
                                          linear-gradient(90deg, hsl(var(--muted)) 1px, transparent 1px),
                                          linear-gradient(hsl(var(--border)) 2px, transparent 2px),
                                          linear-gradient(90deg, hsl(var(--border)) 2px, transparent 2px)
                                        `,
                                        backgroundSize: `
                                          calc(100%/${COLS - 1}) calc(100%/${ROWS - 1}),
                                          calc(100%/${COLS - 1}) calc(100%/${ROWS - 1}),
                                          calc((100%/${COLS - 1}) * 5) calc((100%/${ROWS - 1}) * 5),
                                          calc((100%/${COLS - 1}) * 5) calc((100%/${ROWS - 1}) * 5)
                                        `,
                                        backgroundColor: 'hsl(var(--background))'
                                      }}
                                    >
                                      {/* Center aircraft marker (triangle) */}
                                      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[14px] border-b-primary" />
                                      {/* Selected point */}
                                      {leftPct !== undefined && topPct !== undefined && (
                                        <div
                                          className="absolute w-3 h-3 bg-primary rounded-full border-2 border-background shadow-lg z-10"
                                          style={{ left: `${leftPct}%`, top: `${topPct}%`, transform: 'translate(-50%, -50%)' }}
                                        />
                                      )}
                                      {/* Top numeric scale fixed (14..0..14) outside */}
                                      <div className="absolute top-0 -translate-y-full left-0 right-0 grid grid-cols-[repeat(29,1fr)] text-[10px] text-muted-foreground px-1 py-0 pointer-events-none">
                                        {Array.from({ length: COLS }).map((_, i) => {
                                          const fromLeft = i; // 0..28
                                          const label = fromLeft <= centerCol ? (centerCol - fromLeft) : (fromLeft - centerCol);
                                          return <span key={i} className="text-center block">{label}</span>;
                                        })}
                                      </div>
                                      {/* Left numeric scale fixed (10..0..10) outside */}
                                      <div className="absolute top-0 bottom-0 left-0 -translate-x-full pr-1 flex flex-col justify-between text-[10px] text-muted-foreground px-1 py-0 whitespace-nowrap pointer-events-none">
                                        {Array.from({ length: ROWS }).map((_, i) => {
                                          const label = Math.abs(i - centerRow); // 10..0..10
                                          return <span key={i}>{label}</span>;
                                        })}
                                      </div>
                                      {/* Fallback: show image if grid data not available */}
                                      {planX === undefined && planY === undefined && report.planImage && (
                                        <img 
                                          src={report.planImage} 
                                          alt="Plan view" 
                                          className="absolute inset-0 w-full h-full object-contain rounded-md" 
                                        />
                                      )}
                                    </div>
                                    <div className="mt-3 sm:mt-4 grid grid-cols-1 gap-4 sm:gap-6 text-sm">
                                      <div className="space-y-2 sm:space-y-3">
                                        <div className="font-medium text-sm sm:text-base">Distances</div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 items-center">
                                          <label className="text-muted-foreground">Distance X ({unit})</label>
                                          <div className="h-9 px-3 py-2 bg-muted rounded-md text-sm font-mono">
                                            {report.planDistanceX !== undefined ? report.planDistanceX.toFixed(unit === 'M' ? 0 : 2) : '-'} {unit.toLowerCase()}
                                          </div>
                                          <label className="text-muted-foreground">Distance Y ({unit})</label>
                                          <div className="h-9 px-3 py-2 bg-muted rounded-md text-sm font-mono">
                                            {report.planDistanceY !== undefined ? report.planDistanceY.toFixed(unit === 'M' ? 0 : 2) : '-'} {unit.toLowerCase()}
                                          </div>
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                          Selected grid: x={planX ?? '-'}, y={planY ?? '-'} ({unit}) · Distances: X={report.planDistanceX !== undefined ? report.planDistanceX.toFixed(unit === 'M' ? 0 : 2) : '-'}{unit.toLowerCase()}, Y={report.planDistanceY !== undefined ? report.planDistanceY.toFixed(unit === 'M' ? 0 : 2) : '-'}{unit.toLowerCase()}
                                        </div>
                                      </div>
                                    </div>
                                  </>
                                );
                              })()}
            </Card>
                          )}
                          
                          {/* VIEW FROM ASTERN - Only show if there's actual image or meaningful grid data */}
                          {(() => {
                            // Helper function to check if a value is a valid non-zero number
                            const isNonZeroNumber = (val: any): boolean => {
                              return typeof val === 'number' && val !== 0 && !isNaN(val);
                            };
                            
                            // Helper function to check if a value is a valid number (including 0)
                            const isValidNumber = (val: any): boolean => {
                              return typeof val === 'number' && !isNaN(val);
                            };
                            
                            const hasElevImage = !!(report.elevImage && report.elevImage.length > 100 && report.elevImage.startsWith('data:'));
                            
                            const centerCol = 14;
                            const centerRow = 10;
                            
                            const elevGridCol = report.elevGridCol;
                            const elevGridRow = report.elevGridRow;
                            const elevDistanceHorizM = report.elevDistanceHorizM;
                            const elevDistanceVertFt = report.elevDistanceVertFt;
                            
                            const elevHasValidGrid = isValidNumber(elevGridCol) && isValidNumber(elevGridRow);
                            const elevIsAtCenter = elevHasValidGrid && elevGridCol === centerCol && elevGridRow === centerRow;
                            const elevHasNonZeroDistances = isNonZeroNumber(elevDistanceHorizM) || isNonZeroNumber(elevDistanceVertFt);
                            
                            // Only show if: has image OR (has valid grid AND (not at center OR has non-zero distances))
                            return hasElevImage || (elevHasValidGrid && (!elevIsAtCenter || elevHasNonZeroDistances));
                          })() && (
                            <Card className="p-3 sm:p-4">
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 gap-2">
                                <h3 className="font-medium text-sm sm:text-base">VIEW FROM ASTERN</h3>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <span>Hundreds of metres</span>
                                  <span>→</span>
                      </div>
                              </div>
                              {(() => {
                                const COLS = 29; // hundreds of metres horizontally
                                const ROWS = 21; // hundreds of FEET vertically
                                const centerCol = Math.floor(COLS / 2);
                                const centerRow = Math.floor(ROWS / 2);
                                const rSel = report.elevGridRow;
                                const cSel = report.elevGridCol;
                                const hCellM = 100; // Fixed: 100 meters per cell horizontally
                                const vCellFt = 100; // Fixed: 100 feet per cell vertically
                                return (
                                  <>
                                    <div
                                      className="relative w-full h-64 sm:h-80 lg:h-96 rounded-md overflow-visible border mt-4 sm:mt-6 lg:mt-8"
                                      style={{
                                        backgroundImage: `
                                          linear-gradient(hsl(var(--muted)) 1px, transparent 1px),
                                          linear-gradient(90deg, hsl(var(--muted)) 1px, transparent 1px),
                                          linear-gradient(hsl(var(--border)) 2px, transparent 2px),
                                          linear-gradient(90deg, hsl(var(--border)) 2px, transparent 2px)
                                        `,
                                        backgroundSize: `
                                          calc(100%/${COLS - 1}) calc(100%/${ROWS - 1}),
                                          calc(100%/${COLS - 1}) calc(100%/${ROWS - 1}),
                                          calc((100%/${COLS - 1}) * 5) calc((100%/${ROWS - 1}) * 5),
                                          calc((100%/${COLS - 1}) * 5) calc((100%/${ROWS - 1}) * 5)
                                        `,
                                        backgroundColor: 'hsl(var(--background))'
                                      }}
                                    >
                                      {/* Left vertical label */}
                                      <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-[120%] pr-2 text-xs text-muted-foreground rotate-[-90deg] origin-right bg-background px-1 whitespace-nowrap">← Hundreds of FEET</div>
                                      {/* Right side METRES label centered beside scale (300..0..300) */}
                                      <div className="absolute right-0 top-0 bottom-0 translate-x-full pl-2 text-[10px] text-muted-foreground">
                                        <div className="relative h-full">
                                          <div className="absolute right-0 top-1/2 -translate-y-1/2 [writing-mode:vertical-rl] rotate-180 text-xs pr-1">METRES</div>
                                          <div className="flex flex-col justify-between h-full pr-5">
                                            {Array.from({ length: 21 }).map((_, i) => {
                                              const label = Math.abs((i - 10) * 30); // 300..0..300
                                              return <div key={i}>{label}</div>;
                                            })}
                                          </div>
                                        </div>
                                      </div>
                                      {/* Selected cell marker */}
                                      {typeof rSel === 'number' && typeof cSel === 'number' && (
                                        <div
                                          className="absolute w-3 h-3 bg-primary rounded-full border-2 border-background shadow-lg z-10"
                                          style={{
                                            left: `${(cSel / (COLS - 1)) * 100}%`,
                                            top: `${(rSel / (ROWS - 1)) * 100}%`,
                                            transform: 'translate(-50%, -50%)'
                                          }}
                                        />
                                      )}
                                      {/* Center dot */}
                                      <div className="absolute left-1/2 top-1/2 -translate-y-1/2 -translate-x-[35%] w-2 h-2 bg-primary rounded-full" />
                                      {/* Top numeric scale (10..0..10) outside */}
                                      <div className="absolute top-0 -translate-y-full left-0 right-0 flex justify-between text-[10px] text-muted-foreground px-1 py-0 pointer-events-none">
                                        {Array.from({ length: COLS }).map((_, i) => {
                                          const offsetCells = Math.abs(i - centerCol); // 0..14
                                          const label = Math.round((offsetCells * 10) / centerCol); // map 0..14 -> 0..10
                                          return <span key={i}>{label}</span>;
                                        })}
                      </div>
                                      {/* Left vertical scale (10..0..10) outside */}
                                      <div className="absolute top-0 bottom-0 left-0 -translate-x-full pr-1 flex flex-col justify-between text-[10px] text-muted-foreground p-1 whitespace-nowrap pointer-events-none">
                                        {Array.from({ length: ROWS }).map((_, i) => {
                                          const offsetCells = Math.abs(i - centerRow); // 0..10
                                          return <span key={i}>{offsetCells}</span>;
                                        })}
                                      </div>
                                      {/* Fallback: show image if grid data not available */}
                                      {cSel === undefined && rSel === undefined && report.elevImage && (
                                        <img 
                                          src={report.elevImage} 
                                          alt="Elevation view" 
                                          className="absolute inset-0 w-full h-full object-contain rounded-md" 
                                        />
                                      )}
                                    </div>
                                    <div className="mt-4 grid grid-cols-1 gap-6 text-sm">
                                      <div className="space-y-3">
                                        <div className="font-medium text-sm sm:text-base">Distances</div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                                          <label className="text-muted-foreground">Horizontal (m)</label>
                                          <div className="h-9 px-3 py-2 bg-muted rounded-md text-sm font-mono">
                                            {report.elevDistanceHorizM !== undefined ? report.elevDistanceHorizM : '-'} m
                                          </div>
                                          <label className="text-muted-foreground">Vertical (ft)</label>
                                          <div className="h-9 px-3 py-2 bg-muted rounded-md text-sm font-mono">
                                            {report.elevDistanceVertFt !== undefined ? report.elevDistanceVertFt : '-'} ft
                                          </div>
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                          Selected grid: row={rSel ?? '-'}, col={cSel ?? '-'} · Distances: H={report.elevDistanceHorizM !== undefined ? report.elevDistanceHorizM : '-'}m, V={report.elevDistanceVertFt !== undefined ? report.elevDistanceVertFt : '-'}ft
                                        </div>
                                      </div>
                                    </div>
                                  </>
                                );
                              })()}
                            </Card>
                          )}
                        </div>
                        </div>
                      </div>
                    )}
                    
                    {/* 10. WAKE TURBULENCE */}
                    {(report.extraData.wakeHeading || report.extraData.wakeTurning || report.extraData.wakeGs || report.extraData.wakeEcl || report.extraData.wakeChangeAtt || report.extraData.wakeChangeAlt || report.extraData.wakeVrtAccel || report.extraData.wakeBuffet || report.extraData.wakePreceding || report.extraData.wakeAwareBefore || report.extraData.wakeSuspectReason) && (
                      <>
                        <div className="mt-6 mb-4">
                          <div className="bg-muted border border-border rounded px-3 py-2">
                            <h3 className="text-xs font-bold text-card-foreground uppercase tracking-wide">WAKE TURBULENCE</h3>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Flight Configuration */}
                          {report.extraData.wakeHeading && (
                            <div>
                              <div className="text-xs text-muted-foreground">Heading (deg)</div>
                              <div className="text-sm font-medium">{report.extraData.wakeHeading}</div>
                            </div>
                          )}
                          {report.extraData.wakeTurning && (
                            <div>
                              <div className="text-xs text-muted-foreground">Turning</div>
                              <div className="text-sm font-medium">{report.extraData.wakeTurning}</div>
                            </div>
                          )}
                          {report.extraData.wakeGs && (
                            <div>
                              <div className="text-xs text-muted-foreground">Glideslope</div>
                              <div className="text-sm font-medium">{report.extraData.wakeGs}</div>
                            </div>
                          )}
                          {report.extraData.wakeEcl && (
                            <div>
                              <div className="text-xs text-muted-foreground">Ext Centerline</div>
                              <div className="text-sm font-medium">{report.extraData.wakeEcl}</div>
                            </div>
                          )}
                          
                          {/* Aircraft Effects */}
                          {report.extraData.wakeChangeAtt && (
                            <div>
                              <div className="text-xs text-muted-foreground">Change in Attitude (deg)</div>
                              <div className="text-sm font-medium">{report.extraData.wakeChangeAtt}</div>
                            </div>
                          )}
                          {report.extraData.wakeChangeAlt && (
                            <div>
                              <div className="text-xs text-muted-foreground">Change in Altitude (ft)</div>
                              <div className="text-sm font-medium">{report.extraData.wakeChangeAlt}</div>
                            </div>
                          )}
                          {report.extraData.wakeVrtAccel && (
                            <div>
                              <div className="text-xs text-muted-foreground">Vertical Acceleration</div>
                              <div className="text-sm font-medium">{report.extraData.wakeVrtAccel}</div>
                            </div>
                          )}
                          {report.extraData.wakeBuffet && (
                            <div>
                              <div className="text-xs text-muted-foreground">Buffet</div>
                              <div className="text-sm font-medium capitalize">{report.extraData.wakeBuffet}</div>
                            </div>
                          )}
                          
                          {/* Wake Turbulence Details */}
                          {report.extraData.wakePreceding && (
                            <div>
                              <div className="text-xs text-muted-foreground">Preceding Aircraft</div>
                              <div className="text-sm font-medium">{report.extraData.wakePreceding}</div>
                            </div>
                          )}
                          {report.extraData.wakeAwareBefore && (
                            <div>
                              <div className="text-xs text-muted-foreground">Aware Before?</div>
                              <div className="text-sm font-medium capitalize">{report.extraData.wakeAwareBefore}</div>
                            </div>
                          )}
                          {report.extraData.wakeSuspectReason && (
                            <div className="col-span-1 md:col-span-2">
                              <div className="text-xs text-muted-foreground">Why Suspect Wake Turbulence?</div>
                              <div className="text-sm font-medium whitespace-pre-wrap">{report.extraData.wakeSuspectReason}</div>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                    
                    {/* 11. BIRD STRIKE */}
                    {(report.extraData.birdLocation || report.extraData.birdType || report.extraData.nrSeen3_1 !== undefined || report.extraData.nrSeen3_2_10 !== undefined || report.extraData.nrSeen3_11_100 !== undefined || report.extraData.nrSeen3_more !== undefined || report.extraData.nrSeen4_1 !== undefined || report.extraData.nrSeen4_2_10 !== undefined || report.extraData.nrSeen4_11_100 !== undefined || report.extraData.nrSeen4_more !== undefined || report.extraData.nrSeen5_1 !== undefined || report.extraData.nrSeen5_2_10 !== undefined || report.extraData.nrSeen5_11_100 !== undefined || report.extraData.nrSeen5_more !== undefined) && (
                      <>
                        <div className="mt-6 mb-4">
                          <div className="bg-muted border border-border rounded px-3 py-2">
                            <h3 className="text-xs font-bold text-card-foreground uppercase tracking-wide">BIRD STRIKE</h3>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {report.extraData.birdLocation && (
                            <div>
                              <div className="text-xs text-muted-foreground">1. LOCATION</div>
                              <div className="text-sm font-medium">{report.extraData.birdLocation}</div>
                            </div>
                          )}
                          {report.extraData.birdType && (
                            <div>
                              <div className="text-xs text-muted-foreground">2. TYPE OF BIRDS</div>
                              <div className="text-sm font-medium">{report.extraData.birdType}</div>
                            </div>
                          )}
                          {(() => {
                            const nrSeen: string[] = [];
                            if (report.extraData.nrSeen3_1 !== undefined || report.extraData.nrSeen3_2_10 !== undefined || report.extraData.nrSeen3_11_100 !== undefined || report.extraData.nrSeen3_more !== undefined) {
                              const engine3 = [];
                              if (report.extraData.nrSeen3_1 !== undefined) engine3.push(`1=${report.extraData.nrSeen3_1 ? 'Y' : 'N'}`);
                              if (report.extraData.nrSeen3_2_10 !== undefined) engine3.push(`2-10=${report.extraData.nrSeen3_2_10 ? 'Y' : 'N'}`);
                              if (report.extraData.nrSeen3_11_100 !== undefined) engine3.push(`11-100=${report.extraData.nrSeen3_11_100 ? 'Y' : 'N'}`);
                              if (report.extraData.nrSeen3_more !== undefined) engine3.push(`MORE=${report.extraData.nrSeen3_more ? 'Y' : 'N'}`);
                              if (engine3.length > 0) nrSeen.push(`3. NR SEEN: ${engine3.join(' ')}`);
                            }
                            if (report.extraData.nrSeen4_1 !== undefined || report.extraData.nrSeen4_2_10 !== undefined || report.extraData.nrSeen4_11_100 !== undefined || report.extraData.nrSeen4_more !== undefined) {
                              const engine4 = [];
                              if (report.extraData.nrSeen4_1 !== undefined) engine4.push(`1=${report.extraData.nrSeen4_1 ? 'Y' : 'N'}`);
                              if (report.extraData.nrSeen4_2_10 !== undefined) engine4.push(`2-10=${report.extraData.nrSeen4_2_10 ? 'Y' : 'N'}`);
                              if (report.extraData.nrSeen4_11_100 !== undefined) engine4.push(`11-100=${report.extraData.nrSeen4_11_100 ? 'Y' : 'N'}`);
                              if (report.extraData.nrSeen4_more !== undefined) engine4.push(`MORE=${report.extraData.nrSeen4_more ? 'Y' : 'N'}`);
                              if (engine4.length > 0) nrSeen.push(`4. NR SEEN: ${engine4.join(' ')}`);
                            }
                            if (report.extraData.nrSeen5_1 !== undefined || report.extraData.nrSeen5_2_10 !== undefined || report.extraData.nrSeen5_11_100 !== undefined || report.extraData.nrSeen5_more !== undefined) {
                              const engine5 = [];
                              if (report.extraData.nrSeen5_1 !== undefined) engine5.push(`1=${report.extraData.nrSeen5_1 ? 'Y' : 'N'}`);
                              if (report.extraData.nrSeen5_2_10 !== undefined) engine5.push(`2-10=${report.extraData.nrSeen5_2_10 ? 'Y' : 'N'}`);
                              if (report.extraData.nrSeen5_11_100 !== undefined) engine5.push(`11-100=${report.extraData.nrSeen5_11_100 ? 'Y' : 'N'}`);
                              if (report.extraData.nrSeen5_more !== undefined) engine5.push(`MORE=${report.extraData.nrSeen5_more ? 'Y' : 'N'}`);
                              if (engine5.length > 0) nrSeen.push(`5. NR SEEN: ${engine5.join(' ')}`);
                            }
                            return nrSeen.length > 0 ? (
                              <div className="col-span-1 md:col-span-2">
                                <div className="text-xs text-muted-foreground">NR SEEN</div>
                                <div className="text-sm font-medium">{nrSeen.join(' | ')}</div>
                              </div>
                            ) : null;
                          })()}
                        </div>
                      </>
                    )}
                    
                    {/* 12. Sign-off */}
                    {(report.extraData.reporterName || report.extraData.reporterRank || report.extraData.reporterDate) && (
                      <>
                        <div className="mt-6 mb-4">
                          <div className="bg-muted border border-border rounded px-3 py-2">
                            <h3 className="text-xs font-bold text-card-foreground uppercase tracking-wide">SIGN-OFF</h3>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {report.extraData.reporterName && (
                            <div>
                              <div className="text-xs text-muted-foreground">Reporter Name</div>
                              <div className="text-sm font-medium">{report.extraData.reporterName}</div>
                            </div>
                          )}
                          {report.extraData.reporterRank && (
                            <div>
                              <div className="text-xs text-muted-foreground">Reporter Rank</div>
                              <div className="text-sm font-medium">{report.extraData.reporterRank}</div>
                            </div>
                          )}
                          {report.extraData.reporterDate && (
                            <div>
                              <div className="text-xs text-muted-foreground">Reporter Date</div>
                              <div className="text-sm font-medium">{report.extraData.reporterDate}</div>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* NCR Details */}
                {report.reportType === 'ncr' && report.extraData && (
                  <div>
                    <div className="bg-muted border border-border rounded px-3 py-2 mb-4">
                      <h3 className="text-xs font-bold text-card-foreground uppercase tracking-wide">تقرير عدم المطابقة (NCR)</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 break-words">
                      {/* 1. المعلومات العامة */}
                      {report.extraData.date && (
                        <div>
                          <div className="text-xs text-muted-foreground">التاريخ</div>
                          <div className="text-sm font-medium break-words">{report.extraData.date}</div>
                        </div>
                      )}
                      {report.extraData.flightDate && (
                        <div>
                          <div className="text-xs text-muted-foreground">تاريخ الرحلة</div>
                          <div className="text-sm font-medium break-words">{report.extraData.flightDate}</div>
                        </div>
                      )}
                      {report.extraData.flightNumber && (
                        <div>
                          <div className="text-xs text-muted-foreground">رقم الرحلة</div>
                          <div className="text-sm font-medium break-words">{report.extraData.flightNumber}</div>
                        </div>
                      )}
                      {report.extraData.aircraftType && (
                        <div>
                          <div className="text-xs text-muted-foreground">نوع الطائرة</div>
                          <div className="text-sm font-medium break-words">{report.extraData.aircraftType}</div>
                        </div>
                      )}
                      {report.extraData.aircraftReg && (
                        <div>
                          <div className="text-xs text-muted-foreground">رقم تسجيل الطائرة</div>
                          <div className="text-sm font-medium break-words">{report.extraData.aircraftReg}</div>
                        </div>
                      )}
                      {report.extraData.captainName && (
                        <div>
                          <div className="text-xs text-muted-foreground">اسم قائد الطائرة</div>
                          <div className="text-sm font-medium break-words">{report.extraData.captainName}</div>
                        </div>
                      )}
                      {report.extraData.foName && (
                        <div>
                          <div className="text-xs text-muted-foreground">اسم مساعد قائد الطائرة</div>
                          <div className="text-sm font-medium break-words">{report.extraData.foName}</div>
                        </div>
                      )}
                      
                      {/* 2. مصادر عدم المطابقة */}
                      {(() => {
                        const sources: string[] = [];
                        if (report.extraData.srcSurvey) sources.push('استبيانات مسح رضى العملاء');
                        if (report.extraData.srcCustomerComplaint) sources.push('شكوى عميل');
                        if (report.extraData.srcPilotObservation) sources.push('ملاحظات مراقبة من الطيار');
                        if (report.extraData.srcMaintenanceOfficer) sources.push('ضابط الصيانة');
                        if (report.extraData.srcOtherMonitoring) sources.push('نشاطات مراقبة أخرى');
                        if (report.extraData.srcInternalAudit) sources.push('الفحص الداخلي');
                        if (report.extraData.srcOpsTax) sources.push('أداء ضريبة العمليات');
                        if (report.extraData.srcOtherText) sources.push(`أخرى: ${report.extraData.srcOtherText}`);
                        return sources.length > 0 ? (
                          <div className="col-span-1 md:col-span-2">
                            <div className="text-xs text-muted-foreground">مصادر عدم المطابقة</div>
                            <div className="text-sm font-medium break-words">{sources.join('، ')}</div>
                          </div>
                        ) : null;
                      })()}
                      
                      {/* 3. نوع عدم المطابقة */}
                      {(() => {
                        const types: string[] = [];
                        if (report.extraData.nonconform_service) types.push('الخدمية');
                        if (report.extraData.nonconform_safety) types.push('تؤثر على السلامة');
                        if (report.extraData.nonconform_security) types.push('تؤثر على الأمن');
                        return types.length > 0 ? (
                          <div className="col-span-1 md:col-span-2">
                            <div className="text-xs text-muted-foreground">نوع عدم المطابقة</div>
                            <div className="text-sm font-medium break-words">{types.join('، ')}</div>
                          </div>
                        ) : null;
                      })()}
                      
                      {/* 4. حقول النص الطويلة */}
                      {report.extraData.nonconformDetails && (
                        <div className="col-span-1 md:col-span-2 mt-4">
                          <div className="text-xs text-muted-foreground mb-1">تفاصيل عدم المطابقة</div>
                          <div className="text-sm leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere bg-muted/50 p-3 rounded">{report.extraData.nonconformDetails}</div>
                        </div>
                      )}
                      {report.extraData.recommendationFix && (
                        <div className="col-span-1 md:col-span-2 mt-4">
                          <div className="text-xs text-muted-foreground mb-1">التوصية بخصوص التصحيح اللازم</div>
                          <div className="text-sm leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere bg-muted/50 p-3 rounded">{report.extraData.recommendationFix}</div>
                        </div>
                      )}
                      {report.extraData.recommendationAction && (
                        <div className="col-span-1 md:col-span-2 mt-4">
                          <div className="text-xs text-muted-foreground mb-1">التوصية بخصوص الإجراء التصحيحي اللازم</div>
                          <div className="text-sm leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere bg-muted/50 p-3 rounded">{report.extraData.recommendationAction}</div>
                        </div>
                      )}
                      
                      {/* 5. معلومات المكتشف */}
                      {report.extraData.discovererName && (
                        <div>
                          <div className="text-xs text-muted-foreground">اسم مكتشف الخدمة غير المطابقة</div>
                          <div className="text-sm font-medium break-words">{report.extraData.discovererName}</div>
                        </div>
                      )}
                      {report.extraData.discovererTitle && (
                        <div>
                          <div className="text-xs text-muted-foreground">الوظيفة</div>
                          <div className="text-sm font-medium break-words">{report.extraData.discovererTitle}</div>
                        </div>
                      )}
                      {report.extraData.discovererDate && (
                        <div>
                          <div className="text-xs text-muted-foreground">التاريخ</div>
                          <div className="text-sm font-medium break-words">{report.extraData.discovererDate}</div>
                        </div>
                      )}
                      
                      {/* 6. تحليل الأسباب الرئيسية */}
                      {report.extraData.rootCauseAnalysis && (
                        <div className="col-span-1 md:col-span-2 mt-4">
                          <div className="text-xs text-muted-foreground mb-1">تحليل الأسباب الرئيسية لحالة عدم المطابقة</div>
                          <div className="text-sm leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere bg-muted/50 p-3 rounded">{report.extraData.rootCauseAnalysis}</div>
                        </div>
                      )}
                      {report.extraData.analystName && (
                        <div>
                          <div className="text-xs text-muted-foreground">الاسم</div>
                          <div className="text-sm font-medium break-words">{report.extraData.analystName}</div>
                        </div>
                      )}
                      {report.extraData.analystTitle && (
                        <div>
                          <div className="text-xs text-muted-foreground">اسم ووظيفة الشخص الذي حدد الأسباب الرئيسية</div>
                          <div className="text-sm font-medium break-words">{report.extraData.analystTitle}</div>
                        </div>
                      )}
                      {report.extraData.analystDate && (
                        <div>
                          <div className="text-xs text-muted-foreground">التاريخ</div>
                          <div className="text-sm font-medium break-words">{report.extraData.analystDate}</div>
                        </div>
                      )}
                      
                      {/* 7. تقرير المسؤول المباشر */}
                      {report.extraData.directManagerNotes && (
                        <div className="col-span-1 md:col-span-2 mt-4">
                          <div className="text-xs text-muted-foreground mb-1">ملاحظات المسؤول المباشر</div>
                          <div className="text-sm leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere bg-muted/50 p-3 rounded">{report.extraData.directManagerNotes}</div>
                        </div>
                      )}
                      {report.extraData.needsCorrection && (
                        <div>
                          <div className="text-xs text-muted-foreground">الحالة</div>
                          <div className="text-sm font-medium break-words">{report.extraData.needsCorrection === 'yes' ? 'نعم - الحالة تحتاج إلى تصحيح' : 'لا - الحالة لا تحتاج إلى تصحيح'}</div>
                        </div>
                      )}
                      {report.extraData.correctionDetails && (
                        <div className="col-span-1 md:col-span-2 mt-4">
                          <div className="text-xs text-muted-foreground mb-1">تفاصيل التصحيح (عند الحاجة له)</div>
                          <div className="text-sm leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere bg-muted/50 p-3 rounded">{report.extraData.correctionDetails}</div>
                        </div>
                      )}
                      {report.extraData.correctionDueDate && (
                        <div>
                          <div className="text-xs text-muted-foreground">التاريخ المطلوب لإنهاء التصحيح</div>
                          <div className="text-sm font-medium break-words">{report.extraData.correctionDueDate}</div>
                        </div>
                      )}
                      {report.extraData.personAssignedName && (
                        <div>
                          <div className="text-xs text-muted-foreground">الاسم</div>
                          <div className="text-sm font-medium break-words">{report.extraData.personAssignedName}</div>
                        </div>
                      )}
                      {report.extraData.personAssignedTitle && (
                        <div>
                          <div className="text-xs text-muted-foreground">اسم ووظيفة الشخص الذي حُدد لتنفيذ التصحيح</div>
                          <div className="text-sm font-medium break-words">{report.extraData.personAssignedTitle}</div>
                        </div>
                      )}
                      
                      {/* 8. الملاحظات على الإجراء التصحيحي المقترح */}
                      {report.extraData.proposalApprove && (
                        <div>
                          <div className="text-xs text-muted-foreground">الموافقة</div>
                          <div className="text-sm font-medium break-words">{report.extraData.proposalApprove === 'yes' ? 'نعم - أقرّح القيام بإجراء تصحيحي' : 'لا - لا أقرّح القيام بإجراء تصحيحي'}</div>
                        </div>
                      )}
                      {report.extraData.proposalNotes && (
                        <div className="col-span-1 md:col-span-2 mt-4">
                          <div className="text-xs text-muted-foreground mb-1">ملاحظات المسؤول المباشر</div>
                          <div className="text-sm leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere bg-muted/50 p-3 rounded">{report.extraData.proposalNotes}</div>
                        </div>
                      )}
                      {report.extraData.proposalSignerName && (
                        <div>
                          <div className="text-xs text-muted-foreground">اسم الشخص الذي أقرّ الإجراء التصحيحي</div>
                          <div className="text-sm font-medium break-words">{report.extraData.proposalSignerName}</div>
                        </div>
                      )}
                      {report.extraData.proposalSignerTitle && (
                        <div>
                          <div className="text-xs text-muted-foreground">وظيفته</div>
                          <div className="text-sm font-medium break-words">{report.extraData.proposalSignerTitle}</div>
                        </div>
                      )}
                      {report.extraData.proposalSignerDate && (
                        <div>
                          <div className="text-xs text-muted-foreground">التاريخ</div>
                          <div className="text-sm font-medium break-words">{report.extraData.proposalSignerDate}</div>
                        </div>
                      )}
                      
                      {/* 9. نتائج التصحيح */}
                      {report.extraData.correctionResultDetails && (
                        <div className="col-span-1 md:col-span-2 mt-4">
                          <div className="text-xs text-muted-foreground mb-1">نتائج التصحيح</div>
                          <div className="text-sm leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere bg-muted/50 p-3 rounded">{report.extraData.correctionResultDetails}</div>
                        </div>
                      )}
                      {report.extraData.correctionResponsibleDate && (
                        <div>
                          <div className="text-xs text-muted-foreground">التاريخ</div>
                          <div className="text-sm font-medium break-words">{report.extraData.correctionResponsibleDate}</div>
                        </div>
                      )}
                      
                      {/* 10. نتائج المتابعة */}
                      {report.extraData.followupResult && (
                        <div className="col-span-1 md:col-span-2 mt-4">
                          <div className="text-xs text-muted-foreground mb-1">نتائج المتابعة</div>
                          <div className="text-sm leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere bg-muted/50 p-3 rounded">{report.extraData.followupResult}</div>
                        </div>
                      )}
                      {report.extraData.followupDate && (
                        <div>
                          <div className="text-xs text-muted-foreground">تاريخ المتابعة</div>
                          <div className="text-sm font-medium break-words">{report.extraData.followupDate}</div>
                        </div>
                      )}
                      
                      {/* 11. إغلاق التقرير */}
                      {report.extraData.reportClosureNotes && (
                        <div className="col-span-1 md:col-span-2 mt-4">
                          <div className="text-xs text-muted-foreground mb-1">إغلاق التقرير (إن تمّت عن الشخص المُسند في هذه المهمة)</div>
                          <div className="text-sm leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere bg-muted/50 p-3 rounded">{report.extraData.reportClosureNotes}</div>
                        </div>
                      )}
                      {report.extraData.closureDate && (
                        <div>
                          <div className="text-xs text-muted-foreground">تاريخ الإغلاق</div>
                          <div className="text-sm font-medium break-words">{report.extraData.closureDate}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* OR Details - Matching form order with grid layout */}
                {report.reportType === 'or' && report.extraData && (
                  <div>
                    <div className="bg-muted border border-border rounded px-3 py-2 mb-4">
                      <h3 className="text-xs font-bold text-card-foreground uppercase tracking-wide">OCCURRENCE REPORT (OR) DETAILS</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 break-words">
                      {/* Header Information */}
                      {report.extraData.acReg && (
                        <div>
                          <div className="text-xs text-muted-foreground">A/C Reg.</div>
                          <div className="text-sm font-medium break-words">{report.extraData.acReg}</div>
                        </div>
                      )}
                      {report.extraData.headerDate && (
                        <div>
                          <div className="text-xs text-muted-foreground">Date</div>
                          <div className="text-sm font-medium break-words">{report.extraData.headerDate}</div>
                        </div>
                      )}
                      {report.extraData.reportRef && (
                        <div>
                          <div className="text-xs text-muted-foreground">Report Ref.</div>
                          <div className="text-sm font-medium break-words">{report.extraData.reportRef}</div>
                        </div>
                      )}
                      
                      {/* Date of Occurrence */}
                      {report.extraData.occDate && (
                        <div>
                          <div className="text-xs text-muted-foreground">Date of Occurrence</div>
                          <div className="text-sm font-medium break-words">{report.extraData.occDate}</div>
                        </div>
                      )}
                      {report.extraData.occTime && (
                        <div>
                          <div className="text-xs text-muted-foreground">Time</div>
                          <div className="text-sm font-medium break-words">{report.extraData.occTime}</div>
                        </div>
                      )}
                      {report.extraData.occLocation && (
                        <div className="col-span-1 md:col-span-2">
                          <div className="text-xs text-muted-foreground mb-1">Location</div>
                          <div className="text-sm leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere bg-muted/50 p-3 rounded">{report.extraData.occLocation}</div>
                        </div>
                      )}
                      
                      {/* Type of Occurrence */}
                      {report.extraData.typeOfOccurrence && (
                        <div className="col-span-1 md:col-span-2">
                          <div className="text-xs text-muted-foreground mb-1">Type of Occurrence</div>
                          <div className="text-sm leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere bg-muted/50 p-3 rounded">{report.extraData.typeOfOccurrence}</div>
                        </div>
                      )}
                      
                      {/* Staff Involved */}
                      {report.extraData.staffInvolved && (
                        <div className="col-span-1 md:col-span-2">
                          <div className="text-xs text-muted-foreground mb-1">Name(s) of staff involved</div>
                          <div className="text-sm leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere bg-muted/50 p-3 rounded">{report.extraData.staffInvolved}</div>
                        </div>
                      )}
                      
                      {/* Details */}
                      {report.extraData.details && (
                        <div className="col-span-1 md:col-span-2">
                          <div className="text-xs text-muted-foreground mb-1">Detail and Circumstances of Occurrence</div>
                          <div className="text-sm leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere bg-muted/50 p-3 rounded">{report.extraData.details}</div>
                        </div>
                      )}
                      
                      {/* Damage Extent */}
                      {report.extraData.damageExtent && (
                        <div className="col-span-1 md:col-span-2">
                          <div className="text-xs text-muted-foreground mb-1">Extent of damage or injury to personnel, if any</div>
                          <div className="text-sm leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere bg-muted/50 p-3 rounded">{report.extraData.damageExtent}</div>
                        </div>
                      )}
                      
                      {/* Rectification */}
                      {report.extraData.rectification && (
                        <div className="col-span-1 md:col-span-2">
                          <div className="text-xs text-muted-foreground mb-1">Rectification action taken, if any</div>
                          <div className="text-sm leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere bg-muted/50 p-3 rounded">{report.extraData.rectification}</div>
                        </div>
                      )}
                      
                      {/* Remarks */}
                      {report.extraData.remarks && (
                        <div className="col-span-1 md:col-span-2">
                          <div className="text-xs text-muted-foreground mb-1">Remarks / Comments</div>
                          <div className="text-sm leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere bg-muted/50 p-3 rounded">{report.extraData.remarks}</div>
                        </div>
                      )}
                      
                      {/* QA Engineer */}
                      {report.extraData.qaEngineer && (
                        <div>
                          <div className="text-xs text-muted-foreground">Quality Assurance Engineer</div>
                          <div className="text-sm font-medium break-words">{report.extraData.qaEngineer}</div>
                        </div>
                      )}
                      {report.extraData.qaDate && (
                        <div>
                          <div className="text-xs text-muted-foreground">Date</div>
                          <div className="text-sm font-medium break-words">{report.extraData.qaDate}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* CDF Details */}
                {report.reportType === 'cdf' && report.extraData && (
                  <div>
                    <div className="bg-muted border border-border rounded px-3 py-2 mb-4">
                      <h3 className="text-xs font-bold text-card-foreground uppercase tracking-wide">COMMANDER'S DISCRETION (CDR) DETAILS</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 break-words">
                      {/* Part A - Basic Information (matching form order) */}
                      {report.extraData.airline && (
                        <div>
                          <div className="text-xs text-muted-foreground">Airline</div>
                          <div className="text-sm font-medium break-words">{report.extraData.airline}</div>
                        </div>
                      )}
                      {report.extraData.aircraftType && (
                        <div>
                          <div className="text-xs text-muted-foreground">Aircraft Type</div>
                          <div className="text-sm font-medium break-words">{report.extraData.aircraftType}</div>
                        </div>
                      )}
                      {report.extraData.flightNumber && (
                        <div>
                          <div className="text-xs text-muted-foreground">Flight Number</div>
                          <div className="text-sm font-medium break-words">{report.extraData.flightNumber}</div>
                        </div>
                      )}
                      {report.extraData.commander && (
                        <div>
                          <div className="text-xs text-muted-foreground">Commander</div>
                          <div className="text-sm font-medium break-words">{report.extraData.commander}</div>
                        </div>
                      )}
                      {report.extraData.date && (
                        <div>
                          <div className="text-xs text-muted-foreground">Date</div>
                          <div className="text-sm font-medium break-words">{report.extraData.date}</div>
                        </div>
                      )}
                      {report.extraData.type && (
                        <div>
                          <div className="text-xs text-muted-foreground">Report Type</div>
                          <div className="text-sm font-medium break-words">{report.extraData.type === 'extension' ? 'Extension of FDP/Flying Hours' : 'Reduction of Rest'}</div>
                        </div>
                      )}

                      {/* Part B - Extension of FDP/Flying Hours (matching form order) */}
                      {report.extraData.type === 'extension' && (
                        <>
                          {/* Crew & Rest Information Section */}
                          {report.extraData.crewAcclimatised !== undefined && (
                            <div>
                              <div className="text-xs text-muted-foreground">Crew Acclimatised</div>
                              <div className="text-sm font-medium break-words">{report.extraData.crewAcclimatised ? 'Yes' : 'No'}</div>
                            </div>
                          )}
                          {report.extraData.precedingRestGroup && (
                            <div>
                              <div className="text-xs text-muted-foreground">Length of Preceding Rest</div>
                              <div className="text-sm font-medium break-words">
                                {(() => {
                                  const restLabels: { [key: string]: string } = {
                                    '18to30': '18–30 hrs',
                                    'under18': 'Under 18 hrs',
                                    'over30': 'Over 30 hrs'
                                  };
                                  return restLabels[report.extraData.precedingRestGroup] || report.extraData.precedingRestGroup;
                                })()}
                              </div>
                            </div>
                          )}

                          {/* FDP Calculations Section */}
                          {report.extraData.fdpFromTable && (
                            <div>
                              <div className="text-xs text-muted-foreground">Allowable FDP (Table A/B)</div>
                              <div className="text-sm font-medium break-words">{report.extraData.fdpFromTable}</div>
                            </div>
                          )}
                          {report.extraData.revisedAllowableFdp && (
                            <div>
                              <div className="text-xs text-muted-foreground">Revised Allowable FDP</div>
                              <div className="text-sm font-medium break-words">{report.extraData.revisedAllowableFdp}</div>
                            </div>
                          )}

                          {/* Split Duty Credit Section */}
                          {report.extraData.splitDutyTimeOff && (
                            <div>
                              <div className="text-xs text-muted-foreground">Split Duty - Time Off</div>
                              <div className="text-sm font-medium break-words">{report.extraData.splitDutyTimeOff}</div>
                            </div>
                          )}
                          {report.extraData.splitDutyTimeOn && (
                            <div>
                              <div className="text-xs text-muted-foreground">Split Duty - Time On</div>
                              <div className="text-sm font-medium break-words">{report.extraData.splitDutyTimeOn}</div>
                            </div>
                          )}
                          {report.extraData.splitDutyCredit && (
                            <div>
                              <div className="text-xs text-muted-foreground">Split Duty - Credit</div>
                              <div className="text-sm font-medium break-words">{report.extraData.splitDutyCredit}</div>
                            </div>
                          )}

                          {/* In-Flight Relief Credit Section */}
                          {report.extraData.inflightReliefRest && (
                            <div>
                              <div className="text-xs text-muted-foreground">In-Flight Relief - Rest Taken</div>
                              <div className="text-sm font-medium break-words">{report.extraData.inflightReliefRest}</div>
                            </div>
                          )}
                          {report.extraData.inflightReliefSeat && (
                            <div>
                              <div className="text-xs text-muted-foreground">In-Flight Relief - Bunk/Seat</div>
                              <div className="text-sm font-medium break-words">{report.extraData.inflightReliefSeat}</div>
                            </div>
                          )}
                          {report.extraData.inflightReliefCredit && (
                            <div>
                              <div className="text-xs text-muted-foreground">In-Flight Relief - Credit</div>
                              <div className="text-sm font-medium break-words">{report.extraData.inflightReliefCredit}</div>
                            </div>
                          )}
                        </>
                      )}

                      {/* Voyage Details (Extension) - After In-Flight Relief, before Commander's Discretion */}
                      {report.extraData.type === 'extension' && report.extraData.legs && Array.isArray(report.extraData.legs) && report.extraData.legs.length > 0 && (
                  <div className="col-span-1 md:col-span-2">
                          <div className="text-xs text-muted-foreground mb-2">Voyage Details</div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs border">
                              <thead>
                                <tr className="bg-muted">
                                  <th className="p-2 text-left border">Label</th>
                                  <th className="p-2 text-left border">Place</th>
                                  <th className="p-2 text-left border">UTC (Planned)</th>
                                  <th className="p-2 text-left border">Local (Planned)</th>
                                  <th className="p-2 text-left border">UTC (Actual)</th>
                                  <th className="p-2 text-left border">Local (Actual)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {report.extraData.legs.map((leg: any, idx: number) => {
                                  const isFdpToEndRow = idx === 9 && leg.label === 'FDP to end';
                                  const isActualFdpRow = idx === 10 && leg.label === 'Actual FDP';
                                  const legs = report.extraData.legs || [];
                                  
                                  // Calculate FDP Duration for "FDP to end" row (Planned only)
                                  let plannedUtcDuration: string | null = null;
                                  let plannedLocalDuration: string | null = null;
                                  
                                  if (isFdpToEndRow) {
                                    plannedUtcDuration = calculateFdpDurationForColumn(legs, 'utcPlanned');
                                    plannedLocalDuration = calculateFdpDurationForColumn(legs, 'localPlanned');
                                  }
                                  
                                  // Calculate FDP Duration for "Actual FDP" row (Actual only)
                                  let actualUtcDuration: string | null = null;
                                  let actualLocalDuration: string | null = null;
                                  
                                  if (isActualFdpRow) {
                                    actualUtcDuration = calculateFdpDurationForColumn(legs, 'utcActual');
                                    actualLocalDuration = calculateFdpDurationForColumn(legs, 'localActual');
                                  }
                                  
                                  return (
                                    (leg.label || leg.place || leg.utcPlanned || leg.localPlanned || leg.utcActual || leg.localActual) && (
                                      <tr key={idx} className={`border-t ${isFdpToEndRow || isActualFdpRow ? 'bg-muted/20' : ''}`}>
                                        <td className="p-2 border font-medium">{leg.label || '-'}</td>
                                        <td className="p-2 border">
                                          {isFdpToEndRow ? (
                                            <div className="text-xs bg-muted rounded px-2 py-1 text-muted-foreground">
                                              {plannedUtcDuration ? `FDP: ${plannedUtcDuration}` : 'FDP to end'}
                                            </div>
                                          ) : isActualFdpRow ? (
                                            <div className="text-xs bg-muted rounded px-2 py-1 text-muted-foreground">
                                              Actual FDP
                                            </div>
                                          ) : (
                                            leg.place || '-'
                                          )}
                                        </td>
                                        <td className={`p-2 border font-mono ${isFdpToEndRow ? 'bg-primary/10 font-semibold text-primary' : ''}`}>
                                          {isFdpToEndRow ? (plannedUtcDuration || '--:--') : isActualFdpRow ? '-' : (leg.utcPlanned || '-')}
                                        </td>
                                        <td className={`p-2 border font-mono ${isFdpToEndRow ? 'bg-primary/10 font-semibold text-primary' : ''}`}>
                                          {isFdpToEndRow ? (plannedLocalDuration || '--:--') : isActualFdpRow ? '-' : (leg.localPlanned || '-')}
                                        </td>
                                        <td className={`p-2 border font-mono ${isActualFdpRow ? 'bg-primary/10 font-semibold text-primary' : ''}`}>
                                          {isFdpToEndRow ? '-' : isActualFdpRow ? (actualUtcDuration || '--:--') : (leg.utcActual || '-')}
                                        </td>
                                        <td className={`p-2 border font-mono ${isActualFdpRow ? 'bg-primary/10 font-semibold text-primary' : ''}`}>
                                          {isFdpToEndRow ? '-' : isActualFdpRow ? (actualLocalDuration || '--:--') : (leg.localActual || '-')}
                                        </td>
                                      </tr>
                                    )
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                  </div>
                )}

                      {/* Commander's Discretion Section (Extension) - After Voyage Details */}
                      {report.extraData.type === 'extension' && (
                        <>
                          {report.extraData.amountDiscretionHrs !== undefined && 
                           report.extraData.amountDiscretionHrs !== null && 
                           report.extraData.amountDiscretionHrs !== '' && 
                           Number(report.extraData.amountDiscretionHrs) !== 0 && (
                            <div>
                              <div className="text-xs text-muted-foreground">Commander's Discretion - Amount (Hours)</div>
                              <div className="text-sm font-medium break-words">{report.extraData.amountDiscretionHrs}</div>
                            </div>
                          )}
                          {report.extraData.amountDiscretionMins !== undefined && 
                           report.extraData.amountDiscretionMins !== null && 
                           report.extraData.amountDiscretionMins !== '' && 
                           Number(report.extraData.amountDiscretionMins) !== 0 && (
                            <div>
                              <div className="text-xs text-muted-foreground">Commander's Discretion - Amount (Minutes)</div>
                              <div className="text-sm font-medium break-words">{report.extraData.amountDiscretionMins}</div>
                            </div>
                          )}

                          {/* Additional Information Section */}
                          {report.extraData.maxFlyingHoursNote && (
                            <div className="col-span-1 md:col-span-2">
                              <div className="text-xs text-muted-foreground mb-1">Maximum Flying Hours Permitted Note</div>
                              <div className="text-sm leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere bg-muted/50 p-3 rounded">{report.extraData.maxFlyingHoursNote}</div>
                            </div>
                          )}
                        </>
                      )}

                      {/* Part B - Reduction of Rest (matching form order) */}
                      {report.extraData.type === 'reduction' && (
                        <>
                          {/* Last Duty Period Section */}
                          {(report.extraData.lastDutyStartedUtc || report.extraData.lastDutyStartedUtcDate || report.extraData.lastDutyStartedUtcTime) && (
                            <div>
                              <div className="text-xs text-muted-foreground">Last Duty Started (UTC)</div>
                              <div className="text-sm font-medium font-mono break-words">
                                {(() => {
                                  if (report.extraData.lastDutyStartedUtc) {
                                    return formatDateTimeToDDMMYYYYHHMM(report.extraData.lastDutyStartedUtc);
                                  } else if (report.extraData.lastDutyStartedUtcDate || report.extraData.lastDutyStartedUtcTime) {
                                    const formattedDate = (() => {
                                      const dateStr = report.extraData.lastDutyStartedUtcDate;
                                      if (!dateStr) return '';
                                      if (dateStr.includes('-') && dateStr.length === 10) {
                                        const [year, month, day] = dateStr.split('-');
                                        return `${day}/${month}/${year}`;
                                      }
                                      return dateStr;
                                    })();
                                    return [formattedDate, report.extraData.lastDutyStartedUtcTime].filter(Boolean).join(' ');
                                  }
                                  return '';
                                })()}
                              </div>
                            </div>
                          )}
                          {(report.extraData.lastDutyStartedLocal || report.extraData.lastDutyStartedLocalDate || report.extraData.lastDutyStartedLocalTime) && (
                            <div>
                              <div className="text-xs text-muted-foreground">Last Duty Started (Local)</div>
                              <div className="text-sm font-medium font-mono break-words">
                                {(() => {
                                  if (report.extraData.lastDutyStartedLocal) {
                                    return formatDateTimeToDDMMYYYYHHMM(report.extraData.lastDutyStartedLocal);
                                  } else if (report.extraData.lastDutyStartedLocalDate || report.extraData.lastDutyStartedLocalTime) {
                                    const formattedDate = (() => {
                                      const dateStr = report.extraData.lastDutyStartedLocalDate;
                                      if (!dateStr) return '';
                                      if (dateStr.includes('-') && dateStr.length === 10) {
                                        const [year, month, day] = dateStr.split('-');
                                        return `${day}/${month}/${year}`;
                                      }
                                      return dateStr;
                                    })();
                                    return [formattedDate, report.extraData.lastDutyStartedLocalTime].filter(Boolean).join(' ');
                                  }
                                  return '';
                                })()}
                              </div>
                            </div>
                          )}
                          {(report.extraData.lastDutyEndedUtc || report.extraData.lastDutyEndedUtcDate || report.extraData.lastDutyEndedUtcTime) && (
                            <div>
                              <div className="text-xs text-muted-foreground">Last Duty Ended (UTC)</div>
                              <div className="text-sm font-medium font-mono break-words">
                                {(() => {
                                  if (report.extraData.lastDutyEndedUtc) {
                                    return formatDateTimeToDDMMYYYYHHMM(report.extraData.lastDutyEndedUtc);
                                  } else if (report.extraData.lastDutyEndedUtcDate || report.extraData.lastDutyEndedUtcTime) {
                                    const formattedDate = (() => {
                                      const dateStr = report.extraData.lastDutyEndedUtcDate;
                                      if (!dateStr) return '';
                                      if (dateStr.includes('-') && dateStr.length === 10) {
                                        const [year, month, day] = dateStr.split('-');
                                        return `${day}/${month}/${year}`;
                                      }
                                      return dateStr;
                                    })();
                                    return [formattedDate, report.extraData.lastDutyEndedUtcTime].filter(Boolean).join(' ');
                                  }
                                  return '';
                                })()}
                              </div>
                            </div>
                          )}
                          {(report.extraData.lastDutyEndedLocal || report.extraData.lastDutyEndedLocalDate || report.extraData.lastDutyEndedLocalTime) && (
                            <div>
                              <div className="text-xs text-muted-foreground">Last Duty Ended (Local)</div>
                              <div className="text-sm font-medium font-mono break-words">
                                {(() => {
                                  if (report.extraData.lastDutyEndedLocal) {
                                    return formatDateTimeToDDMMYYYYHHMM(report.extraData.lastDutyEndedLocal);
                                  } else if (report.extraData.lastDutyEndedLocalDate || report.extraData.lastDutyEndedLocalTime) {
                                    const formattedDate = (() => {
                                      const dateStr = report.extraData.lastDutyEndedLocalDate;
                                      if (!dateStr) return '';
                                      if (dateStr.includes('-') && dateStr.length === 10) {
                                        const [year, month, day] = dateStr.split('-');
                                        return `${day}/${month}/${year}`;
                                      }
                                      return dateStr;
                                    })();
                                    return [formattedDate, report.extraData.lastDutyEndedLocalTime].filter(Boolean).join(' ');
                                  }
                                  return '';
                                })()}
                              </div>
                            </div>
                          )}

                          {/* Rest & Next FDP Calculation Section */}
                          {report.extraData.restEarnedHours && (
                            <div>
                              <div className="text-xs text-muted-foreground">Rest Earned (Hours)</div>
                              <div className="text-sm font-medium break-words">{report.extraData.restEarnedHours}</div>
                            </div>
                          )}
                          {(report.extraData.calculatedEarliestNextAvailableUtc || report.extraData.calculatedEarliestNextAvailableUtcDate || report.extraData.calculatedEarliestNextAvailableUtcTime) && (
                            <div>
                              <div className="text-xs text-muted-foreground">Calculated Earliest Next Available (UTC)</div>
                              <div className="text-sm font-medium font-mono break-words">
                                {(() => {
                                  if (report.extraData.calculatedEarliestNextAvailableUtc) {
                                    return formatDateTimeToDDMMYYYYHHMM(report.extraData.calculatedEarliestNextAvailableUtc);
                                  } else if (report.extraData.calculatedEarliestNextAvailableUtcDate || report.extraData.calculatedEarliestNextAvailableUtcTime) {
                                    const formattedDate = (() => {
                                      const dateStr = report.extraData.calculatedEarliestNextAvailableUtcDate;
                                      if (!dateStr) return '';
                                      if (dateStr.includes('-') && dateStr.length === 10) {
                                        const [year, month, day] = dateStr.split('-');
                                        return `${day}/${month}/${year}`;
                                      }
                                      return dateStr;
                                    })();
                                    return [formattedDate, report.extraData.calculatedEarliestNextAvailableUtcTime].filter(Boolean).join(' ');
                                  }
                                  return '';
                                })()}
                              </div>
                            </div>
                          )}
                          {(report.extraData.calculatedEarliestNextAvailableLocal || report.extraData.calculatedEarliestNextAvailableLocalDate || report.extraData.calculatedEarliestNextAvailableLocalTime) && (
                            <div>
                              <div className="text-xs text-muted-foreground">Calculated Earliest Next Available (Local)</div>
                              <div className="text-sm font-medium font-mono break-words">
                                {(() => {
                                  if (report.extraData.calculatedEarliestNextAvailableLocal) {
                                    return formatDateTimeToDDMMYYYYHHMM(report.extraData.calculatedEarliestNextAvailableLocal);
                                  } else if (report.extraData.calculatedEarliestNextAvailableLocalDate || report.extraData.calculatedEarliestNextAvailableLocalTime) {
                                    const formattedDate = (() => {
                                      const dateStr = report.extraData.calculatedEarliestNextAvailableLocalDate;
                                      if (!dateStr) return '';
                                      if (dateStr.includes('-') && dateStr.length === 10) {
                                        const [year, month, day] = dateStr.split('-');
                                        return `${day}/${month}/${year}`;
                                      }
                                      return dateStr;
                                    })();
                                    return [formattedDate, report.extraData.calculatedEarliestNextAvailableLocalTime].filter(Boolean).join(' ');
                                  }
                                  return '';
                                })()}
                              </div>
                            </div>
                          )}
                          {(report.extraData.actualStartNextFdpUtc || report.extraData.actualStartNextFdpUtcDate || report.extraData.actualStartNextFdpUtcTime) && (
                            <div>
                              <div className="text-xs text-muted-foreground">Actual Start of Next FDP (UTC)</div>
                              <div className="text-sm font-medium font-mono break-words">
                                {(() => {
                                  if (report.extraData.actualStartNextFdpUtc) {
                                    return formatDateTimeToDDMMYYYYHHMM(report.extraData.actualStartNextFdpUtc);
                                  } else if (report.extraData.actualStartNextFdpUtcDate || report.extraData.actualStartNextFdpUtcTime) {
                                    const formattedDate = (() => {
                                      const dateStr = report.extraData.actualStartNextFdpUtcDate;
                                      if (!dateStr) return '';
                                      if (dateStr.includes('-') && dateStr.length === 10) {
                                        const [year, month, day] = dateStr.split('-');
                                        return `${day}/${month}/${year}`;
                                      }
                                      return dateStr;
                                    })();
                                    return [formattedDate, report.extraData.actualStartNextFdpUtcTime].filter(Boolean).join(' ');
                                  }
                                  return '';
                                })()}
                              </div>
                            </div>
                          )}
                          {(report.extraData.actualStartNextFdpLocal || report.extraData.actualStartNextFdpLocalDate || report.extraData.actualStartNextFdpLocalTime) && (
                            <div>
                              <div className="text-xs text-muted-foreground">Actual Start of Next FDP (Local)</div>
                              <div className="text-sm font-medium font-mono break-words">
                                {(() => {
                                  if (report.extraData.actualStartNextFdpLocal) {
                                    return formatDateTimeToDDMMYYYYHHMM(report.extraData.actualStartNextFdpLocal);
                                  } else if (report.extraData.actualStartNextFdpLocalDate || report.extraData.actualStartNextFdpLocalTime) {
                                    const formattedDate = (() => {
                                      const dateStr = report.extraData.actualStartNextFdpLocalDate;
                                      if (!dateStr) return '';
                                      if (dateStr.includes('-') && dateStr.length === 10) {
                                        const [year, month, day] = dateStr.split('-');
                                        return `${day}/${month}/${year}`;
                                      }
                                      return dateStr;
                                    })();
                                    return [formattedDate, report.extraData.actualStartNextFdpLocalTime].filter(Boolean).join(' ');
                                  }
                                  return '';
                                })()}
                              </div>
                            </div>
                          )}

                          {/* Reduction Details Section */}
                          {report.extraData.restReducedBy && (
                            <div>
                              <div className="text-xs text-muted-foreground">Rest Period Reduced By</div>
                              <div className="text-sm font-medium break-words">{report.extraData.restReducedBy}</div>
                            </div>
                          )}
                          {report.extraData.crewAffected && (
                            <div>
                              <div className="text-xs text-muted-foreground">Crew Affected</div>
                              <div className="text-sm font-medium break-words">{report.extraData.crewAffected}</div>
                            </div>
                          )}
                        </>
                      )}
                      
                      {/* Part C - Commander's Report */}
                      {report.extraData.remarksActionTaken && (
                        <div className="col-span-1 md:col-span-2 mt-4">
                          <div className="text-xs text-muted-foreground mb-1">Remarks / Action Taken</div>
                          <div className="text-sm leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere bg-muted/50 p-3 rounded">{report.extraData.remarksActionTaken}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* CHR Details - Matching form order with grid layout */}
                {report.reportType === 'chr' && report.extraData && (
                  <div>
                    <div className="bg-muted border border-border rounded px-3 py-2 mb-4">
                      <h3 className="text-xs font-bold text-card-foreground uppercase tracking-wide">CONFIDENTIAL HAZARD REPORT (CHR) DETAILS</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 break-words">
                      {/* Hazard Description and Recommendations */}
                      {report.extraData.hazardDescription && (
                        <div className="col-span-1 md:col-span-2">
                          <div className="text-xs text-muted-foreground mb-1">Hazard Description</div>
                          <div className="text-sm leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere bg-muted/50 p-3 rounded">{report.extraData.hazardDescription}</div>
                        </div>
                      )}
                      {report.extraData.recommendations && (
                        <div className="col-span-1 md:col-span-2">
                          <div className="text-xs text-muted-foreground mb-1">Recommendations</div>
                          <div className="text-sm leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere bg-muted/50 p-3 rounded">{report.extraData.recommendations}</div>
                        </div>
                      )}
                      
                      {/* Reporter Information */}
                      {report.extraData.reporterName && (
                        <div>
                          <div className="text-xs text-muted-foreground">Reporter Name</div>
                          <div className="text-sm font-medium break-words">{report.extraData.reporterName}</div>
                        </div>
                      )}
                      {report.extraData.reporterPosition && (
                        <div>
                          <div className="text-xs text-muted-foreground">Reporter Position</div>
                          <div className="text-sm font-medium break-words">{report.extraData.reporterPosition}</div>
                        </div>
                      )}
                      {report.extraData.reporterIdNo && (
                        <div>
                          <div className="text-xs text-muted-foreground">Reporter ID No</div>
                          <div className="text-sm font-medium break-words">{report.extraData.reporterIdNo}</div>
                        </div>
                      )}
                      {report.extraData.reporterDate && (
                        <div>
                          <div className="text-xs text-muted-foreground">Reporter Date</div>
                          <div className="text-sm font-medium break-words">{report.extraData.reporterDate}</div>
                        </div>
                      )}
                      
                      {/* Safety Officer Information */}
                      {report.extraData.validationNotes && (
                        <div className="col-span-1 md:col-span-2">
                          <div className="text-xs text-muted-foreground mb-1">Validation Notes</div>
                          <div className="text-sm leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere bg-muted/50 p-3 rounded">{report.extraData.validationNotes}</div>
                        </div>
                      )}
                      {report.extraData.safetyOfficerName && (
                        <div>
                          <div className="text-xs text-muted-foreground">Safety Officer Name</div>
                          <div className="text-sm font-medium break-words">{report.extraData.safetyOfficerName}</div>
                        </div>
                      )}
                      {report.extraData.safetyOfficerDate && (
                        <div>
                          <div className="text-xs text-muted-foreground">Safety Officer Date</div>
                          <div className="text-sm font-medium break-words">{report.extraData.safetyOfficerDate}</div>
                        </div>
                      )}
                      
                      {/* Corrective Action */}
                      {report.extraData.correctiveActionNotes && (
                        <div className="col-span-1 md:col-span-2">
                          <div className="text-xs text-muted-foreground mb-1">Corrective Action Notes</div>
                          <div className="text-sm leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere bg-muted/50 p-3 rounded">{report.extraData.correctiveActionNotes}</div>
                        </div>
                      )}
                      {report.extraData.correctiveName && (
                        <div>
                          <div className="text-xs text-muted-foreground">Corrective Name</div>
                          <div className="text-sm font-medium break-words">{report.extraData.correctiveName}</div>
                        </div>
                      )}
                      {report.extraData.correctiveDate && (
                        <div>
                          <div className="text-xs text-muted-foreground">Corrective Date</div>
                          <div className="text-sm font-medium break-words">{report.extraData.correctiveDate}</div>
                        </div>
                      )}
                      
                      {/* Follow-Up */}
                      {report.extraData.followUpActionTaken && (
                        <div className="col-span-1 md:col-span-2">
                          <div className="text-xs text-muted-foreground mb-1">Follow-Up Action Taken</div>
                          <div className="text-sm leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere bg-muted/50 p-3 rounded">{report.extraData.followUpActionTaken}</div>
                        </div>
                      )}
                      {report.extraData.followUpDecision && (
                        <div>
                          <div className="text-xs text-muted-foreground">Follow-Up Decision</div>
                          <div className="text-sm font-medium break-words">
                            {(() => {
                              const decisionLabels: { [key: string]: string } = {
                                'SAT': 'SAT (مقبول)',
                                'UNSAT': 'UNSAT (غير مقبول)',
                                'NEXT_AUDIT': 'NEXT AUDIT (التدقيق القادم)'
                              };
                              return decisionLabels[report.extraData.followUpDecision] || report.extraData.followUpDecision;
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* RIR Details - Matching form order with grid layout */}
                {report.reportType === 'rir' && report.extraData && (
                  <div>
                    <div className="bg-muted border border-border rounded px-3 py-2 mb-4">
                      <h3 className="text-xs font-bold text-card-foreground uppercase tracking-wide">RAMP INCIDENT REPORT (RIR) DETAILS</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 break-words">
                      {/* Incident Information */}
                      {report.extraData.incidentTitle && (
                        <div className="col-span-1 md:col-span-2">
                          <div className="text-xs text-muted-foreground mb-1">Incident Title</div>
                          <div className="text-sm leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere bg-muted/50 p-3 rounded">{report.extraData.incidentTitle}</div>
                        </div>
                      )}
                      {report.extraData.damageIn && (
                        <div>
                          <div className="text-xs text-muted-foreground">Damage In</div>
                          <div className="text-sm font-medium break-words">{report.extraData.damageIn}</div>
                        </div>
                      )}
                      
                      {/* Damage By */}
                      {(report.extraData.damageByAircraft || report.extraData.damageByRampEq || report.extraData.damageByVehicle || report.extraData.damageByForeignObj || report.extraData.damageByJetBlast || report.extraData.damageByUnknown || report.extraData.damageByOther) && (
                        <div className="col-span-1 md:col-span-2">
                          <div className="text-xs text-muted-foreground mb-1">Damage By</div>
                          <div className="text-sm font-medium break-words">
                            {[
                              report.extraData.damageByAircraft && 'Aircraft',
                              report.extraData.damageByRampEq && 'Ramp Equipment',
                              report.extraData.damageByVehicle && 'Vehicle',
                              report.extraData.damageByForeignObj && 'Foreign Object',
                              report.extraData.damageByJetBlast && 'Jet Blast',
                              report.extraData.damageByUnknown && 'Unknown',
                              report.extraData.damageByOther
                            ].filter(Boolean).join(', ')}
                          </div>
                        </div>
                      )}
                      
                      {/* Date and Time */}
                      {report.extraData.date && (
                        <div>
                          <div className="text-xs text-muted-foreground">Date</div>
                          <div className="text-sm font-medium break-words">{report.extraData.date}</div>
                        </div>
                      )}
                      {report.extraData.timeOfOccurrence && (
                        <div>
                          <div className="text-xs text-muted-foreground">Time of Occurrence</div>
                          <div className="text-sm font-medium break-words">{report.extraData.timeOfOccurrence}</div>
                        </div>
                      )}
                      
                      {/* Phase and Location */}
                      {report.extraData.phaseOfOperation && (
                        <div>
                          <div className="text-xs text-muted-foreground">Phase of Operation</div>
                          <div className="text-sm font-medium break-words">{report.extraData.phaseOfOperation}</div>
                        </div>
                      )}
                      {report.extraData.areaStand && (
                        <div>
                          <div className="text-xs text-muted-foreground">Area / Stand</div>
                          <div className="text-sm font-medium break-words">{report.extraData.areaStand}</div>
                        </div>
                      )}
                      
                      {/* Aircraft Information */}
                      {report.extraData.aircraftRegistration && (
                        <div>
                          <div className="text-xs text-muted-foreground">Aircraft Registration</div>
                          <div className="text-sm font-medium break-words">{report.extraData.aircraftRegistration}</div>
                        </div>
                      )}
                      {report.extraData.aircraftType && (
                        <div>
                          <div className="text-xs text-muted-foreground">Aircraft Type</div>
                          <div className="text-sm font-medium break-words">{report.extraData.aircraftType}</div>
                        </div>
                      )}
                      {report.extraData.flightNo && (
                        <div>
                          <div className="text-xs text-muted-foreground">Flight No.</div>
                          <div className="text-sm font-medium break-words">{report.extraData.flightNo}</div>
                        </div>
                      )}
                      {report.extraData.scheduledGroundTime && (
                        <div>
                          <div className="text-xs text-muted-foreground">Scheduled Ground Time</div>
                          <div className="text-sm font-medium break-words">{report.extraData.scheduledGroundTime}</div>
                        </div>
                      )}
                      
                      {/* Flight Delay */}
                      {(report.extraData.flightDelayHrs || report.extraData.flightDelayMin) && (
                        <div>
                          <div className="text-xs text-muted-foreground">Flight Delay</div>
                          <div className="text-sm font-medium break-words">
                            {report.extraData.flightDelayHrs || '0'} hrs {report.extraData.flightDelayMin || '0'} min
                          </div>
                        </div>
                      )}
                      {report.extraData.flightCancelled && (
                        <div>
                          <div className="text-xs text-muted-foreground">Flight Cancelled</div>
                          <div className="text-sm font-medium break-words">{report.extraData.flightCancelled === 'yes' ? 'Yes' : 'No'}</div>
                        </div>
                      )}
                      
                      {/* Type of Occurrence */}
                      {report.extraData.typeOfOccurrence && (
                        <div className="col-span-1 md:col-span-2">
                          <div className="text-xs text-muted-foreground mb-1">Type of Occurrence</div>
                          <div className="text-sm leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere bg-muted/50 p-3 rounded">{report.extraData.typeOfOccurrence}</div>
                        </div>
                      )}
                      
                      {/* Casualties */}
                      {(report.extraData.casualtiesEmployeesFatal || report.extraData.casualtiesEmployeesNonFatal || report.extraData.casualtiesPassengersFatal || report.extraData.casualtiesPassengersNonFatal || report.extraData.casualtiesOthersFatal || report.extraData.casualtiesOthersNonFatal) && (
                        <div className="col-span-1 md:col-span-2">
                          <div className="text-xs text-muted-foreground mb-1">Casualties</div>
                          <div className="text-sm font-medium break-words">
                            {[
                              report.extraData.casualtiesEmployeesFatal && `Employees Fatal: ${report.extraData.casualtiesEmployeesFatal}`,
                              report.extraData.casualtiesEmployeesNonFatal && `Employees Non-Fatal: ${report.extraData.casualtiesEmployeesNonFatal}`,
                              report.extraData.casualtiesPassengersFatal && `Passengers Fatal: ${report.extraData.casualtiesPassengersFatal}`,
                              report.extraData.casualtiesPassengersNonFatal && `Passengers Non-Fatal: ${report.extraData.casualtiesPassengersNonFatal}`,
                              report.extraData.casualtiesOthersFatal && `Others Fatal: ${report.extraData.casualtiesOthersFatal}`,
                              report.extraData.casualtiesOthersNonFatal && `Others Non-Fatal: ${report.extraData.casualtiesOthersNonFatal}`
                            ].filter(Boolean).join(' | ')}
                          </div>
                        </div>
                      )}
                      
                      {/* Vehicle/Ramp Equipment Information */}
                      {report.extraData.serialFleetNr && (
                        <div>
                          <div className="text-xs text-muted-foreground">Serial / Fleet Nr.</div>
                          <div className="text-sm font-medium break-words">{report.extraData.serialFleetNr}</div>
                        </div>
                      )}
                      {report.extraData.vehicleType && (
                        <div>
                          <div className="text-xs text-muted-foreground">Vehicle Type</div>
                          <div className="text-sm font-medium break-words">{report.extraData.vehicleType}</div>
                        </div>
                      )}
                      {report.extraData.owner && (
                        <div>
                          <div className="text-xs text-muted-foreground">Owner</div>
                          <div className="text-sm font-medium break-words">{report.extraData.owner}</div>
                        </div>
                      )}
                      {report.extraData.areaVehicle && (
                        <div>
                          <div className="text-xs text-muted-foreground">Area Vehicle</div>
                          <div className="text-sm font-medium break-words">{report.extraData.areaVehicle}</div>
                        </div>
                      )}
                      
                      {/* Vehicle Condition */}
                      {(report.extraData.tiresSvc || report.extraData.tiresFault || report.extraData.brakesSvc || report.extraData.brakesFault || report.extraData.steeringSvc || report.extraData.steeringFault || report.extraData.lightsSvc || report.extraData.lightsFault || report.extraData.wipersSvc || report.extraData.wipersFault || report.extraData.protectionSvc || report.extraData.protectionFault || report.extraData.warningSvc || report.extraData.warningFault || report.extraData.stabilizersSvc || report.extraData.stabilizersFault || report.extraData.towHitchSvc || report.extraData.towHitchFault || report.extraData.fieldVisionSvc || report.extraData.fieldVisionFault) && (
                        <div className="col-span-1 md:col-span-2">
                          <div className="text-xs text-muted-foreground mb-1">Vehicle/Ramp Equipment Condition</div>
                          <div className="text-sm font-medium break-words">
                            {[
                              report.extraData.tiresSvc && 'Tires: Serviceable',
                              report.extraData.tiresFault && 'Tires: Faulty',
                              report.extraData.brakesSvc && 'Brakes: Serviceable',
                              report.extraData.brakesFault && 'Brakes: Faulty',
                              report.extraData.steeringSvc && 'Steering: Serviceable',
                              report.extraData.steeringFault && 'Steering: Faulty',
                              report.extraData.lightsSvc && 'Lights: Serviceable',
                              report.extraData.lightsFault && 'Lights: Faulty',
                              report.extraData.wipersSvc && 'Wipers: Serviceable',
                              report.extraData.wipersFault && 'Wipers: Faulty',
                              report.extraData.protectionSvc && 'Protection: Serviceable',
                              report.extraData.protectionFault && 'Protection: Faulty',
                              report.extraData.warningSvc && 'Warning: Serviceable',
                              report.extraData.warningFault && 'Warning: Faulty',
                              report.extraData.stabilizersSvc && 'Stabilizers: Serviceable',
                              report.extraData.stabilizersFault && 'Stabilizers: Faulty',
                              report.extraData.towHitchSvc && 'Tow Hitch: Serviceable',
                              report.extraData.towHitchFault && 'Tow Hitch: Faulty',
                              report.extraData.fieldVisionSvc && 'Field Vision: Serviceable',
                              report.extraData.fieldVisionFault && 'Field Vision: Faulty'
                            ].filter(Boolean).join(' | ')}
                          </div>
                        </div>
                      )}
                      
                      {/* Weather/Surface/Lighting */}
                      {(report.extraData.wRain || report.extraData.wSnow || report.extraData.wSleet || report.extraData.wHail || report.extraData.wFog || report.extraData.visibilityKm || report.extraData.windGustKts || report.extraData.temperatureC) && (
                        <div className="col-span-1 md:col-span-2">
                          <div className="text-xs text-muted-foreground mb-1">Weather</div>
                          <div className="text-sm font-medium break-words">
                            {[
                              report.extraData.wRain && 'Rain',
                              report.extraData.wSnow && 'Snow',
                              report.extraData.wSleet && 'Sleet',
                              report.extraData.wHail && 'Hail',
                              report.extraData.wFog && 'Fog',
                              report.extraData.visibilityKm && `Visibility: ${report.extraData.visibilityKm} km`,
                              report.extraData.windGustKts && `Wind Gust: ${report.extraData.windGustKts} kts`,
                              report.extraData.temperatureC && `Temperature: ${report.extraData.temperatureC}°C`
                            ].filter(Boolean).join(' | ')}
                          </div>
                        </div>
                      )}
                      {(report.extraData.sDry || report.extraData.sWet || report.extraData.sSnow || report.extraData.sSlush || report.extraData.sIce || report.extraData.sContamination) && (
                        <div className="col-span-1 md:col-span-2">
                          <div className="text-xs text-muted-foreground mb-1">Surface</div>
                          <div className="text-sm font-medium break-words">
                            {[
                              report.extraData.sDry && 'Dry',
                              report.extraData.sWet && 'Wet',
                              report.extraData.sSnow && 'Snow',
                              report.extraData.sSlush && 'Slush',
                              report.extraData.sIce && 'Ice',
                              report.extraData.sContamination && 'Contamination'
                            ].filter(Boolean).join(' | ')}
                          </div>
                        </div>
                      )}
                      {(report.extraData.lGood || report.extraData.lPoor || report.extraData.lDay || report.extraData.lNight || report.extraData.lTwilight) && (
                        <div className="col-span-1 md:col-span-2">
                          <div className="text-xs text-muted-foreground mb-1">Lighting</div>
                          <div className="text-sm font-medium break-words">
                            {[
                              report.extraData.lGood && 'Good',
                              report.extraData.lPoor && 'Poor',
                              report.extraData.lDay && 'Day',
                              report.extraData.lNight && 'Night',
                              report.extraData.lTwilight && 'Twilight'
                            ].filter(Boolean).join(' | ')}
                          </div>
                        </div>
                      )}
                      
                      {/* Contributory Factors */}
                      {report.extraData.contributoryMajor && (
                        <div className="col-span-1 md:col-span-2">
                          <div className="text-xs text-muted-foreground mb-1">Contributory Major</div>
                          <div className="text-sm leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere bg-muted/50 p-3 rounded">{report.extraData.contributoryMajor}</div>
                        </div>
                      )}
                      {report.extraData.contributoryOther && (
                        <div className="col-span-1 md:col-span-2">
                          <div className="text-xs text-muted-foreground mb-1">Contributory Other</div>
                          <div className="text-sm leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere bg-muted/50 p-3 rounded">{report.extraData.contributoryOther}</div>
                        </div>
                      )}
                      
                      {/* Personnel */}
                      {report.extraData.personnel && Array.isArray(report.extraData.personnel) && report.extraData.personnel.length > 0 && (
                        <div className="col-span-1 md:col-span-2">
                          <div className="text-xs text-muted-foreground mb-1">Personnel</div>
                          <div className="text-sm font-medium break-words">
                            {report.extraData.personnel.map((p: any, idx: number) => 
                              p.name || p.jobTitle || p.company ? 
                                `Person ${idx + 1}: ${[p.name, p.jobTitle, p.company, p.staffNr, p.license].filter(Boolean).join(' - ')}` : 
                                null
                            ).filter(Boolean).join(' | ')}
                          </div>
                        </div>
                      )}
                      
                      {/* Report Prepared By */}
                      {report.extraData.reportPreparedBy && (
                        <div>
                          <div className="text-xs text-muted-foreground">Report Prepared By</div>
                          <div className="text-sm font-medium break-words">{report.extraData.reportPreparedBy}</div>
                        </div>
                      )}
                      {report.extraData.reportPosition && (
                        <div>
                          <div className="text-xs text-muted-foreground">Report Position</div>
                          <div className="text-sm font-medium break-words">{report.extraData.reportPosition}</div>
                        </div>
                      )}
                      
                      {/* Remarks */}
                      {report.extraData.remarks && (
                        <div className="col-span-1 md:col-span-2">
                          <div className="text-xs text-muted-foreground mb-1">Remarks</div>
                          <div className="text-sm leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere bg-muted/50 p-3 rounded">{report.extraData.remarks}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Captain Report Details */}
                {report.reportType === 'captain' && (
                  <div>
                    <div className="bg-muted border border-border rounded px-3 py-2 mb-4">
                      <h3 className="text-xs font-bold text-card-foreground uppercase tracking-wide">CAPTAIN REPORT DETAILS</h3>
                    </div>
                    
                    {/* Flight Information Section - Matching form order */}
                    <div className="mb-6">
                      <div className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Flight Information</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 break-words">
                        {report.extraData?.aircraftReg && (
                          <div>
                            <div className="text-xs text-muted-foreground mb-1">Aircraft reg</div>
                            <div className="text-sm font-medium break-words">{report.extraData.aircraftReg}</div>
                          </div>
                        )}
                        {report.flightNumber && (
                          <div>
                            <div className="text-xs text-muted-foreground mb-1">Flight number</div>
                            <div className="text-sm font-medium break-words">{report.flightNumber}</div>
                          </div>
                        )}
                        {report.eventDateTime && (
                          <div>
                            <div className="text-xs text-muted-foreground mb-1">Date of flight</div>
                            <div className="text-sm font-medium">{formatDateToDDMMYYYY(report.eventDateTime)}</div>
                          </div>
                        )}
                        {report.extraData?.aircraftType && (
                          <div>
                            <div className="text-xs text-muted-foreground mb-1">Aircraft Type</div>
                            <div className="text-sm font-medium break-words">{report.extraData.aircraftType}</div>
                          </div>
                        )}
                        {report.extraData?.captainEmail && (
                          <div>
                            <div className="text-xs text-muted-foreground mb-1">Captain email</div>
                            <div className="text-sm font-medium break-words">{report.extraData.captainEmail}</div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Crew Information Section - Matching form order */}
                    {(report.extraData?.cm1 || report.extraData?.cm2 || report.extraData?.chiefCabin) && (
                      <div className="mb-6">
                        <div className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Crew Information</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 break-words">
                          {report.extraData?.cm1 && (
                            <div>
                              <div className="text-xs text-muted-foreground mb-1">CM 1</div>
                              <div className="text-sm font-medium break-words">{report.extraData.cm1}</div>
                            </div>
                          )}
                          {report.extraData?.cm2 && (
                            <div>
                              <div className="text-xs text-muted-foreground mb-1">CM 2</div>
                              <div className="text-sm font-medium break-words">{report.extraData.cm2}</div>
                            </div>
                          )}
                          {report.extraData?.chiefCabin && (
                            <div className="md:col-span-2">
                              <div className="text-xs text-muted-foreground mb-1">Chief Cabin</div>
                              <div className="text-sm font-medium break-words">{report.extraData.chiefCabin}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {report.description && (
                      <div className="mt-4">
                        <div className="text-xs text-muted-foreground mb-1">Captain report</div>
                        <div className="text-sm leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere bg-muted/50 p-3 rounded">{report.description}</div>
                      </div>
                    )}
                    {report.extraData?.captainComments && (
                      <div className="mt-4">
                        <div className="text-xs text-muted-foreground mb-1">Captain comments</div>
                        <div className="text-sm leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere bg-muted/50 p-3 rounded">{report.extraData.captainComments}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Admin Status Actions */}
            {canUpdateStatus && (
              <Card className="p-6 mb-6 border-l-4 border-l-blue-500">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                  <h3 className="text-lg font-bold">Admin Actions</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  As an administrator, you can approve or reject this report.
                </p>
                <div className="flex flex-wrap gap-3">
                  {report.status === 'submitted' && (
                    <Button
                      onClick={() => updateStatusMutation.mutate('in_review')}
                      disabled={updateStatusMutation.isPending}
                      data-testid="button-move-to-review"
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Clock className="h-4 w-4 mr-2" />
                      Start Review
                    </Button>
                  )}
                  {report.status === 'in_review' && (
                    <>
                      <Button
                        onClick={() => updateStatusMutation.mutate('closed')}
                        disabled={updateStatusMutation.isPending}
                        data-testid="button-close-report"
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Approve & Close
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => updateStatusMutation.mutate('rejected')}
                        disabled={updateStatusMutation.isPending}
                        data-testid="button-reject-report"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Reject Report
                      </Button>
                    </>
                  )}
                  {(report.status === 'closed' || report.status === 'rejected') && (
                    <div className="text-sm text-muted-foreground">
                      This report has been {report.status === 'closed' ? 'approved and closed' : 'rejected'}.
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Comments Section - PDF Style */}
            <div className="bg-card border border-border rounded-lg shadow-sm mb-6">
              <div className="p-6 sm:p-8 space-y-8">
                <div>
                  <div className="bg-muted border border-border rounded-lg px-4 py-3 mb-6">
                    <h3 className="text-base sm:text-lg font-bold text-card-foreground uppercase tracking-wide">
                      Comments {report.comments && report.comments.length > 0 ? `(${report.comments.length})` : ''}
                    </h3>
                  </div>
              
              {/* Add Comment */}
                  <div className="pl-3 mb-8">
                <Textarea
                  placeholder="Add a comment or follow-up..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="mb-4 text-base"
                  rows={4}
                  data-testid="textarea-comment"
                />
                <Button
                  onClick={handleAddComment}
                  disabled={!commentText.trim() || addCommentMutation.isPending}
                  data-testid="button-send-comment"
                      className=""
                >
                  <Send className="h-4 w-4 mr-2" />
                  {addCommentMutation.isPending ? "Posting..." : "Post Comment"}
                </Button>
              </div>

              {/* Comments List */}
              {report.comments && report.comments.length > 0 ? (
                    <div className="pl-3 space-y-5">
                  {report.comments.map((comment) => (
                        <div 
                          key={comment.id} 
                          className="bg-muted/50 border border-border rounded-lg p-5" 
                          data-testid={`comment-${comment.id}`}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <p className="text-base font-bold text-card-foreground">
                              {comment.user?.firstName && comment.user?.lastName
                                ? `${comment.user.firstName} ${comment.user.lastName}`
                                : comment.user?.email || "Unknown User"}
                            </p>
                            {comment.createdAt && (
                              <span className="text-sm text-muted-foreground">
                                {formatDateTimeToDDMMYYYYHHMM(comment.createdAt)}
                              </span>
                            )}
                          </div>
                          <p className="text-base text-card-foreground leading-7 whitespace-pre-wrap">{comment.content}</p>
                    </div>
                  ))}
                </div>
              ) : (
                    <div className="pl-3 text-center py-10">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-base text-muted-foreground">No comments yet. Be the first to comment.</p>
                </div>
              )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <Card className="p-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">Report not found</p>
            <Button asChild data-testid="button-back-to-reports">
              <Link href="/reports">Back to Reports</Link>
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
