import "@/styles/main.css";
import { boot, fatal } from "@/app/boot";

const appRoot = document.querySelector<HTMLDivElement>("#app");
if (!appRoot) throw new Error("#app missing");

try {
  boot(appRoot);
} catch (err) {
  console.error(err);
  fatal(appRoot, "Boot failed", "Unexpected startup error. Check the console and reload.");
}
