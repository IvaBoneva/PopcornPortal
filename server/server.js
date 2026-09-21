/*import express from "express";
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
/*app.post(
  "/api/webhooks/clerk",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const SIGNING_SECRET = process.env.CLERK_WEBHOOK_SECRET;

    if (!SIGNING_SECRET) {
      return res.status(400).json({ error: "Missing CLERK_WEBHOOK_SECRET" });
    }

    // Вземаме заглавията за Svix
    const svix_id = req.headers["svix-id"];
    const svix_timestamp = req.headers["svix-timestamp"];
    const svix_signature = req.headers["svix-signature"];

    if (!svix_id || !svix_timestamp || !svix_signature) {
      return res.status(400).json({ error: "Missing svix headers" });
    }

    // Преобразуваме body-то изрично в string/Buffer за Svix
    const payload = req.body.toString("utf8");

    const wh = new Webhook(SIGNING_SECRET);
    let evt;

    try {
      evt = wh.verify(payload, {
        "svix-id": svix_id,
        "svix-timestamp": svix_timestamp,
        "svix-signature": svix_signature,
      });
    } catch (err) {
      console.error("Webhook verification error:", err.message);
      return res.status(400).json({ error: "Webhook verification failed" });
    }

    // Изпращане на събитието към Inngest
    await inngest.send({
      name: `clerk/${evt.type}`,
      data: evt.data,
    });

    return res.status(200).json({ success: true });
  },
);

app.post(
  "/api/webhooks/clerk",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const SIGNING_SECRET = process.env.CLERK_WEBHOOK_SECRET;

    if (!SIGNING_SECRET) {
      return res.status(400).json({ error: "Missing CLERK_WEBHOOK_SECRET" });
    }

    const svix_id = req.headers["svix-id"];
    const svix_timestamp = req.headers["svix-timestamp"];
    const svix_signature = req.headers["svix-signature"];

    if (!svix_id || !svix_timestamp || !svix_signature) {
      return res.status(400).json({ error: "Missing svix headers" });
    }

    // Вземаме суровото body като Buffer / String
    const payload = req.body.toString("utf8");

    const wh = new Webhook(SIGNING_SECRET);
    let evt;

    try {
      evt = wh.verify(payload, {
        "svix-id": svix_id,
        "svix-timestamp": svix_timestamp,
        "svix-signature": svix_signature,
      });
    } catch (err) {
      console.error("Webhook verification error:", err.message);
      return res.status(400).json({ error: "Webhook verification failed" });
    }

    // Проверка за валидност на evt и evt.type
    const eventType = evt?.type;

    if (!eventType) {
      console.error("Received webhook event without a type:", evt);
      return res.status(400).json({ error: "Invalid event type" });
    }

    // Изпращане към Inngest
    try {
      await inngest.send({
        name: `clerk/${eventType}`,
        data: evt.data || {},
      });
    } catch (inngestErr) {
      console.error("Inngest send error:", inngestErr);
      return res.status(500).json({ error: "Failed to send event to Inngest" });
    }

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
);*/

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

// Webhook endpoint: обработваме тялото като RAW buffer/string директно в манипулатора
app.post(
  "/api/webhooks/clerk",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const SIGNING_SECRET = process.env.CLERK_WEBHOOK_SECRET;

    if (!SIGNING_SECRET) {
      return res.status(400).json({ error: "Missing CLERK_WEBHOOK_SECRET" });
    }

    const svix_id = req.headers["svix-id"];
    const svix_timestamp = req.headers["svix-timestamp"];
    const svix_signature = req.headers["svix-signature"];

    if (!svix_id || !svix_timestamp || !svix_signature) {
      return res.status(400).json({ error: "Missing svix headers" });
    }

    const wh = new Webhook(SIGNING_SECRET);
    let evt;

    try {
      // Svix verify приема Buffer или UTF-8 String
      const bodyString =
        req.body instanceof Buffer ? req.body.toString("utf8") : req.body;

      evt = wh.verify(bodyString, {
        "svix-id": svix_id,
        "svix-timestamp": svix_timestamp,
        "svix-signature": svix_signature,
      });
    } catch (err) {
      console.error("Webhook verification failed:", err.message);
      // Спираме изпълнението тук, за да не стига до evt.type
      return res
        .status(400)
        .json({ error: "Webhook verification failed", details: err.message });
    }

    // Допълнителна защита за валидност на evt
    if (!evt || !evt.type) {
      console.error("Invalid event structure:", evt);
      return res.status(400).json({ error: "Invalid event structure" });
    }

    console.log(`Successfully verified event: ${evt.type}`);

    try {
      await inngest.send({
        name: `clerk/${evt.type}`,
        data: evt.data,
      });
    } catch (inngestErr) {
      console.error("Inngest send error:", inngestErr);
      return res.status(500).json({ error: "Failed to send event to Inngest" });
    }

    return res.status(200).json({ success: true });
  },
);

// Глобалните middleware-и остават СЛЕД webhook рутера
app.use(express.json());
app.use(clerkMiddleware());

// API Routes
app.get("/", (req, res) => res.send("Server is Live!"));
app.use("/api/inngest", serve({ client: inngest, functions }));

app.listen(port, () =>
  console.log(`Server listening at http://localhost:${port}`),
);
