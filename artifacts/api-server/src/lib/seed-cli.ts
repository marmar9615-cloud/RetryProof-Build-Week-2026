import { seedDemoIfMissing } from "./seed-demo";
import { logger } from "./logger";

async function main() {
  const result = await seedDemoIfMissing();
  logger.info(result, "Demo seed complete");
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

main().catch((err) => {
  logger.error({ err }, "Demo seed failed");
  console.error(err);
  process.exit(1);
});
