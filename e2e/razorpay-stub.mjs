// Local stand-in for the parts of the Razorpay API the server calls, for the e2e tests only.
// The app reaches it through RAZORPAY_API_BASE (ignored on Vercel). Test hooks under /test/
// play the part of the checkout pop-up: they "pay" an order and return Razorpay's signed result.
import { createHmac, randomBytes } from "node:crypto";
import { createServer } from "node:http";

const PORT = Number(process.env.RAZORPAY_STUB_PORT ?? 3199);
const KEY_ID = process.env.RAZORPAY_KEY_ID ?? "";
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET ?? "";

const orders = new Map();
const payments = new Map();
const id = (prefix) => `${prefix}_${randomBytes(7).toString("hex").slice(0, 14)}`;

function send(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

const error = (res, status, code) => send(res, status, { error: { code, description: code } });

async function readJson(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

function authorized(req) {
  const expected = `Basic ${Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString("base64")}`;
  return req.headers.authorization === expected;
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${String(PORT)}`);
    const path = url.pathname;
    if (path === "/health") return send(res, 200, { ok: true });

    if (path === "/test/pay" && req.method === "POST") {
      const { order_id: orderId } = await readJson(req);
      const order = orders.get(orderId);
      if (!order) return error(res, 404, "BAD_REQUEST_ERROR");
      const payment = {
        id: id("pay"),
        entity: "payment",
        order_id: orderId,
        amount: order.amount,
        currency: "INR",
        status: "captured",
      };
      payments.set(payment.id, payment);
      const signature = createHmac("sha256", KEY_SECRET)
        .update(`${orderId}|${payment.id}`)
        .digest("hex");
      return send(res, 200, {
        razorpay_order_id: orderId,
        razorpay_payment_id: payment.id,
        razorpay_signature: signature,
      });
    }

    if (!authorized(req)) return error(res, 401, "BAD_REQUEST_ERROR");

    if (path === "/v1/orders" && req.method === "POST") {
      const body = await readJson(req);
      const order = {
        id: id("order"),
        entity: "order",
        amount: body.amount,
        currency: "INR",
        status: "created",
        receipt: body.receipt,
      };
      orders.set(order.id, order);
      return send(res, 200, order);
    }
    const match = /^\/v1\/payments\/([^/]+)(\/capture)?$/.exec(path);
    if (match) {
      const payment = payments.get(decodeURIComponent(match[1]));
      if (!payment) return error(res, 400, "BAD_REQUEST_ERROR");
      if (match[2] && req.method === "POST") payment.status = "captured";
      return send(res, 200, payment);
    }
    return error(res, 404, "NOT_FOUND");
  } catch {
    return error(res, 500, "SERVER_ERROR");
  }
}).listen(PORT, "127.0.0.1");
