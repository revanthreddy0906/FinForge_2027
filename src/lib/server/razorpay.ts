import "server-only";
import { z } from "zod";
import { orderId, paymentEntitySchema, type PaymentEntity } from "@/lib/payments/schema";
import { razorpayEnv } from "./razorpay-env";

const DEFAULT_BASE = "https://api.razorpay.com";
const TIMEOUT_MS = 10_000;

export class RazorpayError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "RazorpayError";
  }
}

async function call(
  path: string,
  init: { method: "GET" | "POST"; body?: unknown },
): Promise<unknown> {
  const env = razorpayEnv();
  const auth = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString("base64");
  const res = await fetch(`${env.RAZORPAY_API_BASE ?? DEFAULT_BASE}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Basic ${auth}`,
      ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) {
    // Log the status and Razorpay's error code only; never the request (it holds personal data).
    const code = await res
      .json()
      .then(
        (b: unknown) =>
          z.object({ error: z.object({ code: z.string() }) }).safeParse(b).data?.error.code,
      )
      .catch(() => undefined);
    throw new RazorpayError(
      `Razorpay ${init.method} ${path.split("/")[2] ?? ""} failed: ${code ?? "unknown"}`,
      res.status,
    );
  }
  return res.json();
}

const orderSchema = z.object({
  id: orderId,
  amount: z.number().int(),
  currency: z.literal("INR"),
});

/** Creates an order. The receipt (our team reference) shows in the Razorpay dashboard. */
export async function createOrder(input: {
  amountPaise: number;
  receipt: string;
  notes: Record<string, string>;
}): Promise<z.infer<typeof orderSchema>> {
  const body = await call("/v1/orders", {
    method: "POST",
    body: {
      amount: input.amountPaise,
      currency: "INR",
      receipt: input.receipt,
      notes: input.notes,
    },
  });
  const order = orderSchema.parse(body);
  if (order.amount !== input.amountPaise) throw new RazorpayError("order amount differs", 502);
  return order;
}

export async function fetchPayment(id: string): Promise<PaymentEntity> {
  return paymentEntitySchema.parse(
    await call(`/v1/payments/${encodeURIComponent(id)}`, { method: "GET" }),
  );
}

/** Captures an authorized payment (only needed if auto-capture is off in the dashboard). */
export async function capturePayment(id: string, amountPaise: number): Promise<PaymentEntity> {
  return paymentEntitySchema.parse(
    await call(`/v1/payments/${encodeURIComponent(id)}/capture`, {
      method: "POST",
      body: { amount: amountPaise, currency: "INR" },
    }),
  );
}
