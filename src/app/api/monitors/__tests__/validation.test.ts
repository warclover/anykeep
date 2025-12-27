/**
 * 监控 API 验证 Schema 单元测试
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import {
  createMonitorSchema,
  updateMonitorSchema,
  listMonitorsQuerySchema,
} from "../validation";

describe("monitors API validation", () => {
  describe("createMonitorSchema", () => {
    it("应该验证有效的创建请求", () => {
      const validData = {
        bookmarkId: 123,
        checkInterval: "daily",
        notificationEnabled: true,
      };

      const result = createMonitorSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.bookmarkId).toBe(123);
        expect(result.data.checkInterval).toBe("daily");
        expect(result.data.notificationEnabled).toBe(true);
      }
    });

    it("应该使用默认值填充缺失字段", () => {
      const minimalData = {
        bookmarkId: 123,
      };

      const result = createMonitorSchema.safeParse(minimalData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.checkInterval).toBe("daily");
        expect(result.data.notificationEnabled).toBe(true);
      }
    });

    it("应该拒绝无效的书签 ID", () => {
      const invalidData = {
        bookmarkId: -1,
      };

      const result = createMonitorSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("应该拒绝无效的检查间隔", () => {
      const invalidData = {
        bookmarkId: 123,
        checkInterval: "invalid",
      };

      const result = createMonitorSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("应该验证自定义间隔小时数范围", () => {
      // 有效范围
      const validCustom = {
        bookmarkId: 123,
        checkInterval: "custom",
        customIntervalHours: 48,
      };
      expect(createMonitorSchema.safeParse(validCustom).success).toBe(true);

      // 过小
      const tooSmall = {
        bookmarkId: 123,
        checkInterval: "custom",
        customIntervalHours: 0,
      };
      expect(createMonitorSchema.safeParse(tooSmall).success).toBe(false);

      // 过大
      const tooLarge = {
        bookmarkId: 123,
        checkInterval: "custom",
        customIntervalHours: 1000,
      };
      expect(createMonitorSchema.safeParse(tooLarge).success).toBe(false);
    });

    it("应该接受所有有效的检查间隔选项", () => {
      const intervals = [
        "every_6h",
        "twice_daily",
        "daily",
        "weekly",
        "custom",
      ];

      for (const interval of intervals) {
        const data = {
          bookmarkId: 123,
          checkInterval: interval,
        };
        const result = createMonitorSchema.safeParse(data);
        expect(result.success).toBe(true);
      }
    });
  });

  describe("updateMonitorSchema", () => {
    it("应该验证有效的更新请求", () => {
      const validData = {
        checkInterval: "weekly",
        notificationEnabled: false,
      };

      const result = updateMonitorSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("应该允许空对象（无更新）", () => {
      const emptyData = {};

      const result = updateMonitorSchema.safeParse(emptyData);
      expect(result.success).toBe(true);
    });

    it("应该允许只更新单个字段", () => {
      const singleField = {
        notificationEnabled: false,
      };

      const result = updateMonitorSchema.safeParse(singleField);
      expect(result.success).toBe(true);
    });

    it("应该拒绝无效的检查间隔", () => {
      const invalidData = {
        checkInterval: "invalid",
      };

      const result = updateMonitorSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe("listMonitorsQuerySchema", () => {
    it("应该验证有效的查询参数", () => {
      const validQuery = {
        status: "active",
        limit: 20,
        offset: 0,
      };

      const result = listMonitorsQuerySchema.safeParse(validQuery);
      expect(result.success).toBe(true);
    });

    it("应该使用默认值填充缺失参数", () => {
      const emptyQuery = {};

      const result = listMonitorsQuerySchema.safeParse(emptyQuery);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe("all");
        expect(result.data.limit).toBe(50);
        expect(result.data.offset).toBe(0);
      }
    });

    it("应该接受所有有效的状态选项", () => {
      const statuses = ["all", "active", "paused", "failed"];

      for (const status of statuses) {
        const query = { status };
        const result = listMonitorsQuerySchema.safeParse(query);
        expect(result.success).toBe(true);
      }
    });

    it("应该拒绝无效的状态", () => {
      const invalidQuery = {
        status: "invalid",
      };

      const result = listMonitorsQuerySchema.safeParse(invalidQuery);
      expect(result.success).toBe(false);
    });

    it("应该限制 limit 范围", () => {
      // 有效范围
      expect(listMonitorsQuerySchema.safeParse({ limit: 1 }).success).toBe(
        true,
      );
      expect(listMonitorsQuerySchema.safeParse({ limit: 100 }).success).toBe(
        true,
      );

      // 过小
      expect(listMonitorsQuerySchema.safeParse({ limit: 0 }).success).toBe(
        false,
      );

      // 过大
      expect(listMonitorsQuerySchema.safeParse({ limit: 101 }).success).toBe(
        false,
      );
    });

    it("应该验证 offset 非负", () => {
      expect(listMonitorsQuerySchema.safeParse({ offset: 0 }).success).toBe(
        true,
      );
      expect(listMonitorsQuerySchema.safeParse({ offset: 100 }).success).toBe(
        true,
      );
      expect(listMonitorsQuerySchema.safeParse({ offset: -1 }).success).toBe(
        false,
      );
    });

    it("应该处理字符串类型的数字（coerce）", () => {
      const stringNumbers = {
        limit: "25",
        offset: "10",
      };

      const result = listMonitorsQuerySchema.safeParse(stringNumbers);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(25);
        expect(result.data.offset).toBe(10);
      }
    });
  });
});
