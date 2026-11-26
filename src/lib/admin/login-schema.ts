import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .pipe(z.email({ error: "Enter the email address of your organizer account." })),
  password: z
    .string()
    .min(1, { error: "Enter your password." })
    .max(256, { error: "That password is too long." }),
});

export const codeSchema = z.object({
  factorId: z.uuid(),
  code: z
    .string()
    .transform((v) => v.replace(/\s+/g, ""))
    .pipe(
      z.string().regex(/^\d{6}$/, { error: "Enter the 6-digit code from your authenticator app." }),
    ),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type CodeInput = z.infer<typeof codeSchema>;
