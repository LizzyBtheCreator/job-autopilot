import type { Category } from "./types";

// Everything the resume writer is allowed to use. Facts and numbers come only from here.

export const CONTACT = {
  name: "Elizabeth H. McMillan",
  location: "Fayetteville, NC (Remote)",
  phone: "(910) 479-4839",
  email: "elimcmillan@myyahoo.com",
};

// Reverse chronological. This order is locked: roles may be left out, never reordered.
export const WORK_HISTORY: { key: string; heading: string; bullets: string[] }[] = [
  {
    key: "DefenseComply Pro",
    heading: "DefenseComply Pro - Founder (Remote) | 2025 to Present",
    bullets: [
      "Building a compliance intelligence SaaS platform under Defense Compliance Solutions for defense contractors and federal cloud vendors pursuing CMMC, FedRAMP, and FISMA authorization",
      "Platform replaces the traditional $15,000-$50,000 consultant-led assessment with AI-powered control gap analysis, automated policy generation, POA&M management, evidence tracking, live SPRS scoring, and assessor-ready documentation export",
      "Designed subcontractor flow-down management, contract/RFP compliance scanning, and a managed services concierge module that connects clients to compliance experts for hands-on program execution",
      "Productizing 18 years of federal compliance program management experience, including an active advisory practice and prior sales team, into a scalable SaaS platform serving the 300,000+ CMMC-obligated contractor market",
    ],
  },
  {
    key: "DefenseComply",
    heading: "DefenseComply - Founder and Principal Compliance Advisor (Remote) | 2024 to Present",
    bullets: [
      "Founded and operate an active compliance advisory practice serving small and mid-size defense contractors pursuing CMMC certification and DoD contract eligibility",
      "Lead clients through full compliance program lifecycle including NIST SP 800-171 Rev. 3 gap assessments, System Security Plan (SSP) and POA&M documentation, evidence pack development, and SPRS scoring",
      "Translate complex regulatory requirements including CMMC, NIST 800-171, and DFARS flow-down obligations into actionable remediation roadmaps and 30-day implementation plans",
      "Coordinate alignment across client IT, Legal, contracts, and executive stakeholders to drive compliance milestones against procurement and contractual deadlines",
    ],
  },
  {
    key: "BidWinAlert",
    heading: "BidWinAlert - Founder (Remote) | 2024 to Present",
    bullets: [
      "Founded and launched a government contracting intelligence platform that automates opportunity discovery, proposal readiness, and compliance tracking for federal contractors with paying clients",
      "Defined product vision, go-to-market strategy, pricing model, and subscription structure for a SaaS platform serving the govcon market",
      "Translated 18 years of hands-on federal BD and proposal experience into a scalable product, demonstrating the ability to identify market gaps, build AI-powered solutions, and deliver them to production",
    ],
  },
  {
    key: "Federal Contracting Solutions",
    heading: "Federal Contracting Solutions - Senior Business Development Consultant (Remote) | June 2021 to December 2024",
    bullets: [
      "Drove $320M+ in government contract activity with a sustained 72% win rate across DoD military departments (Army, Navy, Air Force, Space Force, SOCOM, CYBERCOM, DIA, DISA), HUD, HHS, and GSA",
      "Applied Shipley methodology to lead capture campaigns 6+ months prior to RFP release; developed win strategies, sales themes, and differentiating narratives for competitive RFPs, RFIs, BAAs, OTAs, and IDIQ task orders",
      "Briefed senior leadership and executive stakeholders on capture strategy, competitive positioning, and go/no-go recommendations for high-value pursuits",
      "Conducted competitive intelligence and win/loss analysis; identified competitor vulnerabilities and developed mitigation strategies through teaming, key partnerships, and solution differentiation",
      "Developed and executed small business and teaming partner strategies; negotiated teaming agreements and coordinated partner inputs across all pursuit phases",
      "Directed cross-functional pursuit teams of 100+ across in-house staff and teaming partners from opportunity identification through award",
      "Built and maintained direct agency relationships across Air Force, Space Force, and defense agency stakeholders to inform positioning and competitive intelligence",
      "Managed 200+ account pipeline using Salesforce and HubSpot; developed price-to-win models and cost/price proposals across CPFF, T&M, FFP, and fixed-price contract types",
    ],
  },
  {
    key: "Syxsense",
    heading: "Syxsense - Senior Business Development Specialist (Remote) | January 2022 to January 2024",
    bullets: [
      "Expanded presence in federal IT ecosystem; increased revenue from key accounts by 40% through consultative selling",
      "Delivered live technical demos of IT management software: endpoint security, patch management, and automation features",
      "Created targeted BD campaigns aligned with technology trends including cloud, cybersecurity, and automation",
      "Enhanced operational efficiency by 35% through improved system integration and streamlined customer workflows",
      "Led pricing research, coordinated teaming partnerships, and drove RFI/RFP readiness for priority pipeline",
    ],
  },
  {
    key: "GoHighLevel",
    heading: "GoHighLevel - Business Development Specialist (Remote) | September 2019 to December 2023",
    bullets: [
      "Closed $3M+ in recurring revenue through direct client acquisition and strategic partnerships",
      "Achieved 120% of sales quotas through solution-focused client engagement",
      "Managed end-to-end pursuit of federal opportunities across 10+ agencies",
      "Configured cloud-based CRM and marketing automation systems for clients; trained end-users remotely",
      "Designed BD plans enabling on-time and compliant proposal delivery",
    ],
  },
  {
    key: "Precise Consulting Services",
    heading: "Precise Consulting Services - Principal Consultant (Remote) | 2006 to Present",
    bullets: [
      "Secured and administered $325M+ in federal funding for clients across housing, education, and community development over 13+ years",
      "Managed full grant lifecycle across HUD, CDBG, HOME, LIHTC, CDFI, HUD-VASH, and Grants Per Diem programs including procurement, compliance, reporting, audit preparation, and closeout",
      "Provided federal compliance advisory across 2 CFR Part 200, FAR, EDGAR, Davis-Bacon, environmental review (24 CFR Part 58), and SAM.gov navigation with zero audit findings across 100+ client engagements",
      "Wrote and developed winning federal proposals and grant applications across defense, civilian, and housing program areas",
      "Delivered government contracting compliance training and technical assistance to organizations across NC, SC, and GA",
      "Directed community development program serving 200+ at-risk youth and families annually over 8 years",
    ],
  },
  {
    key: "Tax and Financial Services Practice",
    heading: "Tax and Financial Services Practice - Owner/Operator | Fayetteville, NC",
    bullets: [
      "Operated a tax preparation and financial advisory practice serving individual and small business clients",
      "Conducted credit analysis including financial statement review, cash flow analysis, and creditworthiness assessment",
      "Managed loan portfolio advisory and supported clients in structuring financing arrangements",
      "Maintained client financial records, prepared federal and state tax filings, and provided financial planning guidance",
    ],
  },
  {
    key: "Social Media Management Company",
    heading: "Social Media Management Company - Owner/Founder (Remote)",
    bullets: [
      "Managed content strategy, paid advertising, and community management for client accounts",
      "Ran Facebook and Instagram ad campaigns with measurable ROI for diverse client base",
      "Developed brand strategy and digital content calendars aligned to client business goals",
      "Acquired and retained client accounts through consultative service delivery",
    ],
  },
  {
    key: "Found Crisis Services",
    heading: "Found Crisis Services - Founder and Director | Fayetteville, NC",
    bullets: [
      "Founded and operated a crisis intervention and community support organization serving underserved populations",
      "Designed and implemented community-based programs using trauma-informed, strengths-based service delivery",
      "Served 200+ underprivileged youth and families annually over 8 years on a lean operating budget under $1,000/month",
      "Coordinated community partnerships, stakeholder engagement, and public sector collaboration",
    ],
  },
];

