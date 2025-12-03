import { Strategy as CasStrategy } from "@coursetable/passport-cas";

/**
 * Extended CAS Strategy that logs the validation response for debugging
 */
export class DebugCasStrategy extends CasStrategy {
  authenticate(req: any, options?: any) {
    // Intercept and log the response
    const originalRedirect = this.redirect.bind(this);
    const originalError = this.error.bind(this);
    const originalFail = this.fail.bind(this);

    this.redirect = function (url: string) {
      console.log("CAS redirect to:", url);
      return originalRedirect(url);
    };

    this.error = function (err: any) {
      console.error("CAS Strategy Error:", {
        message: err.message,
        cause: err.cause?.message,
        fullError: err
      });
      return originalError(err);
    };

    this.fail = function (challenge: any, status: any) {
      console.log("CAS Authentication Failed:", challenge);
      return originalFail(challenge, status);
    };

    // Call the parent authenticate method
    return super.authenticate(req, options);
  }
}
