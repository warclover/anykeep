/**
 * 解析器注册表
 *
 * 策略模式: 根据 URL 自动匹配最合适的平台解析器
 * 无匹配时回退到 GenericParser
 *
 * @version 1.0.0
 * @since 2026-03-07
 */

import { logger } from "@/lib/logger";
import type { IPlatformParser } from "./parser.interface";
import { WechatParser } from "./wechat.parser";
import { BilibiliParser } from "./bilibili.parser";
import { XiaohongshuParser } from "./xiaohongshu.parser";
import { ZhihuParser } from "./zhihu.parser";
import { GenericParser } from "./generic.parser";

/**
 * 平台解析器注册表
 *
 * 管理所有已注册的解析器，提供 URL 匹配和解析器查找功能
 */
class ParserRegistry {
  /** 已注册的解析器列表（不含通用解析器） */
  private parsers: IPlatformParser[] = [];

  /** 通用兜底解析器 */
  private readonly fallbackParser: IPlatformParser = GenericParser;

  /**
   * 注册一个平台解析器
   */
  register(parser: IPlatformParser): void {
    // 避免重复注册
    if (this.parsers.some((p) => p.name === parser.name)) {
      logger.warn({ parserName: parser.name }, "解析器注册表: 跳过重复注册");
      return;
    }

    this.parsers.push(parser);
    logger.debug(
      {
        parserName: parser.name,
        domains: parser.supportedDomains,
      },
      "解析器注册表: 注册成功",
    );
  }

  /**
   * 根据 URL 查找匹配的解析器
   *
   * 按注册顺序遍历，第一个匹配的解析器即返回
   * 无匹配时回退到 GenericParser
   */
  findParser(url: string): IPlatformParser {
    for (const parser of this.parsers) {
      if (parser.canParse(url)) {
        logger.debug(
          { url, parserName: parser.name },
          "解析器注册表: 匹配到平台解析器",
        );
        return parser;
      }
    }

    logger.debug({ url }, "解析器注册表: 无匹配，使用通用解析器");
    return this.fallbackParser;
  }

  /**
   * 获取所有已注册的解析器名称
   */
  getRegisteredNames(): string[] {
    return this.parsers.map((p) => p.name);
  }

  /**
   * 获取已注册的解析器数量（不含通用解析器）
   */
  get size(): number {
    return this.parsers.length;
  }
}

/** 单例实例 */
let registryInstance: ParserRegistry | null = null;

/**
 * 获取解析器注册表单例
 *
 * 首次调用时自动注册所有内置解析器
 */
export function getParserRegistry(): ParserRegistry {
  if (!registryInstance) {
    registryInstance = new ParserRegistry();

    // 注册内置平台解析器
    registryInstance.register(WechatParser);
    registryInstance.register(BilibiliParser);
    registryInstance.register(XiaohongshuParser);
    registryInstance.register(ZhihuParser);

    logger.info({ count: registryInstance.size }, "解析器注册表: 初始化完成");
  }

  return registryInstance;
}
