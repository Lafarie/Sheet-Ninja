'use client';

import { useSession } from 'next-auth/react';
import { AnimationAdminPanel } from '@/components/admin/AnimationAdminPanel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Shield } from 'lucide-react';
import Link from 'next/link';

export default function AdminAnimationPage() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-gray-600">Loading...</div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold flex items-center justify-center gap-2">
              <Shield className="h-6 w-6" />
              Admin Access Required
            </CardTitle>
            <CardDescription>You need to be signed in as an admin to access this page</CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <Link href="/v2">
              <Button className="w-full">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Go Back to Main Page
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!session.user.isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold flex items-center justify-center gap-2">
              <Shield className="h-6 w-6" />
              Access Denied
            </CardTitle>
            <CardDescription>You do not have admin privileges to access this page</CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <Alert>
              <AlertDescription>
                This page is restricted to administrators only. If you believe you should have access, please contact your system administrator.
              </AlertDescription>
            </Alert>
            <Link href="/v2">
              <Button className="w-full">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Go Back to Main Page
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <Card className="mb-8 bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0">
          <CardHeader>
            <div className="flex items-center justify-between">
              <Link href="/v2">
                <Button variant="ghost" size="sm" className="text-white hover:bg-white/10">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Main
                </Button>
              </Link>
              <div className="text-center flex-1">
                <CardTitle className="text-3xl font-bold flex items-center justify-center gap-2">
                  <Shield className="h-8 w-8" />
                  Animation Admin Panel
                </CardTitle>
                <CardDescription className="text-purple-100 text-lg">
                  Manage falling animations and user preferences
                </CardDescription>
              </div>
              <div className="w-24"></div> {/* Spacer for symmetry */}
            </div>
          </CardHeader>
        </Card>

        {/* Admin Panel */}
        <AnimationAdminPanel />
      </div>
    </div>
  );
}