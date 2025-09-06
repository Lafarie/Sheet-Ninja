'use client';

import { signIn, getProviders } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

export default function SignIn() {
  const [providers, setProviders] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('signin');
  
  // Sign In state
  const [signInEmail, setSignInEmail] = useState('');
  const [signInName, setSignInName] = useState('');
  
  // Sign Up state
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpName, setSignUpName] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    const fetchProviders = async () => {
      const providers = await getProviders();
      setProviders(providers || {});
    };
    fetchProviders();
  }, []);

  const handleSignIn = async (e) => {
    e.preventDefault();
    if (!signInEmail) {
      toast.error('Please enter your email');
      return;
    }

    setIsLoading(true);
    try {
      const result = await signIn('credentials', {
        email: signInEmail,
        name: signInName || signInEmail,
        redirect: true,
        callbackUrl: '/setup'
      });

      if (result?.error) {
        toast.error('Sign in failed');
      }
    } catch (error) {
      console.error('Sign in error:', error);
      toast.error('Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    if (!signUpEmail || !signUpName || !signUpPassword) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (signUpPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (signUpPassword.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: signUpEmail,
          name: signUpName,
          password: signUpPassword,
        }),
      });

      if (response.ok) {
        toast.success('Account created successfully! Signing you in...');
        
        // Automatically sign in after successful registration
        const result = await signIn('credentials', {
          email: signUpEmail,
          name: signUpName,
          redirect: true,
          callbackUrl: '/setup'
        });

        if (result?.error) {
          toast.error('Registration successful, but sign in failed. Please try signing in manually.');
        }
      } else {
        const data = await response.json();
        toast.error(data.error || 'Registration failed');
      }
    } catch (error) {
      console.error('Registration error:', error);
      toast.error('Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  // Demo sign-in with pre-filled data
  const handleDemoSignIn = async (demoEmail, demoName) => {
    setIsLoading(true);
    try {
      const result = await signIn('credentials', {
        email: demoEmail,
        name: demoName,
        redirect: true,
        callbackUrl: '/setup'
      });

      if (result?.error) {
        toast.error('Demo sign in failed');
      } else {
        toast.success(`Signed in as ${demoName}`);
      }
    } catch (error) {
      console.error('Demo sign in error:', error);
      toast.error('Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Welcome to Sheet Ninja</CardTitle>
          <CardDescription>
            Sign in to save your configurations and sync data between GitLab and Google Sheets
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Demo Sign-In Buttons */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Quick Demo:</Label>
            <div className="grid grid-cols-1 gap-2">
              <Button
                onClick={() => handleDemoSignIn('demo1@example.com', 'Demo User 1')}
                disabled={isLoading}
                variant="outline"
                size="sm"
              >
                Demo User 1
              </Button>
              <Button
                onClick={() => handleDemoSignIn('demo2@example.com', 'Demo User 2')}
                disabled={isLoading}
                variant="outline"
                size="sm"
              >
                Demo User 2
              </Button>
              <Button
                onClick={() => handleDemoSignIn('admin@example.com', 'Admin User')}
                disabled={isLoading}
                variant="outline"
                size="sm"
              >
                Admin Demo
              </Button>
            </div>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          {/* Sign In / Sign Up Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="space-y-4">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="Enter your email"
                    value={signInEmail}
                    onChange={(e) => setSignInEmail(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="signin-name">Name (Optional)</Label>
                  <Input
                    id="signin-name"
                    type="text"
                    placeholder="Enter your name"
                    value={signInName}
                    onChange={(e) => setSignInName(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={isLoading} className="w-full">
                  {isLoading ? 'Signing in...' : 'Sign In'}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="space-y-4">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div>
                  <Label htmlFor="signup-name">Full Name *</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="Enter your full name"
                    value={signUpName}
                    onChange={(e) => setSignUpName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="signup-email">Email *</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="Enter your email"
                    value={signUpEmail}
                    onChange={(e) => setSignUpEmail(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="signup-password">Password *</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="Create a password (min 6 characters)"
                    value={signUpPassword}
                    onChange={(e) => setSignUpPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <div>
                  <Label htmlFor="confirm-password">Confirm Password *</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" disabled={isLoading} className="w-full">
                  {isLoading ? 'Creating Account...' : 'Create Account'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          {/* OAuth Providers */}
          {Object.values(providers).filter(p => p.id !== 'credentials').map((provider) => (
            <Button
              key={provider.name}
              onClick={() => signIn(provider.id)}
              className="w-full"
              variant="outline"
            >
              Sign in with {provider.name}
            </Button>
          ))}
          
          <div className="text-center text-xs text-gray-500 mt-4">
            Demo mode: Just enter your email to continue.<br/>
            Your configurations and credentials will be securely encrypted and stored.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
