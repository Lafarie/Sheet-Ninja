'use client';

import { UserAnimationPanel } from '@/components/user/UserAnimationPanel';

export default function UserAnimationSettingsPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Animation Settings</h1>
        <p className="text-muted-foreground mt-2">
          Personalize your falling animations that appear when you login or visit the site.
        </p>
      </div>
      
      <UserAnimationPanel />
    </div>
  );
}