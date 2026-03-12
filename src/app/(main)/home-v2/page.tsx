/**
 * Home V2 — 已禁用，重定向到旧首页
 *
 * home-v2 引入了编译问题，暂时禁用。
 * 所有组件代码保留在 src/components/home-v2/ 下，待问题修复后恢复。
 */

import { redirect } from "next/navigation";

export default function HomeV2Page() {
  redirect("/home");
}
