import express from "express";
import cors from "cors";
import "dotenv/config";
import connectDB from "./configs/db.js";
import { clerkMiddleware } from "@clerk/express";
import { serve } from "inngest/express";
import { inngest, functions } from "./inngest/index.js";
import { Webhook } from "svix";

const app = express();
const port = 3000;

await connectDB();

app.use(cors());

// 1. Webhook рутерът ТРЯБВА да е преди express.json()
app.post(
  "/api/webhooks/clerk",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const SIGNING_SECRET = process.env.CLERK_WEBHOOK_SECRET;

    if (!SIGNING_SECRET) {
      return res.status(400).json({ error: "Missing CLERK_WEBHOOK_SECRET" });
    }

    const payload = req.body;
    const headers = req.headers;

    const wh = new Webhook(SIGNING_SECRET);
    let evt;

    try {
      evt = wh.verify(payload, {
        "svix-id": headers["svix-id"],
        "svix-timestamp": headers["svix-timestamp"],
        "svix-signature": headers["svix-signature"],
      });
    } catch (err) {
      console.error("Webhook Verification Error:", err.message);
      return res.status(400).json({ error: "Webhook verification failed" });
    }

    await inngest.send({
      name: `clerk/${evt.type}`,
      data: evt.data,
    });

    return res.status(200).json({ success: true });
  },
);

// 2. Глобалните JSON и Clerk middleware-и се поставят след raw webhook-а
app.use(express.json());
app.use(clerkMiddleware());

// API Routes
app.get("/", (req, res) => res.send("Server is Live!"));
app.use("/api/inngest", serve({ client: inngest, functions }));

app.listen(port, () =>
  console.log(`Server listening at http://localhost:${port}`),
);
