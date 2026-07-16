import { seedDemoIfMissing } from "../lib/seed-demo";

async function main() {
  await seedDemoIfMissing();
  console.log("seeded");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
