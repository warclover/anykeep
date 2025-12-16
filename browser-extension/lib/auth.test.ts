/**
 * Auth Module Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { auth } from "./auth";
import { setMockStorageData, resetMockStorage } from "../test/mocks/browser";

describe("auth", () => {
  beforeEach(() => {
    resetMockStorage();
    vi.clearAllMocks();
  });

  describe("isLoggedIn", () => {
    it("should return false when no token", async () => {
      const result = await auth.isLoggedIn();
      expect(result).toBe(false);
    });

    it("should return false when no userId", async () => {
      setMockStorageData({ authToken: "some-token" });

      const result = await auth.isLoggedIn();
      expect(result).toBe(false);
    });

    it("should return true when both token and userId exist", async () => {
      setMockStorageData({
        authToken: "valid-token",
        userId: "user-123",
      });

      const result = await auth.isLoggedIn();
      expect(result).toBe(true);
    });
  });

  describe("isTokenExpired", () => {
    it("should return true when no token", async () => {
      const result = await auth.isTokenExpired();
      expect(result).toBe(true);
    });

    it("should return false when token exists without expiry", async () => {
      setMockStorageData({ authToken: "token-no-expiry" });

      const result = await auth.isTokenExpired();
      expect(result).toBe(false);
    });

    it("should return false when token not expired", async () => {
      const futureTime = Date.now() + 60 * 60 * 1000; // 1 hour from now
      setMockStorageData({
        authToken: "valid-token",
        tokenExpiresAt: futureTime,
      });

      const result = await auth.isTokenExpired();
      expect(result).toBe(false);
    });

    it("should return true when token expired", async () => {
      const pastTime = Date.now() - 60 * 1000; // 1 minute ago
      setMockStorageData({
        authToken: "expired-token",
        tokenExpiresAt: pastTime,
      });

      const result = await auth.isTokenExpired();
      expect(result).toBe(true);
    });

    it("should return true when token about to expire (within 5 min buffer)", async () => {
      const almostExpired = Date.now() + 3 * 60 * 1000; // 3 minutes from now (within 5 min buffer)
      setMockStorageData({
        authToken: "expiring-token",
        tokenExpiresAt: almostExpired,
      });

      const result = await auth.isTokenExpired();
      expect(result).toBe(true);
    });
  });

  describe("getStatus", () => {
    it("should return loggedOut when not logged in", async () => {
      const result = await auth.getStatus();
      expect(result).toBe("loggedOut");
    });

    it("should return loggedIn when logged in with valid token", async () => {
      const futureTime = Date.now() + 60 * 60 * 1000;
      setMockStorageData({
        authToken: "valid-token",
        userId: "user-123",
        tokenExpiresAt: futureTime,
      });

      const result = await auth.getStatus();
      expect(result).toBe("loggedIn");
    });

    it("should return expired when logged in but token expired", async () => {
      const pastTime = Date.now() - 60 * 1000;
      setMockStorageData({
        authToken: "expired-token",
        userId: "user-123",
        tokenExpiresAt: pastTime,
      });

      const result = await auth.getStatus();
      expect(result).toBe("expired");
    });
  });

  describe("getAuth", () => {
    it("should return null when not logged in", async () => {
      const result = await auth.getAuth();
      expect(result).toBeNull();
    });

    it("should return auth info when logged in", async () => {
      const expiresAt = Date.now() + 60 * 60 * 1000;
      setMockStorageData({
        authToken: "my-token",
        userId: "my-user",
        tokenExpiresAt: expiresAt,
      });

      const result = await auth.getAuth();
      expect(result).toEqual({
        token: "my-token",
        userId: "my-user",
        expiresAt: expiresAt,
      });
    });
  });

  describe("setAuth", () => {
    it("should store auth info with default expiry", async () => {
      const beforeTime = Date.now();

      await auth.setAuth("new-token", "new-user");

      const afterTime = Date.now();
      const authInfo = await auth.getAuth();

      expect(authInfo).not.toBeNull();
      expect(authInfo!.token).toBe("new-token");
      expect(authInfo!.userId).toBe("new-user");
      // Default expiry is 7 days
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      expect(authInfo!.expiresAt).toBeGreaterThanOrEqual(
        beforeTime + sevenDays - 1000,
      );
      expect(authInfo!.expiresAt).toBeLessThanOrEqual(
        afterTime + sevenDays + 1000,
      );
    });

    it("should store auth info with custom expiry", async () => {
      const beforeTime = Date.now();
      const expiresIn = 3600; // 1 hour in seconds

      await auth.setAuth("custom-token", "custom-user", expiresIn);

      const afterTime = Date.now();
      const authInfo = await auth.getAuth();

      expect(authInfo).not.toBeNull();
      expect(authInfo!.expiresAt).toBeGreaterThanOrEqual(
        beforeTime + expiresIn * 1000 - 1000,
      );
      expect(authInfo!.expiresAt).toBeLessThanOrEqual(
        afterTime + expiresIn * 1000 + 1000,
      );
    });
  });

  describe("logout", () => {
    it("should clear auth info", async () => {
      setMockStorageData({
        authToken: "token-to-clear",
        userId: "user-to-clear",
        tokenExpiresAt: Date.now() + 60000,
      });

      await auth.logout();

      const isLoggedIn = await auth.isLoggedIn();
      expect(isLoggedIn).toBe(false);
    });
  });

  describe("getApiUrl", () => {
    it("should return default API URL", async () => {
      const result = await auth.getApiUrl();
      expect(result).toBe("https://anykeep.vercel.app");
    });

    it("should return custom API URL", async () => {
      setMockStorageData({ apiUrl: "https://custom.api.com" });

      const result = await auth.getApiUrl();
      expect(result).toBe("https://custom.api.com");
    });
  });

  describe("setApiUrl", () => {
    it("should set custom API URL", async () => {
      await auth.setApiUrl("https://new.api.com");

      const result = await auth.getApiUrl();
      expect(result).toBe("https://new.api.com");
    });
  });

  describe("getAuthHeader", () => {
    it("should return null when not logged in", async () => {
      const result = await auth.getAuthHeader();
      expect(result).toBeNull();
    });

    it("should return Authorization header when logged in", async () => {
      setMockStorageData({
        authToken: "bearer-token",
        userId: "user-id",
      });

      const result = await auth.getAuthHeader();
      expect(result).toEqual({
        Authorization: "Bearer bearer-token",
      });
    });
  });
});
