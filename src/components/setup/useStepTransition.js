import { useState } from 'react';

// Simple hook to animate/transition to the next step with smooth scrolling and delay
export function useStepTransition(setCurrentStep, opts = {}) {
  const { delay = 700 } = opts;
  const [animating, setAnimating] = useState(false);

  const transitionTo = async (nextStep, customDelay) => {
    const wait = typeof customDelay === 'number' ? customDelay : delay;
    setAnimating(true);
    if (typeof window !== 'undefined' && window.scrollTo) {
      try {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (e) {
        // ignore
      }
    }
    await new Promise((res) => setTimeout(res, wait));
    setCurrentStep(nextStep);
    setAnimating(false);
  };

  return { animating, transitionTo };
}
