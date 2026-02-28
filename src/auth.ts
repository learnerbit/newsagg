import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";

// 1. Tell TypeScript that 'role' is a valid property
declare module "next-auth" {
  interface Session {
    user: {
      role?: string;
    } & DefaultSession["user"];
  }

  interface User {
    role?: string;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  callbacks: {
    async session({ session, token }) {
      // 🛡️ Admin Check logic
      const adminEmail = "suhithjob@gmail.com"; // 👈 REPLACE with your email
      
      if (session.user) {
        if (session.user.email === adminEmail) {
          session.user.role = "admin";
          
        } else {
          session.user.role = "user";
        }
      }
      return session;
    },
  },
});