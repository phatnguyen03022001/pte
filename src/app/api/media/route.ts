import { createAuthenticatedMediaHandler } from "@/lib/media/endpoint-core";
import { resolveAuthenticatedQuestionMedia } from "@/lib/media/resolver";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handleMedia = createAuthenticatedMediaHandler({
  async authenticate() {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    return !error && Boolean(data.user?.id);
  },
  resolve: resolveAuthenticatedQuestionMedia,
});

export const GET = handleMedia;
export const HEAD = handleMedia;
