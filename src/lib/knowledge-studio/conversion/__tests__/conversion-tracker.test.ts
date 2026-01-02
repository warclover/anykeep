/**
 * ConversionTracker 单元测试
 * @module knowledge-studio/conversion/__tests__
 */

import {
  ConversionTracker,
  calculateRemainingDays,
  isTrialExpiring,
  isTrialExpired,
  getNextReminderDay,
} from "../conversion-tracker";
import { DEFAULT_TRIAL_CONFIG } from "../types";

// Mock Supabase client
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
}));

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe("ConversionTracker", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("constructor", () => {
    it("should create instance with default config", () => {
      const instance = new ConversionTracker();
      expect(instance).toBeInstanceOf(ConversionTracker);
    });

    it("should create instance with custom config", () => {
      const customConfig = {
        ...DEFAULT_TRIAL_CONFIG,
        durationDays: 14,
      };
      const instance = new ConversionTracker(customConfig);
      expect(instance).toBeInstanceOf(ConversionTracker);
    });
  });
});

describe("calculateRemainingDays", () => {
  it("should return positive days for future date", () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 5);
    const remaining = calculateRemainingDays(futureDate);
    expect(remaining).toBe(5);
  });

  it("should return 0 for past date", () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 5);
    const remaining = calculateRemainingDays(pastDate);
    expect(remaining).toBe(0);
  });

  it("should return 1 for date tomorrow", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59);
    const remaining = calculateRemainingDays(tomorrow);
    expect(remaining).toBeGreaterThanOrEqual(1);
    expect(remaining).toBeLessThanOrEqual(2);
  });
});

describe("isTrialExpiring", () => {
  it("should return true for trial expiring within threshold", () => {
    const expiresIn2Days = new Date();
    expiresIn2Days.setDate(expiresIn2Days.getDate() + 2);
    expect(isTrialExpiring(expiresIn2Days, 3)).toBe(true);
  });

  it("should return false for trial not expiring within threshold", () => {
    const expiresIn5Days = new Date();
    expiresIn5Days.setDate(expiresIn5Days.getDate() + 5);
    expect(isTrialExpiring(expiresIn5Days, 3)).toBe(false);
  });

  it("should use default threshold of 3 days", () => {
    const expiresIn2Days = new Date();
    expiresIn2Days.setDate(expiresIn2Days.getDate() + 2);
    expect(isTrialExpiring(expiresIn2Days)).toBe(true);
  });
});

describe("isTrialExpired", () => {
  it("should return true for expired trial", () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);
    expect(isTrialExpired(pastDate)).toBe(true);
  });

  it("should return false for active trial", () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 5);
    expect(isTrialExpired(futureDate)).toBe(false);
  });
});

describe("getNextReminderDay", () => {
  const reminderDays = [7, 3, 1];

  it("should return 7 when remaining > 7", () => {
    expect(getNextReminderDay(10, reminderDays)).toBe(7);
  });

  it("should return 3 when remaining is between 3 and 7", () => {
    expect(getNextReminderDay(5, reminderDays)).toBe(3);
  });

  it("should return 1 when remaining is between 1 and 3", () => {
    expect(getNextReminderDay(2, reminderDays)).toBe(1);
  });

  it("should return null when remaining <= 1", () => {
    expect(getNextReminderDay(1, reminderDays)).toBe(null);
  });

  it("should use default reminder days", () => {
    // DEFAULT_TRIAL_CONFIG.reminderDays = [3, 1, 0]
    // For remainingDays=10, next reminder is 3 (highest < 10)
    expect(getNextReminderDay(10)).toBe(3);
  });
});
