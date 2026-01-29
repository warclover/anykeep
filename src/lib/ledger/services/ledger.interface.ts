import type { LedgerResult, LedgerType } from "../types/ledger.types";

export interface LedgerGenerator {
  /**
   * 生成账本
   * @param userId 用户ID
   * @param startDate 开始日期
   * @param endDate 结束日期
   */
  generate(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<LedgerResult>;

  /**
   * 获取账本类型
   */
  getType(): LedgerType;
}
