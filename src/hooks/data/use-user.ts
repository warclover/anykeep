/**
 * Re-export useUser from user-context for convenience
 * This allows importing from either:
 * - @/hooks/use-user (this file)
 * - @/contexts/user-context (original location)
 */

export { useUser } from "@/contexts/user-context";
