import "dotenv/config";
import { db } from "../src/lib/db";
import { seedProviders } from "./providers";

seedProviders()
  .then(() => console.log("Production providers are ready."))
  .finally(() => db.$disconnect());
