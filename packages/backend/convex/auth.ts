import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

/**
 * Convex Auth setup — password provider only (self-hosted, "save it on our
 * own", per PLAN open-question default). No external identity provider.
 *
 * Role bootstrapping: the very first account created becomes `it_admin` so the
 * deployment is usable out of the box; everyone after defaults to `viewer` and
 * must be promoted by an admin. See `afterUserCreatedOrUpdated`.
 */
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password],
  callbacks: {
    async afterUserCreatedOrUpdated(ctx, { userId, existingUserId }) {
      // Only act on first creation, not on subsequent sign-ins/updates.
      if (existingUserId) return;

      // Count existing users. If this is the only one, make them it_admin.
      const users = await ctx.db.query("users").take(2);
      const isFirstUser = users.length <= 1;
      await ctx.db.patch(userId, {
        role: isFirstUser ? "it_admin" : "viewer",
      });
    },
  },
});
