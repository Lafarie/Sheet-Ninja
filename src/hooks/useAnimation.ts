'use client';

import { useState, useEffect } from 'react';

export interface AnimationSettings {
  id: string;
  isEnabled: boolean;
  items: string[];
  itemCount: number;
  duration: number;
  maxViewsPerUser: number;
}

export interface AnimationData {
  settings: AnimationSettings;
  shouldShowAnimation: boolean;
  userViewCount: number;
}

export function useAnimation() {
  const [animationData, setAnimationData] = useState<AnimationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnimationData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/animation');
      
      if (!response.ok) {
        throw new Error('Failed to fetch animation data');
      }
      
      const data = await response.json();
      console.log('Animation data fetched:', data);
      setAnimationData(data);
      setError(null);
    } catch (err) {
      console.error('Animation fetch error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setAnimationData(null);
    } finally {
      setLoading(false);
    }
  };

  const recordView = async () => {
    try {
      const response = await fetch('/api/animation', {
        method: 'POST',
      });
      
      if (!response.ok) {
        console.error('Failed to record animation view');
      }
    } catch (err) {
      console.error('Error recording animation view:', err);
    }
  };

  useEffect(() => {
    fetchAnimationData();
  }, []);

  return {
    animationData,
    loading,
    error,
    refetch: fetchAnimationData,
    recordView,
  };
}