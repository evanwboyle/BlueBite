declare module 'passport-cas' {
  import { Strategy as PassportStrategy } from 'passport';

  interface CasStrategyOptions {
    version?: 'CAS1.0' | 'CAS2.0' | 'CAS3.0';
    ssoBaseURL: string;
  }

  interface CasProfile {
    user: string;
    [key: string]: any;
  }

  export class Strategy extends PassportStrategy {
    constructor(
      options: CasStrategyOptions,
      verify: (profile: CasProfile, done: (err: any, user?: any, info?: any) => void) => void
    );
    name: string;
  }
}
