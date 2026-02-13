/**
 * Admin Initializer Component
 * Shows on first login if no admin exists yet
 */

import React, { useEffect, useState } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { checkAdminStatus, promoteFirstAdmin, getCurrentUserAdminStatus } from '@/api/admin';

interface AdminInitializerProps {
  userEmail: string;
  onAdminCreated?: () => void;
}

export function AdminInitializer({ userEmail, onAdminCreated }: AdminInitializerProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    checkSetupStatus();
  }, []);

  async function checkSetupStatus() {
    try {
      setLoading(true);

      // Check if user is already admin
      const userStatus = await getCurrentUserAdminStatus();
      if (userStatus?.isAdmin) {
        setShowDialog(false);
        return;
      }

      // Check if any admin exists
      const adminStatus = await checkAdminStatus();
      if (adminStatus?.can_create_admin) {
        setShowDialog(true);
      }
    } catch (err) {
      console.error('Error checking setup status:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handlePromoteToAdmin() {
    try {
      setIsProcessing(true);
      setError(null);

      const result = await promoteFirstAdmin(userEmail);

      if (result?.success) {
        // Success!
        setShowDialog(false);
        onAdminCreated?.();
      } else {
        setError(result?.error || 'Failed to create admin');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setIsProcessing(false);
    }
  }

  if (loading) {
    return null;
  }

  return (
    <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>🎉 System Setup Required</AlertDialogTitle>
          <AlertDialogDescription>
            <div className="space-y-3 mt-4">
              <p>
                This is your first login! We need to set up an admin account to manage the system.
              </p>
              <p className="font-semibold">
                Make <strong>{userEmail}</strong> an admin?
              </p>
              <p className="text-xs text-gray-500">
                As admin, you'll be able to:
              </p>
              <ul className="text-xs text-gray-500 list-disc list-inside space-y-1">
                <li>Manage user roles and permissions</li>
                <li>Upload and manage knowledge base documents</li>
                <li>View audit logs and analytics</li>
              </ul>
              {error && (
                <div className="bg-red-50 border border-red-200 rounded p-2 text-red-600 text-xs">
                  {error}
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex gap-2">
          <AlertDialogCancel disabled={isProcessing}>
            Dismiss
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handlePromoteToAdmin}
            disabled={isProcessing}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isProcessing ? 'Creating Admin...' : 'Create Admin Account'}
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
