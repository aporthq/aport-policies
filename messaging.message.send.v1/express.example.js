const express = require("express");
const { requirePolicy } = require("@aporthq/middleware-express");

const app = express();
app.use(express.json());

// Apply messaging policy to all messaging routes
app.post(
  "/messages",
  requirePolicy("messaging.message.send.v1"),
  async (req, res) => {
    try {
      const { channel, recipients, content, mentions } = req.body;
      const passport = req.policyResult.passport;

      // Check channel allowlist
      const allowedChannels =
        passport.capabilities.find((cap) => cap.id === "messaging.send")?.params
          ?.channels_allowlist || [];

      if (allowedChannels.length > 0 && !allowedChannels.includes(channel)) {
        return res.status(403).json({
          error: "Channel not allowed",
          allowed_channels: allowedChannels,
          upgrade_instructions:
            "Add channel to your passport's channels_allowlist",
        });
      }

      // Check mention policy
      const mentionPolicy =
        passport.capabilities.find((cap) => cap.id === "messaging.send")?.params
          ?.mention_policy || "limited";

      if (mentions && mentions.length > 0) {
        if (mentionPolicy === "none") {
          return res.status(403).json({
            error: "Mentions not allowed",
            mention_policy: mentionPolicy,
          });
        }
        if (mentionPolicy === "limited" && mentions.includes("@everyone")) {
          return res.status(403).json({
            error: "@everyone mentions not allowed with limited mention policy",
          });
        }
      }

      // Rate limiting check (would integrate with actual rate limiter)
      const rateLimitCheck = await checkMessageRateLimit(passport.agent_id);
      if (!rateLimitCheck.allowed) {
        return res.status(429).json({
          error: "Rate limit exceeded",
          retry_after: rateLimitCheck.retry_after,
          limits: {
            per_minute: passport.limits.msgs_per_min,
            per_day: passport.limits.msgs_per_day,
          },
        });
      }

      // Send message using your messaging service
      const message_id = await sendMessage({
        channel,
        recipients,
        content,
        mentions,
        agent_id: passport.agent_id,
        agent_name: passport.name,
      });

      // Record usage for rate limiting
      await recordMessageUsage(passport.agent_id);

      // Log the message
      console.log(
        `Message sent: ${message_id} to ${channel} by agent ${passport.agent_id}`
      );

      res.json({
        success: true,
        message_id,
        channel,
        recipients: recipients.length,
        status: "sent",
      });
    } catch (error) {
      console.error("Message sending error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Broadcast message endpoint
app.post(
  "/messages/broadcast",
  requirePolicy("messaging.message.send.v1"),
  async (req, res) => {
    try {
      const { channels, content, mentions } = req.body;
      const passport = req.policyResult.passport;

      // Check if broadcast is within daily limits
      const estimatedMessages = channels.length;
      const dailyUsage = await getDailyMessageUsage(passport.agent_id);

      if (dailyUsage + estimatedMessages > passport.limits.msgs_per_day) {
        return res.status(403).json({
          error: "Broadcast would exceed daily message limit",
          current_usage: dailyUsage,
          limit: passport.limits.msgs_per_day,
          requested: estimatedMessages,
        });
      }

      // Process broadcast
      const results = [];
      for (const channel of channels) {
        try {
          const message_id = await sendMessage({
            channel,
            content,
            mentions,
            agent_id: passport.agent_id,
            agent_name: passport.name,
          });
          results.push({ channel, message_id, status: "sent" });
        } catch (error) {
          results.push({ channel, error: error.message, status: "failed" });
        }
      }

      // Record usage
      await recordMessageUsage(passport.agent_id, channels.length);

      res.json({
        success: true,
        results,
        total_sent: results.filter((r) => r.status === "sent").length,
        total_failed: results.filter((r) => r.status === "failed").length,
      });
    } catch (error) {
      console.error("Broadcast error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Mock functions (implement with your actual messaging service)
async function sendMessage({
  channel,
  recipients,
  content,
  mentions,
  agent_id,
  agent_name,
}) {
  // Simulate message sending
  await new Promise((resolve) => setTimeout(resolve, 100));
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

async function checkMessageRateLimit(agent_id) {
  // Implement with Redis or in-memory rate limiter
  // For demo, always allow
  return { allowed: true };
}

async function recordMessageUsage(agent_id, count = 1) {
  // Record usage in your rate limiting system
  console.log(`Recorded ${count} message(s) for agent ${agent_id}`);
}

async function getDailyMessageUsage(agent_id) {
  // Get current daily usage from your tracking system
  return 0; // Mock value
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Messaging service running on port ${PORT}`);
  console.log("Protected by APort messaging.message.send.v1 policy pack");
});
