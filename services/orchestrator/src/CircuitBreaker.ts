export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  monitoringPeriod: number;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private successes: number = 0;
  private nextAttempt: number = Date.now();
  private config: CircuitBreakerConfig;
  private providerName: string;

  constructor(providerName: string, config?: Partial<CircuitBreakerConfig>) {
    this.providerName = providerName;
    this.config = {
      failureThreshold: config?.failureThreshold || 5,
      successThreshold: config?.successThreshold || 2,
      timeout: config?.timeout || 30000,
      monitoringPeriod: config?.monitoringPeriod || 60000
    };
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttempt) {
        throw new Error(`[CircuitBreaker] ${this.providerName} circuit is OPEN. Failing fast.`);
      }
      console.log(`[CircuitBreaker] ${this.providerName} attempting recovery (HALF_OPEN)`);
      this.state = CircuitState.HALF_OPEN;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successes++;
      if (this.successes >= this.config.successThreshold) {
        console.log(`[CircuitBreaker] ${this.providerName} circuit CLOSED (recovered)`);
        this.state = CircuitState.CLOSED;
        this.successes = 0;
      }
    }
  }

  private onFailure(): void {
    this.failures++;
    this.successes = 0;

    if (this.failures >= this.config.failureThreshold) {
      console.log(`[CircuitBreaker] ${this.providerName} circuit OPEN (too many failures: ${this.failures})`);
      this.state = CircuitState.OPEN;
      this.nextAttempt = Date.now() + this.config.timeout;
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  isOpen(): boolean {
    return this.state === CircuitState.OPEN && Date.now() < this.nextAttempt;
  }

  reset(): void {
    console.log(`[CircuitBreaker] ${this.providerName} manually reset`);
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.nextAttempt = Date.now();
  }

  getMetrics() {
    return {
      provider: this.providerName,
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      nextAttempt: this.state === CircuitState.OPEN ? new Date(this.nextAttempt).toISOString() : null
    };
  }
}
