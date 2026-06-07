const API_KEY = process.env.MINISAAS_CENTER_API_KEY || "";
const BASE_URL = process.env.MINISAAS_CENTER_URL || "https://saascenter.vercel.app";

async function sendEvent(path: string, payload: any) {
  if (!API_KEY) {
    // Fail silently in development/production if not configured yet
    console.warn(`[MiniSaaS Center Client] API Key is missing. Skipping event: ${path}`);
    return { success: false, error: "API Key missing" };
  }

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[MiniSaaS Center Client] Failed to send event to ${path}:`, text);
      return { success: false, error: text };
    }

    return { success: true };
  } catch (err: any) {
    console.error(`[MiniSaaS Center Client] Exception while sending event to ${path}:`, err);
    return { success: false, error: err.message };
  }
}

export const minisaas = {
  heartbeat: (status: "UP" | "DOWN", responseTime: number) => {
    return sendEvent("/api/ingest/heartbeat", { status, responseTime });
  },

  trackRevenue: (amount: number, currency = "USD", planName = "Standard Plan", provider = "stripe") => {
    return sendEvent("/api/ingest/revenue", { amount, currency, planName, provider });
  },

  trackError: (level: "INFO" | "WARNING" | "ERROR" | "CRITICAL", message: string, stack?: string) => {
    return sendEvent("/api/ingest/error", { level, message, stack });
  },

  trackSupportTicket: (subject: string, message: string, priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL", userEmail?: string) => {
    return sendEvent("/api/ingest/support", { subject, message, priority, userEmail });
  },

  getSupportTickets: async (userEmail: string) => {
    if (!API_KEY) return { success: false, error: "API Key missing", tickets: [] };
    try {
      const res = await fetch(`${BASE_URL}/api/ingest/support?email=${encodeURIComponent(userEmail)}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
        },
      });
      if (!res.ok) {
        const text = await res.text();
        return { success: false, error: text, tickets: [] };
      }
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message, tickets: [] };
    }
  },

  replySupportTicket: async (ticketId: string, message: string) => {
    if (!API_KEY) return { success: false, error: "API Key missing" };
    try {
      const res = await fetch(`${BASE_URL}/api/ingest/support/${ticketId}/reply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) {
        const text = await res.text();
        return { success: false, error: text };
      }
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  trackPaymentOrder: (payload: {
    orderId: string;
    userEmail: string;
    amount: number;
    currency: string;
    planName: string;
    slipUrl: string;
    notes?: string | null;
    status?: string;
  }) => {
    return sendEvent("/api/ingest/payment-order", payload);
  },

  trackUsage: (eventName: string, metadata?: Record<string, any>) => {
    return sendEvent("/api/ingest/usage", { eventName, metadata });
  },
};

