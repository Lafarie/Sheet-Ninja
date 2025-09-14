/**
 * Sync State Manager
 * Manages the state of synchronization processes between Google Sheets and GitLab
 */

class SyncStateManager {
  constructor() {
    this.state = {
      running: false,
      currentStep: 'idle',
      progress: 0,
      totalSteps: 0,
      error: null,
      output: [],
      startTime: null,
      endTime: null,
      lastUpdate: null
    };
  }

  /**
   * Get current sync status
   */
  getStatus() {
    return {
      ...this.state,
      duration: this.state.startTime ? 
        (this.state.endTime || Date.now()) - this.state.startTime : 0
    };
  }

  /**
   * Start a sync process
   */
  startSync() {
    this.state = {
      running: true,
      currentStep: 'initializing',
      progress: 0,
      totalSteps: 0,
      error: null,
      output: [],
      startTime: Date.now(),
      endTime: null,
      lastUpdate: Date.now()
    };
    this.addOutput(`[${new Date().toISOString()}] Sync process started\n`);
  }

  /**
   * Stop the sync process
   */
  stopSync() {
    if (this.state.running) {
      this.state.running = false;
      this.state.currentStep = 'stopped';
      this.state.endTime = Date.now();
      this.state.lastUpdate = Date.now();
      this.addOutput(`[${new Date().toISOString()}] Sync process stopped\n`);
    }
  }

  /**
   * Mark sync as completed successfully
   */
  completeSync() {
    this.state.running = false;
    this.state.currentStep = 'completed';
    this.state.progress = this.state.totalSteps;
    this.state.endTime = Date.now();
    this.state.lastUpdate = Date.now();
    this.addOutput(`[${new Date().toISOString()}] Sync process completed successfully\n`);
  }

  /**
   * Mark sync as failed with error
   */
  errorSync(errorMessage) {
    this.state.running = false;
    this.state.currentStep = 'error';
    this.state.error = errorMessage;
    this.state.endTime = Date.now();
    this.state.lastUpdate = Date.now();
    this.addOutput(`[${new Date().toISOString()}] ERROR: ${errorMessage}\n`);
  }

  /**
   * Set the current step of the sync process
   */
  setCurrentStep(step) {
    this.state.currentStep = step;
    this.state.lastUpdate = Date.now();
  }

  /**
   * Update progress
   */
  updateProgress(current, total = null) {
    this.state.progress = current;
    if (total !== null) {
      this.state.totalSteps = total;
    }
    this.state.lastUpdate = Date.now();
  }

  /**
   * Add output message
   */
  addOutput(message) {
    this.state.output.push({
      timestamp: Date.now(),
      message: message
    });
    this.state.lastUpdate = Date.now();
    
    // Keep only last 1000 output messages to prevent memory issues
    if (this.state.output.length > 1000) {
      this.state.output = this.state.output.slice(-1000);
    }
  }

  /**
   * Clear output messages
   */
  clearOutput() {
    this.state.output = [];
    this.state.lastUpdate = Date.now();
  }

  /**
   * Reset the entire state
   */
  reset() {
    this.state = {
      running: false,
      currentStep: 'idle',
      progress: 0,
      totalSteps: 0,
      error: null,
      output: [],
      startTime: null,
      endTime: null,
      lastUpdate: Date.now()
    };
  }

  /**
   * Get formatted output as a string
   */
  getFormattedOutput() {
    return this.state.output
      .map(item => item.message)
      .join('');
  }

  /**
   * Get recent output (last N messages)
   */
  getRecentOutput(count = 10) {
    return this.state.output
      .slice(-count)
      .map(item => item.message)
      .join('');
  }
}

// Create a singleton instance
const syncStateManager = new SyncStateManager();

export default syncStateManager;
