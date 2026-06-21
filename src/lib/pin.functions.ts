import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const hasPin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("user_pins")
      .select("user_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    return { hasPin: !!data };
  });

const pinSchema = z.object({ pin: z.string().regex(/^\d{4}$/, "PIN must be 4 digits") });
const changeSchema = z.object({
  oldPin: z.string().regex(/^\d{4}$/),
  newPin: z.string().regex(/^\d{4}$/),
});

export const setPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => pinSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { hashPin } = await import("./pin.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await context.supabase
      .from("user_pins").select("user_id").eq("user_id", context.userId).maybeSingle();
    if (existing) throw new Error("PIN already set. Use change PIN instead.");
    const pin_hash = await hashPin(data.pin);
    const { error } = await supabaseAdmin
      .from("user_pins")
      .insert({ user_id: context.userId, pin_hash });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const changePin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => changeSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { hashPin, verifyPin } = await import("./pin.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("user_pins").select("pin_hash").eq("user_id", context.userId).maybeSingle();
    if (!row) throw new Error("No PIN set");
    const ok = await verifyPin(data.oldPin, row.pin_hash);
    if (!ok) throw new Error("Incorrect current PIN");
    const pin_hash = await hashPin(data.newPin);
    await supabaseAdmin
      .from("user_pins")
      .update({ pin_hash, failed_attempts: 0, locked_until: null })
      .eq("user_id", context.userId);
    return { ok: true };
  });

/** Verify PIN. Returns true/false. Also records failed attempts and locks after 5. */
export async function verifyUserPinServer(userId: string, pin: string): Promise<boolean> {
  const { verifyPin } = await import("./pin.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row } = await supabaseAdmin
    .from("user_pins")
    .select("pin_hash, failed_attempts, locked_until")
    .eq("user_id", userId)
    .maybeSingle();
  if (!row) throw new Error("PIN not set. Please set a transaction PIN first.");
  if (row.locked_until && new Date(row.locked_until) > new Date()) {
    throw new Error("PIN temporarily locked. Try again later.");
  }
  const ok = await verifyPin(pin, row.pin_hash);
  if (!ok) {
    const attempts = (row.failed_attempts ?? 0) + 1;
    const update: any = { failed_attempts: attempts };
    if (attempts >= 5) {
      update.locked_until = new Date(Date.now() + 15 * 60_000).toISOString();
      update.failed_attempts = 0;
    }
    await supabaseAdmin.from("user_pins").update(update).eq("user_id", userId);
    return false;
  }
  if ((row.failed_attempts ?? 0) > 0) {
    await supabaseAdmin.from("user_pins").update({ failed_attempts: 0 }).eq("user_id", userId);
  }
  return true;
}
