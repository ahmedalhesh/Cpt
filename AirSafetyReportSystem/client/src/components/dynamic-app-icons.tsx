import { useEffect } from 'react';
import { usePublicCompanySettings } from '@/hooks/usePublicCompanySettings';

export function DynamicAppIcons() {
  const { data: companySettings } = usePublicCompanySettings();

  useEffect(() => {
    if (!companySettings?.logo) return;

    const updateAppIcon = (sizes: number[], rel: string) => {
      // Remove existing icons of this type
      const existingIcons = document.querySelectorAll(`link[rel="${rel}"]`);
      existingIcons.forEach(icon => icon.remove());

      // Create new icon
      const link = document.createElement('link');
      link.rel = rel;
      
      try {
        if (companySettings.logo.startsWith('data:')) {
          // For base64 images, create icon directly
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const size = Math.max(...sizes);
          canvas.width = size;
          canvas.height = size;

          const img = new Image();
          img.onload = () => {
            if (ctx) {
              ctx.clearRect(0, 0, size, size);
              
              const aspectRatio = img.width / img.height;
              let drawWidth = size;
              let drawHeight = size;
              
              if (aspectRatio > 1) {
                drawHeight = size / aspectRatio;
              } else {
                drawWidth = size * aspectRatio;
              }
              
              const x = (size - drawWidth) / 2;
              const y = (size - drawHeight) / 2;
              
              ctx.drawImage(img, x, y, drawWidth, drawHeight);
              
              const iconDataUrl = canvas.toDataURL('image/png');
              link.href = iconDataUrl;
              
              if (sizes.length > 1) {
                link.sizes = sizes.map(s => `${s}x${s}`).join(' ');
              }
              
              document.head.appendChild(link);
            }
          };
          img.onerror = () => {
            console.warn(`Failed to load company logo for ${rel} icon`);
          };
          img.src = companySettings.logo;
        }
      } catch (error) {
        console.error(`Error updating ${rel} icon:`, error);
      }
    };

    // Update different icon types
    updateAppIcon([32, 16], 'icon'); // Standard favicon
    updateAppIcon([180], 'apple-touch-icon'); // Apple touch icon
    updateAppIcon([192, 512], 'icon'); // Android icons
    
  }, [companySettings?.logo]);

  return null;
}
