import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { 
  Settings as SettingsIcon, 
  Building2, 
  Mail, 
  Phone, 
  MapPin, 
  Upload,
  Save,
  Image,
  Trash2,
  Eye,
  EyeOff,
} from "lucide-react";

interface CompanySettings {
  id: string;
  companyName: string;
  email: string;
  phone: string;
  address: string;
  logo: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showLogoPreview, setShowLogoPreview] = useState(false);

  const [settingsData, setSettingsData] = useState({
    companyName: '',
    email: '',
    phone: '',
    address: '',
  });

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // Fetch company settings
  const { data: settings, isLoading } = useQuery<CompanySettings>({
    queryKey: ["/api/settings"],
    queryFn: async () => {
      const response = await fetch('/api/settings', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        // If no settings exist, return default values
        if (response.status === 404) {
          return {
            id: '',
            companyName: 'Air Safety System',
            email: '',
            phone: '',
            address: '',
            logo: null,
            createdAt: '',
            updatedAt: '',
          };
        }
        throw new Error('Failed to fetch settings');
      }

      return response.json();
    },
  });

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update settings');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/settings/public"] });
      toast({
        title: "Settings updated",
        description: "Company settings have been updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Upload logo mutation
  const uploadLogoMutation = useMutation({
    mutationFn: async (file: File) => {
      // Convert file to base64 for now (in production, upload to cloud storage)
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const response = await fetch('/api/settings/logo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ logoUrl: base64 }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to upload logo');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/settings/public"] });
      toast({
        title: "Logo uploaded",
        description: "Company logo has been updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete logo mutation
  const deleteLogoMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/settings/logo', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete logo');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Logo deleted",
        description: "Company logo has been removed successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Initialize form data when settings are loaded
  useState(() => {
    if (settings) {
      setSettingsData({
        companyName: settings.companyName || '',
        email: settings.email || '',
        phone: settings.phone || '',
        address: settings.address || '',
      });
    }
  });

  const handleSettingsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettingsMutation.mutate(settingsData);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setLogoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLogoUpload = () => {
    if (logoFile) {
      uploadLogoMutation.mutate(logoFile);
    }
  };

  const handleLogoDelete = () => {
    if (confirm('Are you sure you want to delete the current logo?')) {
      deleteLogoMutation.mutate();
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="flex-1 overflow-auto">
        <div className="container max-w-7xl mx-auto p-6">
        <div className="text-center">
          <SettingsIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-semibold mb-2">Access Denied</h1>
          <p className="text-muted-foreground">You don't have permission to access this page.</p>
        </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="container max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight mb-2">Company Settings</h1>
          <p className="text-muted-foreground">
            Manage your company information, contact details, and branding
          </p>
        </div>

        <div className="grid gap-8">
          {/* Company Information */}
          <Card className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Company Information</h2>
                <p className="text-muted-foreground">Update your company details</p>
              </div>
            </div>

            <form onSubmit={handleSettingsSubmit} className="space-y-4">
              <div>
                <Label htmlFor="companyName">Company Name</Label>
                <Input
                  id="companyName"
                  value={settingsData.companyName}
                  onChange={(e) => setSettingsData({ ...settingsData, companyName: e.target.value })}
                  placeholder="Enter company name"
                  required
                />
              </div>
              <div>
                <Label htmlFor="email">Company Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={settingsData.email}
                  onChange={(e) => setSettingsData({ ...settingsData, email: e.target.value })}
                  placeholder="Enter company email"
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={settingsData.phone}
                  onChange={(e) => setSettingsData({ ...settingsData, phone: e.target.value })}
                  placeholder="Enter phone number"
                />
              </div>
              <div>
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  value={settingsData.address}
                  onChange={(e) => setSettingsData({ ...settingsData, address: e.target.value })}
                  placeholder="Enter company address"
                  rows={3}
                />
              </div>
              <div className="flex justify-end">
                <Button 
                  type="submit" 
                  disabled={updateSettingsMutation.isPending}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {updateSettingsMutation.isPending ? 'Saving...' : 'Save Settings'}
                </Button>
              </div>
            </form>
          </Card>

          {/* Company Logo */}
          <Card className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <Image className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Company Logo</h2>
                <p className="text-muted-foreground">Upload and manage your company logo</p>
              </div>
            </div>

            <div className="space-y-6">
              {/* Current Logo */}
              {settings?.logo && (
                <div className="space-y-4">
                  <Label>Current Logo</Label>
                  <div className="flex items-center gap-4">
                    <div className="h-20 w-20 border rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center">
                      <img 
                        src={settings.logo} 
                        alt="Company Logo" 
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowLogoPreview(!showLogoPreview)}
                      >
                        {showLogoPreview ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                        {showLogoPreview ? 'Hide' : 'Preview'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleLogoDelete}
                        disabled={deleteLogoMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                  </div>
                  
                  {showLogoPreview && (
                    <div className="border rounded-lg p-4 bg-gray-50">
                      <img 
                        src={settings.logo} 
                        alt="Company Logo Preview" 
                        className="max-h-32 mx-auto"
                      />
                    </div>
                  )}
                </div>
              )}

              <Separator />

              {/* Upload New Logo */}
              <div className="space-y-4">
                <Label htmlFor="logo">Upload New Logo</Label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600 mb-2">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-gray-500 mb-4">
                    PNG, JPG, GIF up to 2MB
                  </p>
                  <Input
                    id="logo"
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById('logo')?.click()}
                  >
                    Choose File
                  </Button>
                </div>

                {logoPreview && (
                  <div className="space-y-2">
                    <Label>Preview</Label>
                    <div className="border rounded-lg p-4 bg-gray-50">
                      <img 
                        src={logoPreview} 
                        alt="Logo Preview" 
                        className="max-h-32 mx-auto"
                      />
                    </div>
                    <Button
                      onClick={handleLogoUpload}
                      disabled={uploadLogoMutation.isPending}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {uploadLogoMutation.isPending ? 'Uploading...' : 'Upload Logo'}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </Card>

        </div>
      </div>
    </div>
  );
}
