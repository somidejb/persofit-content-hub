import cron from "node-cron";
import { prisma } from "./prisma";
import { generateAllSlides } from "./generation";
import { postSlideshowNow } from "./posting";
import { runDueTemplates } from "./template-runner";

declare global {
  // eslint-disable-next-line no-var
  var __persofitSchedulerStarted: boolean | undefined;
}

async function runDueSchedules() {
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const today = now.toISOString().slice(0, 10);

  const dueSchedules = await prisma.schedule.findMany({
    where: { status: "PENDING", postTime: currentTime },
  });

  for (const schedule of dueSchedules) {
    let dates: string[] = [];
    try {
      dates = JSON.parse(schedule.dates || "[]");
    } catch {
      dates = [];
    }
    if (!dates.includes(today)) continue;

    try {
      await prisma.schedule.update({ where: { id: schedule.id }, data: { status: "GENERATING" } });
      const { failed } = await generateAllSlides(schedule.slideshowId);
      if (failed) throw new Error("Slide generation failed");

      await postSlideshowNow(schedule.slideshowId);
      await prisma.schedule.update({ where: { id: schedule.id }, data: { status: "POSTED" } });
    } catch (err) {
      await prisma.schedule.update({ where: { id: schedule.id }, data: { status: "FAILED" } });
      console.error(`[scheduler] schedule ${schedule.id} failed:`, err);
    }
  }
}

export function startScheduler() {
  if (globalThis.__persofitSchedulerStarted) return;
  globalThis.__persofitSchedulerStarted = true;

  cron.schedule("* * * * *", () => {
    runDueSchedules().catch((err) => console.error("[scheduler] tick error:", err));
    runDueTemplates().catch((err) => console.error("[scheduler] template tick error:", err));
  });

  console.log("[scheduler] node-cron started — checking schedules and templates every minute");
}
