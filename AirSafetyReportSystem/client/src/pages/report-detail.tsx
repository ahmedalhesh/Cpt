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
} from "lucide-react";
import { format } from "date-fns";
import type { Report, Comment, User as UserType } from "@shared/schema";

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

  const generatePDF = async () => {
    if (!report) return;

    try {
      const jsPDF = (await import('jspdf')).default;
      const pdf = new jsPDF('p', 'mm', 'a4');
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

      // Helper function to render Arabic text as image using html2canvas
      // maxWidth is in mm, needs to be converted to px for HTML rendering
      const renderArabicTextAsImage = async (text: string, fontSize: number, maxWidth: number): Promise<string | null> => {
        try {
          const html2canvas = (await import('html2canvas')).default;
          
          // Convert mm to px (approximate: 1mm ≈ 3.7795px at 96 DPI)
          const maxWidthPx = maxWidth * 3.7795;
          
          // Create a temporary div with the Arabic text
          const tempDiv = document.createElement('div');
          tempDiv.style.position = 'absolute';
          tempDiv.style.left = '-9999px';
          tempDiv.style.top = '-9999px';
          tempDiv.style.width = `${maxWidthPx}px`;
          tempDiv.style.fontSize = `${fontSize * 1.333}px`; // Convert pt to px (1pt = 1.333px)
          tempDiv.style.fontFamily = 'Inter, Arial, sans-serif';
          tempDiv.style.color = '#000000';
          tempDiv.style.backgroundColor = '#ffffff';
          tempDiv.style.padding = '10px';
          tempDiv.style.lineHeight = '1.5';
          tempDiv.style.whiteSpace = 'pre-wrap';
          tempDiv.style.direction = 'rtl';
          tempDiv.style.textAlign = 'right';
          tempDiv.textContent = text;
          
          document.body.appendChild(tempDiv);
          
          const canvas = await html2canvas(tempDiv, {
            backgroundColor: '#ffffff',
            scale: 2,
            useCORS: true,
          });
          
          document.body.removeChild(tempDiv);
          
          return canvas.toDataURL('image/png');
        } catch (error) {
          console.error('Error rendering Arabic text:', error);
          return null;
        }
      };

      // Helper function to add text with word wrap (black/white only)
      // Supports Arabic via html2canvas
      const addText = async (text: string, fontSize: number, isBold: boolean = false): Promise<number> => {
        // Check if text contains Arabic characters
        if (hasArabicChars(text)) {
          // Render Arabic text as image
          const imageData = await renderArabicTextAsImage(text, fontSize, contentWidth);
          if (imageData) {
            try {
              // Calculate image dimensions
              const img = new Image();
              await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = imageData;
              });
              
              const imgWidth = contentWidth;
              const imgHeight = (img.height / img.width) * imgWidth;
              
              checkNewPage(imgHeight + 5);
              
              pdf.addImage(imageData, 'PNG', margin, yPosition, imgWidth, imgHeight);
              yPosition += imgHeight + 3;
              
              return imgHeight;
            } catch (error) {
              console.error('Error adding Arabic text image:', error);
              // Fall through to regular text rendering
            }
          }
        }
        
        // Regular text rendering for non-Arabic or if image rendering failed
        pdf.setFontSize(fontSize);
        pdf.setFont('helvetica', isBold ? 'bold' : 'normal');
        pdf.setTextColor(0, 0, 0);
        
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

      // Helper function to add section header (gray background, black text)
      const addSectionHeader = (text: string) => {
        checkNewPage(12);
        pdf.setFillColor(240, 240, 240); // Light gray
        pdf.rect(margin, yPosition, contentWidth, 7, 'F');
        pdf.setDrawColor(200, 200, 200); // Border gray
        pdf.rect(margin, yPosition, contentWidth, 7, 'S');
        
        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.text(text, margin + 2, yPosition + 4.5);
        yPosition += 10;
      };

      // Helper function to add field (clean, no colors)
      // Supports Arabic in value via html2canvas
      const addField = async (label: string, value: string | null | undefined) => {
        if (!value) return;
        
        checkNewPage(10);
        
        // Label (bold) - usually English, so use regular text
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(60, 60, 60); // Dark gray
        pdf.text(label.toUpperCase(), margin, yPosition);
        yPosition += 4;
        
        // Value - check if it contains Arabic
        const valueStr = value.toString();
        if (hasArabicChars(valueStr)) {
          // Render Arabic value as image
          const imageData = await renderArabicTextAsImage(valueStr, 9, contentWidth - 2);
          if (imageData) {
            try {
              const img = new Image();
              await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = imageData;
              });
              
              const imgWidth = contentWidth - 2;
              const imgHeight = (img.height / img.width) * imgWidth;
              
              checkNewPage(imgHeight + 2);
              
              pdf.addImage(imageData, 'PNG', margin + 2, yPosition, imgWidth, imgHeight);
              yPosition += imgHeight + 2;
            } catch (error) {
              console.error('Error adding Arabic field value image:', error);
              // Fall through to regular text rendering
              const lines = pdf.splitTextToSize(valueStr, contentWidth);
              lines.forEach((line: string) => {
                pdf.text(line, margin + 2, yPosition);
                yPosition += 4;
              });
            }
          } else {
            // Fall back to regular text if image rendering fails
            const lines = pdf.splitTextToSize(valueStr, contentWidth);
            lines.forEach((line: string) => {
              pdf.text(line, margin + 2, yPosition);
              yPosition += 4;
            });
          }
        } else {
          // Regular text rendering for non-Arabic
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(0, 0, 0);
          const lines = pdf.splitTextToSize(valueStr, contentWidth);
          lines.forEach((line: string) => {
            pdf.text(line, margin + 2, yPosition);
            yPosition += 4;
          });
        }
        
        yPosition += 2;
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
      pdf.setFont('helvetica', 'bold');
      pdf.text(companySettings?.companyName || 'Report Sys', margin + (companySettings?.logo ? 18 : 0), yPosition + 5);
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`${report.reportType.toUpperCase()} Report`, margin + (companySettings?.logo ? 18 : 0), yPosition + 10);
      
      // Right side: Report ID, Date, Status
      pdf.setFontSize(8);
      pdf.setTextColor(60, 60, 60);
      pdf.text(`Report ID: ${report.id.slice(0, 12)}`, pageWidth - margin, yPosition + 3, { align: 'right' });
      if (report.createdAt) {
        pdf.text(`Date: ${format(new Date(report.createdAt), 'PPP')}`, pageWidth - margin, yPosition + 7, { align: 'right' });
      }
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Status: ${report.status.toUpperCase().replace('_', ' ')}`, pageWidth - margin, yPosition + 11, { align: 'right' });
      
      yPosition += 18;
      
      // Divider line
      pdf.setDrawColor(200, 200, 200);
      pdf.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 8;

      // === BASIC INFORMATION ===
      addSectionHeader('BASIC INFORMATION');
      
      if (!report.isAnonymous) {
        await addField('Submitted By', 
          report.submitter?.firstName && report.submitter?.lastName
            ? `${report.submitter.firstName} ${report.submitter.lastName}`
            : report.submitter?.email || 'Unknown');
      } else {
        await addField('Submitted By', 'Anonymous Report');
      }

      await addField('Flight Number', report.flightNumber);
      await addField('Aircraft Type', report.aircraftType);
      
      // Route - only show if meaningful (not empty or just separator)
      if (report.route && report.route.trim() && report.route.trim() !== '/') {
        await addField('Route', report.route);
      }
      
      // Event Date & Time - only show if valid date and not default (Jan 1, 2000)
      if (report.eventDateTime) {
        try {
          const eventDate = new Date(report.eventDateTime);
          const defaultDate = new Date('2000-01-01T00:00:00');
          if (!isNaN(eventDate.getTime()) && eventDate.getTime() !== defaultDate.getTime()) {
            await addField('Event Date & Time', format(eventDate, 'PPpp'));
          }
        } catch {
          // Invalid date, skip
        }
      }
      
      await addField('Location', report.location);
      await addField('Risk Level', report.riskLevel ? report.riskLevel.charAt(0).toUpperCase() + report.riskLevel.slice(1) : undefined);

      // === DESCRIPTION ===
      // Only show if meaningful content (not just "Standard: UTC" or whitespace)
      if (report.description) {
        const desc = report.description.trim();
        if (desc && desc !== 'Standard: UTC' && desc.length > 3) {
          addSectionHeader('DESCRIPTION');
          await addText(report.description, 9);
        }
      }

      // === CONTRIBUTING FACTORS ===
      if (report.contributingFactors) {
        addSectionHeader('CONTRIBUTING FACTORS');
        await addText(report.contributingFactors, 9);
      }

      // === CORRECTIVE ACTIONS ===
      if (report.correctiveActions) {
        addSectionHeader('CORRECTIVE ACTIONS');
        await addText(report.correctiveActions, 9);
      }

      // === ASR PLOTS (Side by side in one page) ===
      // Only show if there are images or meaningful data (not all default/zero values)
      const hasImages = !!report.planImage || !!report.elevImage;
      const hasPlanData = typeof report.planGridX === 'number' && typeof report.planGridY === 'number';
      const planIsMeaningful = hasPlanData && (
        report.planGridX !== 0 || 
        report.planGridY !== 0 || 
        (report.planDistanceX !== undefined && report.planDistanceX !== 0) ||
        (report.planDistanceY !== undefined && report.planDistanceY !== 0)
      );
      const centerCol = 14; // COLS / 2 - 1
      const centerRow = 10; // ROWS / 2 - 1
      const hasElevData = typeof report.elevGridCol === 'number' && typeof report.elevGridRow === 'number';
      const elevIsMeaningful = hasElevData && (
        report.elevGridCol !== centerCol || 
        report.elevGridRow !== centerRow || 
        (report.elevDistanceHorizM !== undefined && report.elevDistanceHorizM !== 0) ||
        (report.elevDistanceVertFt !== undefined && report.elevDistanceVertFt !== 0)
      );
      
      if (hasImages || planIsMeaningful || elevIsMeaningful) {
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

      // === REPORT TYPE SPECIFIC DATA ===
      
      // NCR Details
      if (report.reportType === 'ncr' && report.extraData) {
        addSectionHeader('NON-CONFORMANCE REPORT (NCR) DETAILS');
        
        // Basic Information
        await addField('Date', report.extraData.date);
        await addField('Flight Date', report.extraData.flightDate);
        await addField('Flight Number', report.extraData.flightNumber);
        await addField('Aircraft Type', report.extraData.aircraftType);
        await addField('Aircraft Registration', report.extraData.aircraftReg);
        await addField('Captain Name', report.extraData.captainName);
        await addField('First Officer Name', report.extraData.foName);
        
        // Sources of Nonconformance
        const sources: string[] = [];
        if (report.extraData.srcSurvey) sources.push('Customer Satisfaction Surveys');
        if (report.extraData.srcCustomerComplaint) sources.push('Customer Complaint');
        if (report.extraData.srcPilotObservation) sources.push('Pilot Monitoring Observations');
        if (report.extraData.srcMaintenanceOfficer) sources.push('Maintenance Officer');
        if (report.extraData.srcOtherMonitoring) sources.push('Other Monitoring Activities');
        if (report.extraData.srcInternalAudit) sources.push('Internal Audit');
        if (report.extraData.srcOpsTax) sources.push('Operations Tax Performance');
        if (report.extraData.srcOtherText) sources.push(`Other: ${report.extraData.srcOtherText}`);
        if (sources.length > 0) {
          await addField('Sources of Nonconformance', sources.join(', '));
        }
        
        // Type of Nonconformance
        const types: string[] = [];
        if (report.extraData.nonconform_service) types.push('Service');
        if (report.extraData.nonconform_safety) types.push('Affects Safety');
        if (report.extraData.nonconform_security) types.push('Affects Security');
        if (types.length > 0) {
          await addField('Type of Nonconformance', types.join(', '));
        }
        
        // Nonconformance Details
        if (report.extraData.nonconformDetails) {
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(0, 0, 0);
          pdf.text('NONCONFORMANCE DETAILS', margin, yPosition);
          yPosition += 5;
          await addText(report.extraData.nonconformDetails, 9);
        }
        
        // Recommendations
        if (report.extraData.recommendationFix) {
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(0, 0, 0);
          pdf.text('RECOMMENDATION - CORRECTIVE ACTION', margin, yPosition);
          yPosition += 5;
          await addText(report.extraData.recommendationFix, 9);
        }
        
        if (report.extraData.recommendationAction) {
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(0, 0, 0);
          pdf.text('RECOMMENDATION - PREVENTIVE ACTION', margin, yPosition);
          yPosition += 5;
          await addText(report.extraData.recommendationAction, 9);
        }
        
        // Discoverer Information
        if (report.extraData.discovererName || report.extraData.discovererTitle || report.extraData.discovererDate) {
          await addField('Discoverer Name', report.extraData.discovererName);
          await addField('Discoverer Title', report.extraData.discovererTitle);
          await addField('Discoverer Date', report.extraData.discovererDate);
        }
        
        // Root Cause Analysis
        if (report.extraData.rootCauseAnalysis) {
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(0, 0, 0);
          pdf.text('ROOT CAUSE ANALYSIS', margin, yPosition);
          yPosition += 5;
          await addText(report.extraData.rootCauseAnalysis, 9);
        }
        if (report.extraData.analystName || report.extraData.analystTitle || report.extraData.analystDate) {
          await addField('Analyst Name', report.extraData.analystName);
          await addField('Analyst Title', report.extraData.analystTitle);
          await addField('Analyst Date', report.extraData.analystDate);
        }
        
        // Direct Manager Report
        if (report.extraData.directManagerNotes) {
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(0, 0, 0);
          pdf.text('DIRECT MANAGER NOTES', margin, yPosition);
          yPosition += 5;
          await addText(report.extraData.directManagerNotes, 9);
        }
        if (report.extraData.needsCorrection) {
          await addField('Needs Correction', report.extraData.needsCorrection === 'yes' ? 'Yes' : 'No');
        }
        if (report.extraData.correctionDetails) {
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(0, 0, 0);
          pdf.text('CORRECTION DETAILS', margin, yPosition);
          yPosition += 5;
          await addText(report.extraData.correctionDetails, 9);
        }
        await addField('Correction Due Date', report.extraData.correctionDueDate);
        await addField('Person Assigned Name', report.extraData.personAssignedName);
        await addField('Person Assigned Title', report.extraData.personAssignedTitle);
        
        // Proposal Notes
        if (report.extraData.proposalApprove) {
          await addField('Proposal Approval', report.extraData.proposalApprove === 'yes' ? 'Approved' : 'Not Approved');
        }
        if (report.extraData.proposalNotes) {
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(0, 0, 0);
          pdf.text('PROPOSAL NOTES', margin, yPosition);
          yPosition += 5;
          await addText(report.extraData.proposalNotes, 9);
        }
        await addField('Proposal Signer Name', report.extraData.proposalSignerName);
        await addField('Proposal Signer Title', report.extraData.proposalSignerTitle);
        await addField('Proposal Signer Date', report.extraData.proposalSignerDate);
        
        // Correction Results
        if (report.extraData.correctionResultDetails) {
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(0, 0, 0);
          pdf.text('CORRECTION RESULTS', margin, yPosition);
          yPosition += 5;
          await addText(report.extraData.correctionResultDetails, 9);
        }
        await addField('Correction Responsible Date', report.extraData.correctionResponsibleDate);
        
        // Follow-up Results
        if (report.extraData.followupResult) {
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(0, 0, 0);
          pdf.text('FOLLOW-UP RESULTS', margin, yPosition);
          yPosition += 5;
          await addText(report.extraData.followupResult, 9);
        }
        await addField('Follow-up Date', report.extraData.followupDate);
        if (report.extraData.reportClosureNotes) {
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(0, 0, 0);
          pdf.text('REPORT CLOSURE NOTES', margin, yPosition);
          yPosition += 5;
          await addText(report.extraData.reportClosureNotes, 9);
        }
        await addField('Closure Date', report.extraData.closureDate);
      }

      // OR Details
      if (report.reportType === 'or' && report.extraData) {
        addSectionHeader('OCCURRENCE REPORT (OR) DETAILS');
        
        await addField('Type of Occurrence', report.extraData.typeOfOccurrence);
        await addField('Date / Time', 
          report.extraData.occDate || report.extraData.occTime 
            ? `${report.extraData.occDate || '—'} ${report.extraData.occTime || ''}`.trim()
            : undefined);
        await addField('Location', report.extraData.occLocation);
        
        if (report.extraData.staffInvolved) {
          await addField('Staff Involved', report.extraData.staffInvolved);
        }
        if (report.extraData.details) {
          await addField('Details', report.extraData.details);
        }
        if (report.extraData.damageExtent) {
          await addField('Damage/Injury', report.extraData.damageExtent);
        }
        if (report.extraData.rectification) {
          await addField('Rectification', report.extraData.rectification);
        }
        if (report.extraData.remarks) {
          await addField('Remarks', report.extraData.remarks);
        }
      }

      // CDF Details
      if (report.reportType === 'cdf' && report.extraData) {
        addSectionHeader('COMMANDER\'S DISCRETION (CDF) DETAILS');
        
        if (report.extraData.type) {
          await addField('Type', report.extraData.type === 'extension' ? 'Extension of FDP/FH' : 'Reduction of Rest');
        }
        if (report.extraData.remarksActionTaken) {
          await addField('Remarks / Action Taken', report.extraData.remarksActionTaken);
        }
      }

      // CHR Details
      if (report.reportType === 'chr' && report.extraData) {
        addSectionHeader('CONFIDENTIAL HAZARD REPORT (CHR) DETAILS');
        
        if (report.extraData.hazardDescription) {
          await addField('Hazard Description', report.extraData.hazardDescription);
        }
        if (report.extraData.recommendations) {
          await addField('Recommendations', report.extraData.recommendations);
        }
        if (report.extraData.followUpActionTaken) {
          await addField('Follow-Up Action Taken', report.extraData.followUpActionTaken);
        }
      }

      // RIR Details
      if (report.reportType === 'rir' && report.extraData) {
        addSectionHeader('RAMP INCIDENT REPORT (RIR) DETAILS');
        
        if (report.extraData.incidentTitle) {
          await addField('Incident Title', report.extraData.incidentTitle);
        }
        if (report.extraData.typeOfOccurrence) {
          await addField('Type of Occurrence', report.extraData.typeOfOccurrence);
        }
        if (report.extraData.remarks) {
          await addField('Remarks', report.extraData.remarks);
        }
      }

      // === COMMENTS ===
      if (report.comments && report.comments.length > 0) {
        addSectionHeader(`COMMENTS (${report.comments.length})`);
        
        report.comments.forEach((comment, index) => {
          checkNewPage(20);
          
          // Light gray background for comment box
          pdf.setFillColor(248, 248, 248);
          pdf.setDrawColor(220, 220, 220);
          pdf.rect(margin, yPosition, contentWidth, 15, 'FD');
          
          pdf.setFontSize(8);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(0, 0, 0);
          const userName = comment.user?.firstName && comment.user?.lastName
            ? `${comment.user.firstName} ${comment.user.lastName}`
            : comment.user?.email || 'Unknown';
          pdf.text(userName, margin + 2, yPosition + 5);
          
          if (comment.createdAt) {
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(100, 100, 100);
            pdf.text(format(new Date(comment.createdAt), 'PPp'), pageWidth - margin - 40, yPosition + 5);
          }
          
          pdf.setFontSize(9);
          pdf.setTextColor(0, 0, 0);
          const commentLines = pdf.splitTextToSize(comment.content, contentWidth - 6);
          commentLines.forEach((line: string, lineIndex: number) => {
            pdf.text(line, margin + 2, yPosition + 10 + (lineIndex * 4));
          });
          
          yPosition += Math.max(15, commentLines.length * 4 + 8);
        });
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
        pdf.text(`Generated on ${format(new Date(), 'PPpp')}`, margin, pageHeight - 8);
        
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

      // Save PDF
      const fileName = `${report.reportType.toUpperCase()}-Report-${report.id.slice(0, 8)}.pdf`;
      pdf.save(fileName);
      
      toast({
        title: "PDF Generated",
        description: "Report has been exported as PDF successfully.",
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Error",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (authLoading || !isAuthenticated) {
    return null;
  }

  const canUpdateStatus = user?.role === 'admin';

  return (
    <div className="flex-1 overflow-auto">
      <div className="container max-w-5xl mx-auto p-6 lg:p-8">

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
                        {report.reportType.toUpperCase()} Report
                      </p>
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground space-y-1">
                    <p className="font-mono">Report ID: {report.id.slice(0, 12)}</p>
                    {report.createdAt && (
                      <p>Date: {format(new Date(report.createdAt), 'PPP')}</p>
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
                  <Button
                    onClick={() => generatePDF()}
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export PDF
                  </Button>
                </div>
              </div>
            </div>

            {/* Report Details - PDF Style */}
            <div className="bg-card border border-border rounded-lg shadow-sm mb-6">
              <div className="p-6 space-y-6" id="report-content">
                {/* Basic Information Section */}
                <div>
                  <div className="bg-muted border border-border rounded px-3 py-2 mb-4">
                    <h3 className="text-xs font-bold text-card-foreground uppercase tracking-wide">BASIC INFORMATION</h3>
                </div>
                  <div className="space-y-4 pl-2">
                    {!report.isAnonymous && (
                      <div>
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide block mb-1">
                          SUBMITTED BY
                        </label>
                        <p className="text-sm text-card-foreground">
                      {report.submitter?.firstName && report.submitter?.lastName
                        ? `${report.submitter.firstName} ${report.submitter.lastName}`
                        : report.submitter?.email || "Unknown"}
                        </p>
                      </div>
                    )}
                    
                    {report.isAnonymous === 1 && (
                      <div>
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide block mb-1">
                          SUBMITTED BY
                        </label>
                        <p className="text-sm text-card-foreground">Anonymous Report</p>
                </div>
                    )}

                {report.flightNumber && (
                  <div>
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide block mb-1">
                          FLIGHT NUMBER
                        </label>
                        <p className="text-sm text-card-foreground font-mono">{report.flightNumber}</p>
                  </div>
                )}

                {report.aircraftType && (
                  <div>
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide block mb-1">
                          AIRCRAFT TYPE
                        </label>
                        <p className="text-sm text-card-foreground">{report.aircraftType}</p>
                  </div>
                )}

                    {/* Route - only show if not empty or just separator */}
                    {report.route && report.route.trim() && report.route.trim() !== '/' && (
                  <div>
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide block mb-1">
                          ROUTE
                        </label>
                        <p className="text-sm text-card-foreground">{report.route}</p>
                  </div>
                )}

                    {/* Event Date & Time - only show if valid date and not default (Jan 1, 2000) */}
                    {report.eventDateTime && (() => {
                      try {
                        const eventDate = new Date(report.eventDateTime);
                        const defaultDate = new Date('2000-01-01T00:00:00');
                        if (!isNaN(eventDate.getTime()) && eventDate.getTime() !== defaultDate.getTime()) {
                          return (
                  <div>
                              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide block mb-1">
                                EVENT DATE & TIME
                              </label>
                              <p className="text-sm text-card-foreground">{format(eventDate, 'PPpp')}</p>
                            </div>
                          );
                        }
                      } catch {
                        // Invalid date, don't show
                      }
                      return null;
                    })()}

                    {report.location && (
                      <div>
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide block mb-1">
                          LOCATION
                        </label>
                        <p className="text-sm text-card-foreground">{report.location}</p>
                  </div>
                )}

                    {report.riskLevel && (
                <div>
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide block mb-1">
                          RISK LEVEL
                        </label>
                        <p className="text-sm text-card-foreground capitalize">{report.riskLevel}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Description Section */}
                {report.description && (() => {
                  const desc = report.description.trim();
                  if (desc && desc !== 'Standard: UTC' && desc.length > 3) {
                    return (
                      <div>
                        <div className="bg-muted border border-border rounded px-3 py-2 mb-4">
                          <h3 className="text-xs font-bold text-card-foreground uppercase tracking-wide">DESCRIPTION</h3>
                        </div>
                        <div className="pl-2">
                          <p className="text-sm text-card-foreground leading-relaxed whitespace-pre-wrap">{report.description}</p>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Contributing Factors Section */}
                {report.contributingFactors && (
                  <div>
                    <div className="bg-muted border border-border rounded px-3 py-2 mb-4">
                      <h3 className="text-xs font-bold text-card-foreground uppercase tracking-wide">CONTRIBUTING FACTORS</h3>
                    </div>
                    <div className="pl-2">
                      <p className="text-sm text-card-foreground leading-relaxed whitespace-pre-wrap">{report.contributingFactors}</p>
                    </div>
                  </div>
                )}

                {/* Corrective Actions Section */}
                {report.correctiveActions && (
                  <div>
                    <div className="bg-muted border border-border rounded px-3 py-2 mb-4">
                      <h3 className="text-xs font-bold text-card-foreground uppercase tracking-wide">CORRECTIVE ACTIONS</h3>
                    </div>
                    <div className="pl-2">
                      <p className="text-sm text-card-foreground leading-relaxed whitespace-pre-wrap">{report.correctiveActions}</p>
                    </div>
                  </div>
                )}

                {/* ASR Plots - Only show if there are images or meaningful data (not all default/zero values) */}
                {(() => {
                  // Check if there are actual images
                  const hasImages = !!report.planImage || !!report.elevImage;
                  
                  // Check if plan view has meaningful data (not all zeros/center)
                  const hasPlanData = typeof report.planGridX === 'number' && typeof report.planGridY === 'number';
                  const planIsMeaningful = hasPlanData && (
                    report.planGridX !== 0 || 
                    report.planGridY !== 0 || 
                    (report.planDistanceX !== undefined && report.planDistanceX !== 0) ||
                    (report.planDistanceY !== undefined && report.planDistanceY !== 0)
                  );
                  
                  // Check if elevation view has meaningful data (not all zeros/center)
                  const centerCol = 14; // COLS / 2 - 1 = 29/2 - 1 = 14
                  const centerRow = 10; // ROWS / 2 - 1 = 21/2 - 1 = 10
                  const hasElevData = typeof report.elevGridCol === 'number' && typeof report.elevGridRow === 'number';
                  const elevIsMeaningful = hasElevData && (
                    report.elevGridCol !== centerCol || 
                    report.elevGridRow !== centerRow || 
                    (report.elevDistanceHorizM !== undefined && report.elevDistanceHorizM !== 0) ||
                    (report.elevDistanceVertFt !== undefined && report.elevDistanceVertFt !== 0)
                  );
                  
                  // Show only if there are images OR meaningful data
                  return hasImages || planIsMeaningful || elevIsMeaningful;
                })() && (
                  <div>
                    <div className="bg-muted border border-border rounded px-3 py-2 mb-4">
                      <h3 className="text-xs font-bold text-card-foreground uppercase tracking-wide">ASR PLOTS</h3>
                  </div>
                    <div className="pl-2">
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6 mt-2">
                      {/* VIEW FROM ABOVE */}
                      {(report.planImage || report.planGridX !== undefined) && (
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
                      
                      {/* VIEW FROM ASTERN */}
                      {(report.elevImage || report.elevGridCol !== undefined) && (
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
                                      Selected grid: row={rSel ?? '-'}, col={cSel ?? '-'} · Distances: H={report.elevDistanceHorizM ?? '-'}m, V={report.elevDistanceVertFt ?? '-'}ft
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

                {/* NCR Arabic Details */}
                {report.reportType === 'ncr' && report.extraData && (
                  <div>
                    <div className="bg-muted border border-border rounded px-3 py-2 mb-4">
                      <h3 className="text-xs font-bold text-card-foreground uppercase tracking-wide">NON-CONFORMANCE REPORT (NCR) DETAILS</h3>
                    </div>
                    <div dir="rtl" className="pl-2 space-y-6">
                    
                    {/* المعلومات العامة */}
                    {(report.extraData.date || report.extraData.flightDate || report.extraData.flightNumber || report.extraData.aircraftType || report.extraData.aircraftReg || report.extraData.captainName || report.extraData.foName) && (
                  <div>
                        <div className="text-xs font-semibold text-muted-foreground mb-2">المعلومات العامة</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-right">
                          {report.extraData.date && (
                            <div>
                              <div className="text-xs text-muted-foreground">التاريخ</div>
                              <div className="text-sm font-medium">{report.extraData.date}</div>
                            </div>
                          )}
                          {report.extraData.flightDate && (
                            <div>
                              <div className="text-xs text-muted-foreground">تاريخ الرحلة</div>
                              <div className="text-sm font-medium">{report.extraData.flightDate}</div>
                            </div>
                          )}
                          {report.extraData.flightNumber && (
                            <div>
                              <div className="text-xs text-muted-foreground">رقم الرحلة</div>
                              <div className="text-sm font-medium">{report.extraData.flightNumber}</div>
                            </div>
                          )}
                          {report.extraData.aircraftType && (
                            <div>
                              <div className="text-xs text-muted-foreground">نوع الطائرة</div>
                              <div className="text-sm font-medium">{report.extraData.aircraftType}</div>
                            </div>
                          )}
                          {report.extraData.aircraftReg && (
                            <div>
                              <div className="text-xs text-muted-foreground">تسجيل الطائرة</div>
                              <div className="text-sm font-medium">{report.extraData.aircraftReg}</div>
                            </div>
                          )}
                          {report.extraData.captainName && (
                            <div>
                              <div className="text-xs text-muted-foreground">اسم قائد الطائرة</div>
                              <div className="text-sm font-medium">{report.extraData.captainName}</div>
                            </div>
                          )}
                          {report.extraData.foName && (
                            <div>
                              <div className="text-xs text-muted-foreground">اسم مساعد قائد الطائرة</div>
                              <div className="text-sm font-medium">{report.extraData.foName}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* مصادر عدم المطابقة */}
                    {(report.extraData.srcSurvey || report.extraData.srcCustomerComplaint || report.extraData.srcPilotObservation || report.extraData.srcMaintenanceOfficer || report.extraData.srcOtherMonitoring || report.extraData.srcInternalAudit || report.extraData.srcOpsTax || report.extraData.srcOtherText) && (
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground mb-2">مصادر عدم المطابقة</div>
                        <div className="flex flex-wrap gap-3 text-sm">
                          {report.extraData.srcSurvey && <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 rounded">استبيانات مسح رضى العملاء</span>}
                          {report.extraData.srcCustomerComplaint && <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 rounded">شكوى عميل</span>}
                          {report.extraData.srcPilotObservation && <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 rounded">ملاحظات مراقبة من الطيار</span>}
                          {report.extraData.srcMaintenanceOfficer && <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 rounded">ضابط الصيانة</span>}
                          {report.extraData.srcOtherMonitoring && <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 rounded">نشاطات مراقبة أخرى</span>}
                          {report.extraData.srcInternalAudit && <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 rounded">الفحص الداخلي</span>}
                          {report.extraData.srcOpsTax && <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 rounded">أداء ضريبة العمليات</span>}
                          {report.extraData.srcOtherText && <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 rounded">آخر: {report.extraData.srcOtherText}</span>}
                        </div>
                      </div>
                    )}

                    {/* نوع عدم المطابقة */}
                    {(report.extraData.nonconform_service || report.extraData.nonconform_safety || report.extraData.nonconform_security) && (
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground mb-2">نوع عدم المطابقة</div>
                        <div className="flex flex-wrap gap-3 text-sm">
                          {report.extraData.nonconform_service && <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900 rounded">الخدمية</span>}
                          {report.extraData.nonconform_safety && <span className="px-2 py-1 bg-red-100 dark:bg-red-900 rounded">تؤثر على السلامة</span>}
                          {report.extraData.nonconform_security && <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900 rounded">تؤثر على الأمن</span>}
                        </div>
                      </div>
                    )}

                    {/* تفاصيل عدم المطابقة */}
                    {report.extraData.nonconformDetails && (
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground mb-2">تفاصيل عدم المطابقة</div>
                        <div className="text-sm leading-relaxed whitespace-pre-wrap bg-muted/50 p-3 rounded">{report.extraData.nonconformDetails}</div>
                      </div>
                    )}

                    {/* التوصيات */}
                    {(report.extraData.recommendationFix || report.extraData.recommendationAction) && (
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground mb-2">التوصيات</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {report.extraData.recommendationFix && (
                            <div>
                              <div className="text-xs text-muted-foreground mb-1">التوصية بخصوص التصحيح اللازم</div>
                              <div className="text-sm leading-relaxed whitespace-pre-wrap bg-muted/50 p-3 rounded">{report.extraData.recommendationFix}</div>
                            </div>
                          )}
                          {report.extraData.recommendationAction && (
                            <div>
                              <div className="text-xs text-muted-foreground mb-1">التوصية بخصوص الإجراء التصحيحي</div>
                              <div className="text-sm leading-relaxed whitespace-pre-wrap bg-muted/50 p-3 rounded">{report.extraData.recommendationAction}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* معلومات المكتشف */}
                    {(report.extraData.discovererName || report.extraData.discovererTitle || report.extraData.discovererDate) && (
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground mb-2">معلومات مكتشف عدم المطابقة</div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {report.extraData.discovererName && (
                            <div>
                              <div className="text-xs text-muted-foreground">الاسم</div>
                              <div className="text-sm font-medium">{report.extraData.discovererName}</div>
                            </div>
                          )}
                          {report.extraData.discovererTitle && (
                            <div>
                              <div className="text-xs text-muted-foreground">الوظيفة</div>
                              <div className="text-sm font-medium">{report.extraData.discovererTitle}</div>
                            </div>
                          )}
                          {report.extraData.discovererDate && (
                            <div>
                              <div className="text-xs text-muted-foreground">التاريخ</div>
                              <div className="text-sm font-medium">{report.extraData.discovererDate}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* تحليل الأسباب الرئيسية */}
                    {(report.extraData.rootCauseAnalysis || report.extraData.analystName || report.extraData.analystTitle || report.extraData.analystDate) && (
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground mb-2">تحليل الأسباب الرئيسية</div>
                        {report.extraData.rootCauseAnalysis && (
                          <div className="text-sm leading-relaxed whitespace-pre-wrap bg-muted/50 p-3 rounded mb-3">{report.extraData.rootCauseAnalysis}</div>
                        )}
                        {(report.extraData.analystName || report.extraData.analystTitle || report.extraData.analystDate) && (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {report.extraData.analystName && (
                              <div>
                                <div className="text-xs text-muted-foreground">الاسم</div>
                                <div className="text-sm font-medium">{report.extraData.analystName}</div>
                              </div>
                            )}
                            {report.extraData.analystTitle && (
                              <div>
                                <div className="text-xs text-muted-foreground">الوظيفة</div>
                                <div className="text-sm font-medium">{report.extraData.analystTitle}</div>
                              </div>
                            )}
                            {report.extraData.analystDate && (
                              <div>
                                <div className="text-xs text-muted-foreground">التاريخ</div>
                                <div className="text-sm font-medium">{report.extraData.analystDate}</div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* تقرير المدير المباشر */}
                    {(report.extraData.directManagerNotes || report.extraData.needsCorrection || report.extraData.correctionDetails || report.extraData.correctionDueDate || report.extraData.personAssignedName || report.extraData.personAssignedTitle) && (
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground mb-2">تقرير المسؤول المباشر</div>
                        {report.extraData.directManagerNotes && (
                          <div className="text-sm leading-relaxed whitespace-pre-wrap bg-muted/50 p-3 rounded mb-3">{report.extraData.directManagerNotes}</div>
                        )}
                        {report.extraData.needsCorrection && (
                          <div className="mb-3">
                            <div className="text-xs text-muted-foreground mb-1">هل تحتاج إلى تصحيح؟</div>
                            <div className="text-sm font-medium">{report.extraData.needsCorrection === 'yes' ? 'نعم - الحالة تحتاج إلى تصحيح' : 'لا - الحالة لا تحتاج إلى تصحيح'}</div>
                          </div>
                        )}
                        {report.extraData.correctionDetails && (
                          <div className="mb-3">
                            <div className="text-xs text-muted-foreground mb-1">تفاصيل التصحيح</div>
                            <div className="text-sm leading-relaxed whitespace-pre-wrap bg-muted/50 p-3 rounded">{report.extraData.correctionDetails}</div>
                          </div>
                        )}
                        {(report.extraData.correctionDueDate || report.extraData.personAssignedName || report.extraData.personAssignedTitle) && (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {report.extraData.correctionDueDate && (
                              <div>
                                <div className="text-xs text-muted-foreground">تاريخ إنهاء التصحيح</div>
                                <div className="text-sm font-medium">{report.extraData.correctionDueDate}</div>
                              </div>
                            )}
                            {report.extraData.personAssignedName && (
                              <div>
                                <div className="text-xs text-muted-foreground">اسم الشخص المُسند</div>
                                <div className="text-sm font-medium">{report.extraData.personAssignedName}</div>
                              </div>
                            )}
                            {report.extraData.personAssignedTitle && (
                              <div>
                                <div className="text-xs text-muted-foreground">وظيفته</div>
                                <div className="text-sm font-medium">{report.extraData.personAssignedTitle}</div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* الملاحظات على الإجراء التصحيحي المقترح */}
                    {(report.extraData.proposalNotes || report.extraData.proposalApprove || report.extraData.proposalSignerName || report.extraData.proposalSignerTitle || report.extraData.proposalSignerDate) && (
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground mb-2">الملاحظات على الإجراء التصحيحي المقترح</div>
                        {report.extraData.proposalApprove && (
                          <div className="mb-3">
                            <div className="text-xs text-muted-foreground mb-1">الموافقة على الإجراء التصحيحي</div>
                            <div className="text-sm font-medium">{report.extraData.proposalApprove === 'yes' ? 'موافق - أُقِرَ القيام بإجراء تصحيحي' : 'غير موافق - لم يُقَر القيام بإجراء تصحيحي'}</div>
                          </div>
                        )}
                        {report.extraData.proposalNotes && (
                          <div className="mb-3">
                            <div className="text-xs text-muted-foreground mb-1">ملاحظات المسؤول المباشر</div>
                            <div className="text-sm leading-relaxed whitespace-pre-wrap bg-muted/50 p-3 rounded">{report.extraData.proposalNotes}</div>
                          </div>
                        )}
                        {(report.extraData.proposalSignerName || report.extraData.proposalSignerTitle || report.extraData.proposalSignerDate) && (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {report.extraData.proposalSignerName && (
                              <div>
                                <div className="text-xs text-muted-foreground">اسم الموقع</div>
                                <div className="text-sm font-medium">{report.extraData.proposalSignerName}</div>
                              </div>
                            )}
                            {report.extraData.proposalSignerTitle && (
                              <div>
                                <div className="text-xs text-muted-foreground">وظيفته</div>
                                <div className="text-sm font-medium">{report.extraData.proposalSignerTitle}</div>
                              </div>
                            )}
                            {report.extraData.proposalSignerDate && (
                              <div>
                                <div className="text-xs text-muted-foreground">التاريخ</div>
                                <div className="text-sm font-medium">{report.extraData.proposalSignerDate}</div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* نتائج التصحيح */}
                    {(report.extraData.correctionResultDetails || report.extraData.correctionResponsibleDate) && (
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground mb-2">نتائج التصحيح</div>
                        {report.extraData.correctionResultDetails && (
                          <div className="text-sm leading-relaxed whitespace-pre-wrap bg-muted/50 p-3 rounded mb-3">{report.extraData.correctionResultDetails}</div>
                        )}
                        {report.extraData.correctionResponsibleDate && (
                          <div>
                            <div className="text-xs text-muted-foreground">تاريخ المسؤولية</div>
                            <div className="text-sm font-medium">{report.extraData.correctionResponsibleDate}</div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* نتائج المتابعة وإغلاق التقرير */}
                    {(report.extraData.followupResult || report.extraData.followupDate || report.extraData.reportClosureNotes || report.extraData.closureDate) && (
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground mb-2">نتائج المتابعة وإغلاق التقرير</div>
                        {report.extraData.followupResult && (
                          <div className="mb-3">
                            <div className="text-xs text-muted-foreground mb-1">نتائج المتابعة</div>
                            <div className="text-sm leading-relaxed whitespace-pre-wrap bg-muted/50 p-3 rounded">{report.extraData.followupResult}</div>
                          </div>
                        )}
                        {report.extraData.followupDate && (
                          <div className="mb-3">
                            <div className="text-xs text-muted-foreground">تاريخ المتابعة</div>
                            <div className="text-sm font-medium">{report.extraData.followupDate}</div>
                          </div>
                        )}
                        {report.extraData.reportClosureNotes && (
                          <div className="mb-3">
                            <div className="text-xs text-muted-foreground mb-1">إغلاق التقرير</div>
                            <div className="text-sm leading-relaxed whitespace-pre-wrap bg-muted/50 p-3 rounded">{report.extraData.reportClosureNotes}</div>
                          </div>
                        )}
                        {report.extraData.closureDate && (
                          <div>
                            <div className="text-xs text-muted-foreground">تاريخ الإغلاق</div>
                            <div className="text-sm font-medium">{report.extraData.closureDate}</div>
                          </div>
                        )}
                      </div>
                    )}
                    </div>
                  </div>
                )}

                {/* OR Details */}
                {report.reportType === 'or' && report.extraData && (
                  <div>
                    <div className="bg-muted border border-border rounded px-3 py-2 mb-4">
                      <h3 className="text-xs font-bold text-card-foreground uppercase tracking-wide">OCCURRENCE REPORT (OR) DETAILS</h3>
                    </div>
                    <div className="pl-2 space-y-4">
                      {report.extraData.typeOfOccurrence && (
                        <div>
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide block mb-1">TYPE OF OCCURRENCE</label>
                          <p className="text-sm text-card-foreground">{report.extraData.typeOfOccurrence}</p>
                        </div>
                      )}
                      {(report.extraData.occDate || report.extraData.occTime) && (
                        <div>
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide block mb-1">DATE / TIME</label>
                          <p className="text-sm text-card-foreground">{report.extraData.occDate || '—'} {report.extraData.occTime || ''}</p>
                        </div>
                      )}
                      {report.extraData.occLocation && (
                        <div>
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide block mb-1">LOCATION</label>
                          <p className="text-sm text-card-foreground">{report.extraData.occLocation}</p>
                        </div>
                      )}
                      {report.extraData.staffInvolved && (
                        <div>
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide block mb-1">STAFF INVOLVED</label>
                          <p className="text-sm text-card-foreground leading-relaxed whitespace-pre-wrap">{report.extraData.staffInvolved}</p>
                        </div>
                      )}
                      {report.extraData.details && (
                        <div>
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide block mb-1">DETAILS</label>
                          <p className="text-sm text-card-foreground leading-relaxed whitespace-pre-wrap">{report.extraData.details}</p>
                        </div>
                      )}
                      {report.extraData.damageExtent && (
                        <div>
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide block mb-1">DAMAGE/INJURY</label>
                          <p className="text-sm text-card-foreground leading-relaxed whitespace-pre-wrap">{report.extraData.damageExtent}</p>
                        </div>
                      )}
                      {report.extraData.rectification && (
                        <div>
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide block mb-1">RECTIFICATION</label>
                          <p className="text-sm text-card-foreground leading-relaxed whitespace-pre-wrap">{report.extraData.rectification}</p>
                        </div>
                      )}
                      {report.extraData.remarks && (
                        <div>
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide block mb-1">REMARKS</label>
                          <p className="text-sm text-card-foreground leading-relaxed whitespace-pre-wrap">{report.extraData.remarks}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* CDF Details */}
                {report.reportType === 'cdf' && report.extraData && (
                  <div>
                    <div className="bg-muted border border-border rounded px-3 py-2 mb-4">
                      <h3 className="text-xs font-bold text-card-foreground uppercase tracking-wide">COMMANDER'S DISCRETION (CDF) DETAILS</h3>
                    </div>
                    <div className="pl-2 space-y-4">
                      {report.extraData.type && (
                        <div>
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide block mb-1">TYPE</label>
                          <p className="text-sm text-card-foreground">{report.extraData.type === 'extension' ? 'Extension of FDP/FH' : 'Reduction of Rest'}</p>
                        </div>
                      )}
                      {report.extraData.remarksActionTaken && (
                        <div>
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide block mb-1">REMARKS / ACTION TAKEN</label>
                          <p className="text-sm text-card-foreground leading-relaxed whitespace-pre-wrap">{report.extraData.remarksActionTaken}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* CHR Details (Arabic) */}
                {report.reportType === 'chr' && report.extraData && (
                  <div>
                    <div className="bg-muted border border-border rounded px-3 py-2 mb-4">
                      <h3 className="text-xs font-bold text-card-foreground uppercase tracking-wide">CONFIDENTIAL HAZARD REPORT (CHR) DETAILS</h3>
                    </div>
                    <div dir="rtl" className="pl-2 space-y-4">
                      {report.extraData.hazardDescription && (
                        <div>
                          <div className="text-xs font-semibold text-muted-foreground mb-1">وصف الخطر</div>
                          <div className="text-sm text-card-foreground leading-relaxed whitespace-pre-wrap">{report.extraData.hazardDescription}</div>
                        </div>
                      )}
                      {report.extraData.recommendations && (
                        <div>
                          <div className="text-xs font-semibold text-muted-foreground mb-1">التوصيات</div>
                          <div className="text-sm text-card-foreground leading-relaxed whitespace-pre-wrap">{report.extraData.recommendations}</div>
                        </div>
                      )}
                      {report.extraData.followUpActionTaken && (
                        <div>
                          <div className="text-xs font-semibold text-muted-foreground mb-1">الإجراء المتخذ</div>
                          <div className="text-sm text-card-foreground leading-relaxed whitespace-pre-wrap">{report.extraData.followUpActionTaken}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* RIR Details */}
                {report.reportType === 'rir' && report.extraData && (
                  <div>
                    <div className="bg-muted border border-border rounded px-3 py-2 mb-4">
                      <h3 className="text-xs font-bold text-card-foreground uppercase tracking-wide">RAMP INCIDENT REPORT (RIR) DETAILS</h3>
                    </div>
                    <div className="pl-2 space-y-4">
                      {report.extraData.incidentTitle && (
                        <div>
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide block mb-1">INCIDENT TITLE</label>
                          <p className="text-sm text-card-foreground leading-relaxed whitespace-pre-wrap">{report.extraData.incidentTitle}</p>
                        </div>
                      )}
                      {report.extraData.typeOfOccurrence && (
                        <div>
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide block mb-1">TYPE OF OCCURRENCE</label>
                          <p className="text-sm text-card-foreground">{report.extraData.typeOfOccurrence}</p>
                        </div>
                      )}
                      {report.extraData.remarks && (
                        <div>
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide block mb-1">REMARKS</label>
                          <p className="text-sm text-card-foreground leading-relaxed whitespace-pre-wrap">{report.extraData.remarks}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Admin Status Actions */}
            {canUpdateStatus && (
              <Card className="p-6 mb-6 border-l-4 border-l-blue-500">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                  <h3 className="text-lg font-semibold">Admin Actions</h3>
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
              <div className="p-6 space-y-6">
                <div>
                  <div className="bg-muted border border-border rounded px-3 py-2 mb-4">
                    <h3 className="text-xs font-bold text-card-foreground uppercase tracking-wide">
                      COMMENTS {report.comments && report.comments.length > 0 ? `(${report.comments.length})` : ''}
                    </h3>
                  </div>
              
              {/* Add Comment */}
                  <div className="pl-2 mb-6">
                <Textarea
                  placeholder="Add a comment or follow-up..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                      className="mb-3"
                  rows={3}
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
                    <div className="pl-2 space-y-4">
                  {report.comments.map((comment) => (
                        <div 
                          key={comment.id} 
                          className="bg-muted/50 border border-border rounded p-4" 
                          data-testid={`comment-${comment.id}`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <p className="text-xs font-bold text-card-foreground">
                              {comment.user?.firstName && comment.user?.lastName
                                ? `${comment.user.firstName} ${comment.user.lastName}`
                                : comment.user?.email || "Unknown User"}
                            </p>
                            {comment.createdAt && (
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(comment.createdAt), 'PPp')}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-card-foreground leading-relaxed whitespace-pre-wrap">{comment.content}</p>
                    </div>
                  ))}
                </div>
              ) : (
                    <div className="pl-2 text-center py-8">
                      <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">No comments yet. Be the first to comment.</p>
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
