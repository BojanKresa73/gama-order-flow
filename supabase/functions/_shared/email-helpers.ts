/**
 * Email helpers - now redirects to SMTP implementation
 * All email sending goes through Gmail SMTP via smtp-helpers.ts
 */
import { 
  sendDeliveryNoteEmail as sendDeliveryNoteEmailSMTP, 
  sendWorkOrderArchiveEmail as sendWorkOrderArchiveEmailSMTP, 
  retryWithBackoff as retryWithBackoffSMTP 
} from "./smtp-helpers.ts";

/**
 * Re-export functions from smtp-helpers.ts
 * This ensures backward compatibility while using Gmail SMTP
 */
export const sendDeliveryNoteEmail = sendDeliveryNoteEmailSMTP;
export const sendWorkOrderArchiveEmail = sendWorkOrderArchiveEmailSMTP;
export const retryWithBackoff = retryWithBackoffSMTP;