export const CERTIFICATIONS = [
  "Project Management Professional (PMP) - Project Management Institute",
  "Certified Business Development Expert (CBDE)",
  "Certified ScrumMaster (CSM)",
  "Google Data Analytics Certificate",
  "CompTIA A+ (in progress)",
];

// Kept for reference only. The resume rules say no education section.
export const EDUCATION = [
  "MS Information Technology - Western Governors University (in progress, 2027)",
  "Fayetteville Technical Community College",
  "Fayetteville State University",
];

export const SKILLS = `Sales and Business Development: CRM tools (Salesforce, HubSpot, GoHighLevel), consultative selling, pipeline management (200+ accounts), lead generation, SaaS sales, social media management and digital marketing, content creation and brand strategy, Facebook/Instagram paid advertising, community management, account management, quota attainment (120%), $3M+ in recurring revenue closed

Government Contracting and Compliance: Capture management, proposal management (Shipley methodology), federal BD lifecycle ($320M+ contract activity, 72% win rate), SBA 8(a)/GSA/IDIQ/GWAC/OTA/BAA vehicles, FAR/DFARS compliance, teaming partnerships, tribal procurement (ANCs), 2 CFR Part 200 (Uniform Guidance), CDBG full program lifecycle, Davis-Bacon labor standards, environmental review (24 CFR Part 58), HUD/IDIS reporting, single audit preparation, SAM.gov navigation, EDGAR compliance, grant writing and federal proposal development, LIHTC/HOME/HUD-VASH/CDFI program knowledge, win strategy and price-to-win, 100+ client engagements with zero audit findings

IT and Technical: Syxsense (endpoint security, patch management, automation), cloud platform administration, CRM administration, technical client support, remote troubleshooting, IT project coordination, Next.js, Supabase, Stripe integration, Anthropic API

Program and Project Management: PMP-certified project management, cross-functional team leadership (100+, in-house and teaming partners), program design and implementation, stakeholder engagement, training design and delivery, community development program design, operational efficiency improvement (35%)

Tools: Microsoft Office 365, Salesforce, HubSpot, GoHighLevel, Supabase, Next.js, Stripe`;

