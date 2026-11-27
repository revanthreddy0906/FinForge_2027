"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  assignStatementByHand,
  setResultsPublished,
  setSelectionState,
  type AdminRpcError,
} from "@/lib/server/admin-statements";
import { requireConsole } from "@/lib/server/require-console";
import { RESULTS_TAG, STATUS_TAG } from "@/lib/server/statements";

z.config({ jitless: true });

const PAGE = "/admin/statements";

/** Which change finished, shown as a one-line notice after the redirect. */
export type DoneKey = "opened" | "closed" | "reset" | "published" | "unpublished" | "assigned";

function finish(error: AdminRpcError | null, done: DoneKey): never {
  if (error) redirect(`${PAGE}?error=${error}`);
  // The public pages read cached status and results: expire them so the change shows at once.
  updateTag(STATUS_TAG);
  updateTag(RESULTS_TAG);
  redirect(`${PAGE}?done=${done}`);
}

const confirmed = (fd: FormData) => fd.get("confirm") === "yes";

const stateSchema = z.enum(["not_open", "open", "closed"]);

export async function setStateAction(formData: FormData): Promise<void> {
  const { accessToken } = await requireConsole(PAGE);
  const parsed = stateSchema.safeParse(formData.get("state"));
  if (!parsed.success) redirect(`${PAGE}?error=invalid_input`);
  // Opening and closing change what teams can do, so each needs the "I'm sure" box.
  if (parsed.data !== "not_open" && !confirmed(formData)) redirect(`${PAGE}?error=not_confirmed`);
  const error = await setSelectionState(accessToken, parsed.data);
  finish(error, parsed.data === "open" ? "opened" : parsed.data === "closed" ? "closed" : "reset");
}

export async function setPublishedAction(formData: FormData): Promise<void> {
  const { accessToken } = await requireConsole(PAGE);
  const publish = formData.get("published") === "true";
  if (publish && !confirmed(formData)) redirect(`${PAGE}?error=not_confirmed`);
  const error = await setResultsPublished(accessToken, publish);
  finish(error, publish ? "published" : "unpublished");
}

const assignSchema = z.object({
  reference: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^FF27-\d{4}$/),
  statement: z.coerce.number().int().min(1).max(4),
});

export async function assignAction(formData: FormData): Promise<void> {
  const { accessToken } = await requireConsole(PAGE);
  const parsed = assignSchema.safeParse({
    reference: formData.get("reference"),
    statement: formData.get("statement"),
  });
  if (!parsed.success) redirect(`${PAGE}?error=invalid_input`);
  const error = await assignStatementByHand(
    accessToken,
    parsed.data.reference,
    parsed.data.statement,
  );
  finish(error, "assigned");
}
