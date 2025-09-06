'use client';

import { signIn, getProviders } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Eye, EyeOff, Mail, Lock, User, Zap } from 'lucide-react';

export default function SignIn() {
  const [providers, setProviders] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('signin');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Sign In state
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [showSignInPassword, setShowSignInPassword] = useState(false);

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
    if (!signInEmail || !signInPassword) {
      toast.error('Please enter your email and password');
      return;
    }

    setIsLoading(true);
    try {
      console.log('🔐 Attempting sign in with:', { email: signInEmail });
      const result = await signIn('credentials', {
        email: signInEmail,
        password: signInPassword,
        redirect: false,
        callbackUrl: '/setup'
      });

      console.log('🔐 Sign in result:', result);

      if (result?.error) {
        console.error('❌ Sign in error:', result.error);
        toast.error('Sign in failed: ' + result.error);
        setIsLoading(false);
      } else if (result?.ok) {
        console.log('✅ Sign in successful, redirecting...');
        toast.success('Signed in successfully!');
        // Force redirect after successful sign in
        window.location.href = '/setup';
      } else {
        console.log('🤔 Unexpected result:', result);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Sign in error:', error);
      toast.error('Something went wrong');
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
          password: signUpPassword,
          redirect: false,
          callbackUrl: '/setup'
        });

        if (result?.error) {
          toast.error('Registration successful, but sign in failed. Please try signing in manually.');
          setIsLoading(false);
        } else if (result?.ok) {
          toast.success('Signed in successfully!');
          // Force redirect after successful sign in
          window.location.href = '/setup';
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
        password: 'demo123', // Default demo password
        redirect: false,
        callbackUrl: '/setup'
      });

      if (result?.error) {
        toast.error('Demo sign in failed');
        setIsLoading(false);
      } else if (result?.ok) {
        toast.success(`Signed in as ${demoName}`);
        // Force redirect after successful sign in
        window.location.href = '/setup';
      }
    } catch (error) {
      console.error('Demo sign in error:', error);
      toast.error('Something went wrong');
      setIsLoading(false);
    }
  };

  const getPasswordStrength = (password) => {
    if (password.length === 0) return { strength: 0, label: '' };
    if (password.length < 6) return { strength: 1, label: 'Weak' };
    if (password.length < 8) return { strength: 2, label: 'Fair' };
    if (password.length < 12) return { strength: 3, label: 'Good' };
    return { strength: 4, label: 'Strong' };
  };

  const passwordStrength = getPasswordStrength(signUpPassword);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center mb-4">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Sheet Ninja</h1>
          <p className="text-gray-600 mt-2">Automate your GitLab-Google Sheets workflow</p>
        </div>

        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl">Welcome Back</CardTitle>
            <CardDescription>
              Sign in to your account or create a new one
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-3 text-gray-500 font-medium">Or continue with</span>
              </div>
            </div>

            {/* Sign In / Sign Up Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin" className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Sign In
                </TabsTrigger>
                <TabsTrigger value="signup" className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Sign Up
                </TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="space-y-4 mt-6">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email" className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      Email Address
                    </Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="Enter your email"
                      value={signInEmail}
                      onChange={(e) => setSignInEmail(e.target.value)}
                      required
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password" className="flex items-center gap-2">
                      <Lock className="w-4 h-4" />
                      Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="signin-password"
                        type={showSignInPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        value={signInPassword}
                        onChange={(e) => setSignInPassword(e.target.value)}
                        required
                        className="h-11 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSignInPassword(!showSignInPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                        {showSignInPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <Button type="submit" disabled={isLoading} className="w-full h-11">
                    {isLoading ? 'Signing in...' : 'Sign In'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="space-y-4 mt-6">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name" className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Full Name *
                    </Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="Enter your full name"
                      value={signUpName}
                      onChange={(e) => setSignUpName(e.target.value)}
                      required
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      Email Address *
                    </Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="Enter your email"
                      value={signUpEmail}
                      onChange={(e) => setSignUpEmail(e.target.value)}
                      required
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password" className="flex items-center gap-2">
                      <Lock className="w-4 h-4" />
                      Password *
                    </Label>
                    <div className="relative">
                      <Input
                        id="signup-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Create a password (min 6 characters)"
                        value={signUpPassword}
                        onChange={(e) => setSignUpPassword(e.target.value)}
                        required
                        minLength={6}
                        className="h-11 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {signUpPassword && (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              passwordStrength.strength === 1 ? 'bg-red-500 w-1/4' :
                              passwordStrength.strength === 2 ? 'bg-yellow-500 w-2/4' :
                              passwordStrength.strength === 3 ? 'bg-blue-500 w-3/4' :
                              'bg-green-500 w-full'
                            }`}
                          />
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {passwordStrength.label}
                        </Badge>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password" className="flex items-center gap-2">
                      <Lock className="w-4 h-4" />
                      Confirm Password *
                    </Label>
                    <div className="relative">
                      <Input
                        id="confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Confirm your password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        className="h-11 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <Button type="submit" disabled={isLoading} className="w-full h-11">
                    {isLoading ? 'Creating Account...' : 'Create Account'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            {/* OAuth Providers */}
            {Object.values(providers).filter(p => p.id !== 'credentials').length > 0 && (
              <>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-gray-200" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-3 text-gray-500 font-medium">Or</span>
                  </div>
                </div>
                <div className="space-y-2">
                  {Object.values(providers).filter(p => p.id !== 'credentials').map((provider) => (
                    <Button
                      key={provider.name}
                      onClick={() => signIn(provider.id)}
                      className="w-full h-11"
                      variant="outline"
                    >
                      Sign in with {provider.name}
                    </Button>
                  ))}
                </div>
              </>
            )}

            <div className="text-center text-xs text-gray-500 pt-4 border-t">
              <p className="mb-2">Demo mode: Use password "demo123" for demo accounts.</p>
              <p>Your configurations and credentials will be securely encrypted and stored.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
