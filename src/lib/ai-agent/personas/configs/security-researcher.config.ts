/**
 * 安全研究员画像配置
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import type { PersonaConfig } from "../types";
import { DEFAULT_PERSONA_PREFERENCES } from "../types";

/**
 * 安全研究员画像配置
 */
export const SECURITY_RESEARCHER_CONFIG: PersonaConfig = {
  id: "security_researcher",
  group: "tech",
  name: "安全研究员",
  icon: "🔐",
  description: "网络安全研究者，专注漏洞研究和安全防护",

  behaviorSignals: {
    tagPatterns: [
      /CVE|漏洞|exploit|vulnerability/i,
      /渗透|pentest|红队|攻防/i,
      /安全|security|恶意|malware/i,
      /逆向|reverse|分析|audit/i,
      /0day|POC|shellcode|提权/i,
    ],
    platformPreferences: [
      "GitHub",
      "Exploit-DB",
      "Seebug",
      "FreeBuf",
      "安全客",
      "先知社区",
    ],
    contentTypes: ["漏洞分析", "POC代码", "安全研究", "工具教程", "威胁情报"],
    folderPatterns: [/漏洞/, /安全/, /攻防/, /工具/, /情报/],
    domainPatterns: [
      /exploit-db\.com/,
      /seebug\.org/,
      /freebuf\.com/,
      /xz\.aliyun\.com/,
    ],
  },

  intentBoosts: {
    vulnerability_tracking: 1.9,
    tech_compare: 1.5,
    paper_tracking: 1.4,
    find_related: 1.3,
    theme_organize: 1.2,
  },

  promptKey: "tech.security_researcher",

  defaultPreferences: {
    ...DEFAULT_PERSONA_PREFERENCES,
    responseStyle: "detailed",
    proactiveReminders: true,
    codeBlocks: true,
    emojiStyle: "none",
  },
};
