import { useState, useEffect } from 'react';

interface BrandingConfig {
  logo_url: string;
  logo_width: number;
  logo_height: number;
  company_name: string;
  primary_color: string;
  secondary_color: string;
}

const defaultBranding: BrandingConfig = {
  logo_url: '/double-logo.svg',
  logo_width: 200,
  logo_height: 60,
  company_name: 'Double TI + Telecom',
  primary_color: '#5b9bd5',
  secondary_color: '#1e3a5f'
};

export function useBranding() {
  const [branding, setBranding] = useState<BrandingConfig>(defaultBranding);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBranding();
  }, []);

  const loadBranding = async () => {
    try {
      const response = await fetch('/api/admin/branding');
      if (response.ok) {
        const data = await response.json();
        setBranding(data);
      }
    } catch (error) {
      console.error('Error loading branding:', error);
    } finally {
      setLoading(false);
    }
  };

  return { branding, loading, reload: loadBranding };
}
