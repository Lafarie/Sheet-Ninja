import { useState } from 'react';

// Simple hook to animate/transition to the next step with smooth scrolling and delay
export function useStepTransition(setCurrentStep, opts = {}) {
  const { delay = 700, setActiveTab, tabValue } = opts;
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
    // If caller provided a tab setter and value, switch the active tab as well
    try {
      if (typeof setActiveTab === 'function' && tabValue) {
        setActiveTab(tabValue);
      }
    } catch (e) {
      // ignore errors from optional callback
    }
    setAnimating(false);
  };

  return { animating, transitionTo };
}
