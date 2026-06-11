import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { HelpCircle } from "lucide-react";

const STEPS = [
  {
    element: "[data-tour='sidebar-brand']",
    popover: {
      title: "Creavint Pulse",
      description:
        "Internal ops dashboard for your content monetization network. Provision sites, run AI content pipelines, and track AdSense revenue — all in one place.",
    },
  },
  {
    element: "[data-tour='nav-dashboard']",
    popover: {
      title: "Network Dashboard",
      description:
        "30-day revenue, margin, sessions, and indexed pages across all sites. Revenue vs. cost charts and live alert feed.",
    },
  },
  {
    element: "[data-tour='nav-sites']",
    popover: {
      title: "Sites",
      description:
        "Create and manage Hugo static-blog sites. Each site moves through a state machine: provisioning → live → indexed → AdSense applied → monetized.",
    },
  },
  {
    element: "[data-tour='nav-review']",
    popover: {
      title: "Content Desk",
      description:
        "AI-drafted articles that need human review before publishing. Approve, edit, or reject. Quality scores are shown per article.",
    },
  },
  {
    element: "[data-tour='nav-keywords']",
    popover: {
      title: "Keywords",
      description:
        "Keyword clusters and opportunity scores from DataForSEO. Pin high-value clusters to prioritise content briefing.",
    },
  },
  {
    element: "[data-tour='nav-alerts']",
    popover: {
      title: "Alerts",
      description:
        "System alerts from analytics, SEO audits, and AdSense. Critical alerts require acknowledgement before they clear.",
    },
  },
  {
    element: "[data-tour='nav-admin']",
    popover: {
      title: "Admin",
      description:
        "Template registry, kill switches to pause the content pipeline network-wide, and user management. Admin role only.",
    },
  },
  {
    element: "[data-tour='theme-toggle']",
    popover: {
      title: "Light / Dark mode",
      description: "Switch between light, dark, or system-preference theme. The sidebar always stays dark.",
    },
  },
  {
    element: "[data-tour='user-menu']",
    popover: {
      title: "Account",
      description: "View your role and sign out. Access is logged in the audit trail.",
    },
  },
];

export function TourButton() {
  function startTour() {
    const tour = driver({
      showProgress: true,
      animate: true,
      overlayOpacity: 0.5,
      stagePadding: 6,
      stageRadius: 6,
      steps: STEPS,
    });
    tour.drive();
  }

  return (
    <button
      onClick={startTour}
      data-tour="tour-trigger"
      className="size-8 flex items-center justify-center rounded-[--radius] text-text-secondary hover:bg-surface-raised transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      aria-label="Start product tour"
      title="Take a tour"
    >
      <HelpCircle className="size-4" />
    </button>
  );
}
