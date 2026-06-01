import { supabase } from "../supabase/client";

type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

export const lovable = {
  auth: {
    signInWithOAuth: async (provider: "google" | "apple" | "microsoft", opts?: SignInOptions) => {
      const options: Parameters<typeof supabase.auth.signInWithOAuth>[0] = {
        provider,
        options: {},
      };

      if (opts?.redirect_uri) {
        options.options!.redirectTo = opts.redirect_uri;
      }

      if (opts?.extraParams && Object.keys(opts.extraParams).length > 0) {
        options.options!.queryParams = opts.extraParams;
      }

      const { data, error } = await supabase.auth.signInWithOAuth(options);

      if (error) {
        return { error: new Error(String(error.message)) };
      }

      // If supabase returned a URL but didn't handle the redirect automatically,
      // we need to redirect manually (redirect flow instead of popup)
      if (data?.url) {
        window.location.href = data.url;
        return { error: null, redirected: true };
      }

      // Popup flow was handled by supabase SDK successfully
      return { error: null };
    },
  },
};
