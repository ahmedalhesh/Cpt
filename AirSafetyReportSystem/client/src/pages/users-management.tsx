import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Edit, 
  Trash2, 
  Key, 
  Search,
  Users,
  UserPlus,
  Shield,
  UserCheck,
} from "lucide-react";
import type { User } from "@shared/schema";

export default function UsersManagement() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [userToDelete, setUserToDelete] = useState<User | null>(null);
	const [isResetPasswordDialogOpen, setIsResetPasswordDialogOpen] = useState(false);
	const [userToResetPassword, setUserToResetPassword] = useState<User | null>(null);

  // Fetch users
  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    enabled: currentUser?.role === 'admin',
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (userData: any) => {
      const response = await fetch('/api/auth/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create user');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setIsCreateDialogOpen(false);
      toast({
        title: "Success",
        description: "User created successfully",
      });
      // Reset form will be handled by unmounting the component
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async ({ id, userData }: { id: string; userData: any }) => {
      const response = await fetch(`/api/admin/users/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update user');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setIsEditDialogOpen(false);
      setSelectedUser(null);
      toast({
        title: "Success",
        description: "User updated successfully",
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

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete user');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Success",
        description: "User deleted successfully",
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

  // Reset password mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async ({ id, newPassword }: { id: string; newPassword: string }) => {
      const response = await fetch(`/api/admin/users/${id}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ newPassword }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to reset password');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Password reset successfully",
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

  const filteredUsers = users?.filter(user =>
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.lastName?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'captain':
        return 'bg-blue-100 text-blue-800';
      case 'first_officer':
        return 'bg-green-100 text-green-800';
      case 'under_training_captain':
        return 'bg-blue-50 text-blue-700';
      case 'under_training_first_officer':
        return 'bg-green-50 text-green-700';
      case 'flight_operation_manager':
      case 'flight_operation_and_crew_affairs_manager':
      case 'flight_operations_training_manager':
      case 'chief_pilot_a330':
      case 'chief_pilot_a320':
      case 'technical_pilot_a330':
      case 'technical_pilot_a320':
      case 'head_of_safety_department':
      case 'head_of_compliance':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (currentUser?.role !== 'admin') {
    return (
      <div className="flex-1 overflow-auto">
        <div className="container max-w-7xl mx-auto p-6">
          <div className="text-center">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h1 className="text-2xl font-semibold mb-2">Access Denied</h1>
            <p className="text-muted-foreground">You don't have permission to access this page.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="container max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight mb-2">Users Management</h1>
          <p className="text-muted-foreground">
            Manage system users, roles, and permissions
          </p>
        </div>

        {/* Actions */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Create User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
              </DialogHeader>
              <CreateUserForm onSubmit={(data) => createUserMutation.mutate(data)} />
            </DialogContent>
          </Dialog>
        </div>

        {/* Users List */}
        <div className="grid gap-4">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground mt-2">Loading users...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <Card className="p-8 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No users found</h3>
              <p className="text-muted-foreground">Create your first user to get started.</p>
            </Card>
          ) : (
            filteredUsers.map((user) => (
              <Card key={user.id} className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <UserCheck className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">
                        {user.firstName && user.lastName 
                          ? `${user.firstName} ${user.lastName}`
                          : user.email}
                      </h3>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getRoleBadgeColor(user.role || 'captain')}>
                      {user.role?.replace('_', ' ').toUpperCase()}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedUser(user);
                        setIsEditDialogOpen(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setUserToResetPassword(user);
                        setIsResetPasswordDialogOpen(true);
                      }}
                    >
                      <Key className="h-4 w-4" />
                    </Button>
					<Button
						variant="outline"
						size="sm"
						onClick={() => {
							setUserToDelete(user);
							setIsDeleteDialogOpen(true);
						}}
					>
						<Trash2 className="h-4 w-4" />
					</Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Edit User Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
            </DialogHeader>
            {selectedUser && (
              <EditUserForm 
                user={selectedUser}
                onSubmit={(data) => updateUserMutation.mutate({ id: selectedUser.id, userData: data })}
              />
            )}
          </DialogContent>
        </Dialog>

		{/* Delete Confirmation Dialog */}
		<AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Delete user?</AlertDialogTitle>
					<AlertDialogDescription>
						This action cannot be undone. This will permanently delete the user
						{userToDelete?.email ? ` (${userToDelete.email})` : ''} from the system.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel onClick={() => setUserToDelete(null)}>Cancel</AlertDialogCancel>
					<AlertDialogAction
						onClick={() => {
							if (userToDelete?.id) {
								deleteUserMutation.mutate(userToDelete.id);
							}
							setIsDeleteDialogOpen(false);
							setUserToDelete(null);
						}}
						className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
					>
						Delete
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>

		{/* Reset Password Dialog */}
		<Dialog open={isResetPasswordDialogOpen} onOpenChange={setIsResetPasswordDialogOpen}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Reset Password</DialogTitle>
				</DialogHeader>
				{userToResetPassword && (
					<ResetPasswordForm 
						user={userToResetPassword}
						onSubmit={(newPassword) => {
							resetPasswordMutation.mutate({ id: userToResetPassword.id, newPassword });
							setIsResetPasswordDialogOpen(false);
							setUserToResetPassword(null);
						}}
					/>
				)}
			</DialogContent>
		</Dialog>
      </div>
    </div>
  );
}

// Create User Form Component
function CreateUserForm({ onSubmit }: { onSubmit: (data: any) => void }) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'captain',
  });
  const [emailError, setEmailError] = useState('');
  const [nameError, setNameError] = useState('');


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear previous errors
    setEmailError('');
    setNameError('');
    
    // Basic validation
    if (!formData.email || !formData.password) {
      return;
    }
    
    onSubmit(formData);
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const email = e.target.value;
    setFormData({ ...formData, email });
    
    // Clear email error when user starts typing
    if (emailError) {
      setEmailError('');
    }
  };

  const handleNameChange = (field: 'firstName' | 'lastName', value: string) => {
    setFormData({ ...formData, [field]: value });
    
    // Clear name error when user starts typing
    if (nameError) {
      setNameError('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={handleEmailChange}
          required
          autoComplete="email"
          className={emailError ? 'border-red-500' : ''}
        />
        {emailError && <p className="text-sm text-red-500 mt-1">{emailError}</p>}
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          required
          autoComplete="new-password"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="firstName">First Name</Label>
          <Input
            id="firstName"
            value={formData.firstName}
            onChange={(e) => handleNameChange('firstName', e.target.value)}
            autoComplete="given-name"
            className={nameError ? 'border-red-500' : ''}
          />
        </div>
        <div>
          <Label htmlFor="lastName">Last Name</Label>
          <Input
            id="lastName"
            value={formData.lastName}
            onChange={(e) => handleNameChange('lastName', e.target.value)}
            autoComplete="family-name"
            className={nameError ? 'border-red-500' : ''}
          />
        </div>
        {nameError && <p className="text-sm text-red-500 mt-1 col-span-2">{nameError}</p>}
      </div>
      <div>
        <Label htmlFor="role">Role</Label>
        <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="captain">Captain</SelectItem>
            <SelectItem value="first_officer">First Officer</SelectItem>
            <SelectItem value="under_training_captain">Under Training Captain</SelectItem>
            <SelectItem value="under_training_first_officer">Under Training First Officer</SelectItem>
            <SelectItem value="flight_operation_manager">Flight operation manager</SelectItem>
            <SelectItem value="flight_operation_and_crew_affairs_manager">Flight operation and crew affairs manager</SelectItem>
            <SelectItem value="flight_operations_training_manager">Flight operations training manager</SelectItem>
            <SelectItem value="chief_pilot_a330">Chief pilot A330</SelectItem>
            <SelectItem value="chief_pilot_a320">Chief pilot A320</SelectItem>
            <SelectItem value="technical_pilot_a330">Technical pilot A330</SelectItem>
            <SelectItem value="technical_pilot_a320">Technical pilot A320</SelectItem>
            <SelectItem value="head_of_safety_department">Head of safety department</SelectItem>
            <SelectItem value="head_of_compliance">Head of compliance</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="submit">Create User</Button>
      </div>
    </form>
  );
}

// Edit User Form Component
function EditUserForm({ user, onSubmit }: { user: User; onSubmit: (data: any) => void }) {
  const [formData, setFormData] = useState({
    email: user.email || '',
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    role: user.role || 'captain',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="firstName">First Name</Label>
          <Input
            id="firstName"
            value={formData.firstName}
            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="lastName">Last Name</Label>
          <Input
            id="lastName"
            value={formData.lastName}
            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
          />
        </div>
      </div>
      <div>
        <Label htmlFor="role">Role</Label>
        <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="captain">Captain</SelectItem>
            <SelectItem value="first_officer">First Officer</SelectItem>
            <SelectItem value="under_training_captain">Under Training Captain</SelectItem>
            <SelectItem value="under_training_first_officer">Under Training First Officer</SelectItem>
            <SelectItem value="flight_operation_manager">Flight operation manager</SelectItem>
            <SelectItem value="flight_operation_and_crew_affairs_manager">Flight operation and crew affairs manager</SelectItem>
            <SelectItem value="flight_operations_training_manager">Flight operations training manager</SelectItem>
            <SelectItem value="chief_pilot_a330">Chief pilot A330</SelectItem>
            <SelectItem value="chief_pilot_a320">Chief pilot A320</SelectItem>
            <SelectItem value="technical_pilot_a330">Technical pilot A330</SelectItem>
            <SelectItem value="technical_pilot_a320">Technical pilot A320</SelectItem>
            <SelectItem value="head_of_safety_department">Head of safety department</SelectItem>
            <SelectItem value="head_of_compliance">Head of compliance</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="submit">Update User</Button>
      </div>
    </form>
  );
}

// Reset Password Form Component
function ResetPasswordForm({ user, onSubmit }: { user: User; onSubmit: (newPassword: string) => void }) {
  const [formData, setFormData] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({
    newPassword: '',
    confirmPassword: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear previous errors
    setErrors({ newPassword: '', confirmPassword: '' });
    
    // Validation
    if (!formData.newPassword) {
      setErrors(prev => ({ ...prev, newPassword: 'Password is required' }));
      return;
    }
    
    if (formData.newPassword.length < 6) {
      setErrors(prev => ({ ...prev, newPassword: 'Password must be at least 6 characters' }));
      return;
    }
    
    if (formData.newPassword !== formData.confirmPassword) {
      setErrors(prev => ({ ...prev, confirmPassword: 'Passwords do not match' }));
      return;
    }
    
    onSubmit(formData.newPassword);
  };

  const handlePasswordChange = (field: 'newPassword' | 'confirmPassword', value: string) => {
    setFormData({ ...formData, [field]: value });
    
    // Clear errors when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-4 bg-blue-50 rounded-md">
        <p className="text-sm text-blue-800">
          <strong>User:</strong> {user.firstName && user.lastName 
            ? `${user.firstName} ${user.lastName}` 
            : user.email}
        </p>
        <p className="text-sm text-blue-700">
          <strong>Email:</strong> {user.email}
        </p>
      </div>
      
      <div>
        <Label htmlFor="newPassword">New Password</Label>
        <Input
          id="newPassword"
          type="password"
          value={formData.newPassword}
          onChange={(e) => handlePasswordChange('newPassword', e.target.value)}
          required
          autoComplete="new-password"
          className={errors.newPassword ? 'border-red-500' : ''}
          placeholder="Enter new password"
        />
        {errors.newPassword && <p className="text-sm text-red-500 mt-1">{errors.newPassword}</p>}
      </div>
      
      <div>
        <Label htmlFor="confirmPassword">Confirm Password</Label>
        <Input
          id="confirmPassword"
          type="password"
          value={formData.confirmPassword}
          onChange={(e) => handlePasswordChange('confirmPassword', e.target.value)}
          required
          autoComplete="new-password"
          className={errors.confirmPassword ? 'border-red-500' : ''}
          placeholder="Confirm new password"
        />
        {errors.confirmPassword && <p className="text-sm text-red-500 mt-1">{errors.confirmPassword}</p>}
      </div>
      
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => {
          setFormData({ newPassword: '', confirmPassword: '' });
          setErrors({ newPassword: '', confirmPassword: '' });
        }}>
          Clear
        </Button>
        <Button type="submit">Reset Password</Button>
      </div>
    </form>
  );
}