export const CATEGORY_FOCUS: Record<Category, string> = {
  proposals:
    "PROPOSALS and CAPTURE role. Lead with: $320M+ in government contract activity, 72% proposal win rate, Shipley methodology, full proposal lifecycle (RFI through award), capture management 6+ months pre-RFP, win strategy development, competitive intelligence, teaming strategy. Anchor role is Federal Contracting Solutions. Include BidWinAlert as a SaaS product built on 18 years of proposal expertise. Highlight DoD pursuits (Army, Navy, Air Force, Space Force, SOCOM, CYBERCOM, DIA, DISA), IDIQ task orders, OTAs, BAAs, cross-functional pursuit teams of 100+.",
  contracts:
    "CONTRACTS, CONTRACT ADMINISTRATION, or PROCUREMENT role. Lead with: FAR/DFARS compliance, cost/price proposals across FFP, CPFF, T&M, and fixed-price contract types, 100+ client engagements with zero audit findings, SBA 8(a)/IDIQ/GWAC/OTA/BAA vehicles, teaming agreements and subcontractor flow-downs, SAM.gov navigation. Anchor roles are Federal Contracting Solutions and Precise Consulting Services.",
  compliance:
    "COMPLIANCE or GRC role. Lead with compliance program management and regulatory framework expertise. Primary roles: DefenseComply Pro (CMMC/FedRAMP/FISMA SaaS), DefenseComply (active CMMC/NIST 800-171 advisory), Precise Consulting Services (federal compliance, zero audit findings across 100+ engagements), Federal Contracting Solutions (FAR/DFARS). Key frameworks: CMMC, NIST 800-171, FedRAMP, FISMA, FAR/DFARS, 2 CFR Part 200. Key skills: POA&M management, SSP documentation, SPRS scoring, audit readiness. Never lead with BD or sales metrics.",
  grants:
    "GRANTS MANAGEMENT role. Lead with: $325M+ in federal funding secured and administered, full grant lifecycle (HUD, CDBG, HOME, LIHTC, CDFI, HUD-VASH, Grants Per Diem), 2 CFR Part 200 (Uniform Guidance), EDGAR, Davis-Bacon, single audit preparation, HUD/IDIS reporting, zero audit findings across 100+ client engagements. Anchor role is Precise Consulting Services.",
  program_ops:
    "PROGRAM MANAGEMENT role. Lead with: PMP-certified program management, cross-functional team leadership (100+ in-house and teaming partners), 18+ years of federal program delivery, stakeholder engagement, 35% operational efficiency improvement, training design and delivery. Anchor roles are Federal Contracting Solutions and Precise Consulting Services. Include BidWinAlert as evidence of building a program from scratch.",
  business_dev:
    "BUSINESS DEVELOPMENT role. Lead with: $320M+ in government contract activity, 72% win rate, $3M+ commercial recurring revenue, 120% quota attainment, 200+ account pipeline, Salesforce/HubSpot/GoHighLevel, strategic partnerships and teaming agreements. Anchor roles are Federal Contracting Solutions, Syxsense, and GoHighLevel.",
  consulting:
    "CONSULTING role. Lead with: 18+ years of federal consulting across government contracting, compliance, grants, and community development, 100+ client engagements with zero audit findings, $325M+ federal funding administered, active CMMC advisory practice (DefenseComply), compliance training delivered across NC, SC, and GA. Anchor role is Precise Consulting Services.",
  public_sector:
    "PUBLIC SECTOR / COMMUNITY, ECONOMIC, or WORKFORCE DEVELOPMENT role. Lead with: community development program leadership (200+ youth and families served annually over 8 years), $325M+ federal funding for housing, education, and community development, CDBG/HOME/LIHTC program lifecycle, technical assistance across NC, SC, and GA, stakeholder engagement. Anchor roles are Precise Consulting Services and Found Crisis Services.",
  dei_hr:
    "DEI, HR COMPLIANCE, or EMPLOYEE RELATIONS role. Lead with: 18+ years of compliance program management, community and workforce program design (200+ families and youth served annually), technical assistance to diverse organizations across NC, SC, and GA, federal regulatory compliance (2 CFR Part 200, FAR, Davis-Bacon, EDGAR), zero audit findings across 100+ engagements, training design and delivery. Anchor roles are Precise Consulting Services and Found Crisis Services. Never lead with BD or sales metrics. Never mention WBE/MBE/SBE designations.",
};

export function workHistoryText(): string {
  return WORK_HISTORY.map((r, i) => `${i + 1}. ${r.heading}\n${r.bullets.map((b) => `- ${b}`).join("\n")}`).join("\n\n");
}
