import {
  FaGlassCheers,
  FaRegClock,
  FaWhatsapp,
  FaCloudDownloadAlt,
  FaMobileAlt,
  FaShieldAlt,
} from "react-icons/fa";
import type { IconType } from "react-icons";

export type StatItem = {
  label: string;
  value: string;
};

export type FeatureItem = {
  icon: IconType;
  title: string;
  text: string;
};

export const stats: StatItem[] = [
  // These two values are marketing claims; they are not live fleet counts.
  { label: "Machines sold", value: "107" },
  { label: "Countries covered", value: "17" },
  // StatsSection replaces this fallback with totals.cups_total at runtime.
  { label: "Drinks made", value: "2.5k+" },
];

export const features: FeatureItem[] = [
  {
    icon: FaGlassCheers,
    title: "30+ flavors & supplements",
    text: "Protein shakes, BCAA, Creatine, pre-workout and more. We source and deliver the powders — you choose the menu that fits your members.",
  },
  {
    icon: FaRegClock,
    title: "Plug-and-play setup",
    text: "Connect water and power, register online — your machine is serving shakes the same day. No plumbing or special wiring needed.",
  },
  {
    icon: FaCloudDownloadAlt,
    title: "Cloud-managed & always up to date",
    text: "Firmware, menus and pricing update over the air. Real-time dashboards show sales, inventory levels and machine health — no site visits required.",
  },
  {
    icon: FaMobileAlt,
    title: "AI-powered support",
    text: "Every machine comes with a dedicated AI assistant that knows your setup. For anything beyond that, our engineering team is a message away.",
  },
  {
    icon: FaShieldAlt,
    title: "Built for high-traffic locations",
    text: "Gyms, hotels, offices, universities — iShaker machines handle hundreds of servings a day with touchscreen ordering and cashless payment.",
  },
  {
    icon: FaWhatsapp,
    title: "Direct line to our team",
    text: "Reach us on WhatsApp or Telegram any time. We handle diagnostics, flavor changes and firmware updates remotely — usually within hours.",
  },
];
