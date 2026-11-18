// Business behind AcademicGen: one place for company details and social links.
// Same accounts as hnkiot.com (HNK IoT Solutions). Update here only.
import type { IconType } from "react-icons";
import { FaLinkedin, FaFacebook } from "react-icons/fa";
import { SiGithub, SiYoutube, SiTiktok, SiInstagram, SiX, SiPinterest } from "react-icons/si";

export const BUSINESS = {
  name: "HNK IoT Solutions",
  legalName: "HNK IoT Solutions (Pty) Ltd",
  registration: "2026/647269/07",
  founder: "Henock Hnk",
  website: "https://hnkiot.com",
  email: "henock@hnkiot.com",
  supportEmail: "support@hnkiot.com",
  phone: "+27 61 471 9400",
  whatsapp: "https://wa.me/27614719400",
  location: "Cape Town, South Africa",
  address: "33 Scott Road, Parow West, Cape Town, South Africa",
  googleProfile: "https://share.google/D01cdCEDmTfWC9dmi",
} as const;

// Other HNK IoT Solutions projects (titles and descriptions taken from each site's own page)
export const HNK_PROJECTS = [
  { name: "HNK Stories", url: "https://stories.hnkiot.com/", desc: "Short animated true stories, kindness stories, kids cartoons and quizzes." },
  { name: "HNK Mathematics Lab", url: "https://matheng.hnkiot.com/", desc: "Engineering Mathematics 3 and 5: study guides, graph plotting, worked solutions and practice." },
  { name: "HNK Physics Lab", url: "https://hnk-learning-lab.pages.dev/", desc: "Physics 5 and Quantum and Optoelectronic Physics: illustrated pages, quizzes and flashcards." },
  { name: "Cape Town Tourism", url: "https://capetown.hnkiot.com/", desc: "Plan a Cape Town trip: attractions, stays, events, safety, transport and an AI travel assistant." },
  { name: "EnergyLens", url: "https://energylens.pages.dev/", desc: "IoT electricity submetering for residences and rentals: live 3-phase metering and AI insights." },
  { name: "Ion4 Smart Crossing", url: "https://ion4.hnkiot.com/", desc: "A safer rail and road crossing for the Adam Tas Corridor, Stellenbosch, with live data." },
] as const;

export type SocialLink = { name: string; handle: string; url: string; icon: IconType };

// Display order used by the About and Contact pages
export const SOCIAL_LINKS: SocialLink[] = [
  { name: "LinkedIn", handle: "HNK IoT Solutions", url: "https://www.linkedin.com/in/hnk-iot-solutions/", icon: FaLinkedin },
  { name: "YouTube", handle: "@HNKIoTSolutions", url: "https://www.youtube.com/@HNKIoTSolutions", icon: SiYoutube },
  { name: "Facebook", handle: "HnkIoTSolutions", url: "https://www.facebook.com/HnkIoTSolutions", icon: FaFacebook },
  { name: "Instagram", handle: "@hnkiotsolutions", url: "https://www.instagram.com/hnkiotsolutions/", icon: SiInstagram },
  { name: "X", handle: "@HnkIotSolutions", url: "https://x.com/HnkIotSolutions", icon: SiX },
  { name: "TikTok", handle: "@hnkiot", url: "https://www.tiktok.com/@hnkiot", icon: SiTiktok },
  { name: "GitHub", handle: "hnkiot", url: "https://github.com/hnkiot", icon: SiGithub },
  { name: "Pinterest", handle: "HNKIoTSolutions", url: "https://www.pinterest.com/HNKIoTSolutions", icon: SiPinterest },
];

export const SOURCE_REPO = "https://github.com/henockhnk092-dot/Academic-Document-Generator";
