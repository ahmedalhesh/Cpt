import { useEffect } from 'react';
import { usePublicCompanySettings } from '@/hooks/usePublicCompanySettings';

export function DynamicTitle() {
  const { data: companySettings } = usePublicCompanySettings();

  useEffect(() => {
    // Update page title
    const titleElement = document.getElementById('app-title');
    if (titleElement) {
      const companyName = companySettings?.companyName;
      if (companyName) {
        titleElement.textContent = companyName;
        document.title = companyName;
      } else {
        titleElement.textContent = 'Report Sys';
        document.title = 'Report Sys';
      }
    }
  }, [companySettings?.companyName]);

  return null; // This component doesn't render anything
}
