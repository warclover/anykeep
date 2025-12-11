/**
 * Confirmation Module Exports
 * V4.2 待确认消息模块
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

export {
  confirmationService,
  type CreateClassificationConfirmationInput,
  type CreateFolderConfirmationInput,
  type ConfirmationResponse,
  type ExpirationResult,
} from "./confirmation.service";

export {
  confirmationRepository,
  type ConfirmationQueryFilters,
} from "./confirmation.repository";

// Expiry Cron
export {
  confirmationExpiryCron,
  handleCronRequest,
  getCronHealthStatus,
} from "./confirmation-expiry.cron";

export type {
  CronExecutionResult,
  CronConfig,
} from "./confirmation-expiry.cron";
