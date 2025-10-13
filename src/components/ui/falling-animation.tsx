'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface FallingItem {
  id: string;
  emoji: string;
  x: number;
  y: number;
  size: number;
  rotation: number;
  duration: number;
  delay: number;
}

interface FallingAnimationProps {
  isVisible: boolean;
  onComplete?: () => void;
  items?: string[];
  itemCount?: number;
  duration?: number;
}

export function FallingAnimation({ 
  isVisible, 
  onComplete, 
  items = ['❤️', '💖', '💕', '💗', '💝'], 
  itemCount = 50,
  duration = 3000 
}: FallingAnimationProps) {
  const [fallingItems, setFallingItems] = useState<FallingItem[]>([]);

  const generateFallingItems = useCallback(() => {
    const newItems: FallingItem[] = [];
    for (let i = 0; i < itemCount; i++) {
      newItems.push({
        id: `item-${i}`,
        emoji: items[Math.floor(Math.random() * items.length)],
        x: Math.random() * 100, // percentage
        y: -20, // start above screen
        size: Math.random() * 20 + 20, // 20-40px
        rotation: Math.random() * 360,
        duration: Math.random() * 2000 + 2000, // 2-4 seconds
        delay: Math.random() * 1000, // 0-1 second delay
      });
    }
    setFallingItems(newItems);
  }, [items, itemCount]);

  useEffect(() => {
    console.log('FallingAnimation effect - isVisible:', isVisible);
    if (isVisible) {
      generateFallingItems();
      const timer = setTimeout(() => {
        console.log('FallingAnimation completing');
        onComplete?.();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, generateFallingItems, duration, onComplete]);

  if (!isVisible) {
    console.log('FallingAnimation not visible');
    return null;
  }

  console.log('FallingAnimation rendering with', fallingItems.length, 'items');

  return (
    <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden">
      <AnimatePresence>
        {fallingItems.map((item) => (
          <motion.div
            key={item.id}
            initial={{
              x: `${item.x}vw`,
              y: `${item.y}vh`,
              rotate: item.rotation,
              opacity: 0,
            }}
            animate={{
              y: '120vh',
              opacity: [0, 1, 1, 0],
              rotate: item.rotation + 360,
            }}
            transition={{
              duration: item.duration / 1000,
              delay: item.delay / 1000,
              ease: 'linear',
              opacity: {
                times: [0, 0.1, 0.9, 1],
                duration: item.duration / 1000,
              },
            }}
            className="absolute will-change-transform"
            style={{
              fontSize: `${item.size}px`,
              left: 0,
              top: 0,
            }}
          >
            {item.emoji}
          </motion.div>
        ))}
      </AnimatePresence>
      
      {/* Optional backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
        className="absolute inset-0 bg-black pointer-events-none"
      />
    </div>
  );
}

// Sparkle effect variant
export function SparkleAnimation({ 
  isVisible, 
  onComplete, 
  itemCount = 30,
  duration = 2000 
}: FallingAnimationProps) {
  const sparkles = ['✨', '⭐', '🌟', '💫', '⚡'];
  
  return (
    <FallingAnimation
      isVisible={isVisible}
      onComplete={onComplete}
      items={sparkles}
      itemCount={itemCount}
      duration={duration}
    />
  );
}

// Confetti effect variant
export function ConfettiAnimation({ 
  isVisible, 
  onComplete, 
  itemCount = 40,
  duration = 2500 
}: FallingAnimationProps) {
  const confetti = ['🎉', '🎊', '🎈', '🎁', '🎀', '🍾', '🥳'];
  
  return (
    <FallingAnimation
      isVisible={isVisible}
      onComplete={onComplete}
      items={confetti}
      itemCount={itemCount}
      duration={duration}
    />
  );
}
