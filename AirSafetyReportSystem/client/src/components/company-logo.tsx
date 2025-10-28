import { useCompanySettings } from "@/hooks/useCompanySettings";
import { usePublicCompanySettings } from "@/hooks/usePublicCompanySettings";

interface CompanyLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showText?: boolean;
}

export function CompanyLogo({ size = 'md', className = '', showText = false }: CompanyLogoProps) {
  const { data: companySettings } = useCompanySettings();
  const { data: publicCompanySettings } = usePublicCompanySettings();
  
  // Use authenticated settings if available, otherwise use public settings
  const settings = companySettings || publicCompanySettings;

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
    xl: 'text-lg',
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {settings?.logo ? (
        <img 
          src={settings.logo} 
          alt="Company Logo" 
          className={`h-6 w-6 object-contain`}
        />
      ) : null}
      {showText && (
        <span className={`font-semibold ${textSizeClasses[size]}`}>
          {settings?.companyName || "Report Sys"}
        </span>
      )}
    </div>
  );
}
