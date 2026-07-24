import { prisma } from '../prisma';

const DAY_MS = 24 * 60 * 60 * 1000;

export const RETENTION_DAYS = {
  webhookEvents: 3,
  activityLogs: 90,
  completedPlans: 180,
} as const;

const cutoff = (now: Date, days: number) => new Date(now.getTime() - days * DAY_MS);

export async function runRetentionCleanup(now = new Date()) {
  const webhookCutoff = cutoff(now, RETENTION_DAYS.webhookEvents);
  const activityCutoff = cutoff(now, RETENTION_DAYS.activityLogs);
  const planCutoff = cutoff(now, RETENTION_DAYS.completedPlans);

  const webhookEvents = await prisma.webhookEvent.deleteMany({
    where: { receivedAt: { lt: webhookCutoff } },
  });

  const activityLogs = await prisma.activityLog.deleteMany({
    where: { createdAt: { lt: activityCutoff } },
  });

  const completedPlans = await prisma.paperTrade.deleteMany({
    where: {
      result: { in: ['WIN', 'LOSS', 'BE', 'CANCELLED'] },
      OR: [
        { closedAt: { lt: planCutoff } },
        { closedAt: null, openedAt: { lt: planCutoff } },
      ],
    },
  });

  const terminalSignals = await prisma.signal.deleteMany({
    where: {
      createdAt: { lt: planCutoff },
      status: { in: ['win', 'loss', 'cancelled'] },
      paperTrades: { none: {} },
    },
  });

  return {
    retainedDays: RETENTION_DAYS,
    deleted: {
      webhookEvents: webhookEvents.count,
      activityLogs: activityLogs.count,
      completedPlans: completedPlans.count,
      terminalSignals: terminalSignals.count,
    },
    completedAt: new Date().toISOString(),
  };
}
