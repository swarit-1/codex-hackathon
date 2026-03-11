import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "check scheduled agents",
  { minutes: 1 },
  internal.cron.checkScheduledAgents
);

export default crons;
