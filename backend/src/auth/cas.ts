import passport from "passport";
import { PrismaClient } from "@prisma/client";
const CasStrategy = require("@coursetable/passport-cas").Strategy;

const prisma = new PrismaClient();

// Create a custom CAS strategy with better debugging
const casOptions = {
  version: "CAS2.0",
  ssoBaseURL: "https://secure-tst.its.yale.edu/cas",
  serverBaseURL: process.env.SERVER_BASE_URL || "http://localhost:3000",
  // Don't set callbackURL - let the library derive it from the request
  // callbackURL is automatically constructed as: serverBaseURL + current request path
};

console.log("CAS Strategy Configuration:", {
  ...casOptions,
  ssoBaseURL: casOptions.ssoBaseURL, // Log the full path
});

// Configure CAS strategy
passport.use(
  new CasStrategy(
    casOptions,
    async (profile: any, done: any) => {
      try {
        // Extract NetID from CAS profile
        // Profile can have different structures depending on CAS version
        const netId = profile.user || profile.nameidentifier;

        if (!netId) {
          console.error("No NetID found in CAS profile:", JSON.stringify(profile));
          return done(null, false, { message: "No NetID from CAS" });
        }

        console.log("CAS authentication successful for NetID:", netId);

        // Create or update user in database
        const user = await prisma.user.upsert({
          where: { netId },
          update: { updatedAt: new Date() },
          create: {
            netId,
            role: "customer",
          },
        });

        return done(null, {
          netId: user.netId,
          name: user.name,
          role: user.role,
        });
      } catch (error) {
        console.error("CAS verification error:", error);
        return done(error);
      }
    }
  )
);

// Serialize user for session
passport.serializeUser((user: any, done) => {
  done(null, user.netId);
});

// Deserialize user from session
passport.deserializeUser(async (netId: string, done) => {
  try {
    const user = await prisma.user.findUnique({
      where: { netId },
    });
    done(null, user ? { netId: user.netId, name: user.name, role: user.role } : null);
  } catch (error) {
    done(error);
  }
});

export default passport;
