-- ============================================================
-- SEED: Elizabeth H. McMillan master profile
-- ============================================================

-- Insert master profile
insert into master_profile (
  full_name, email, phone, location,
  cover_letter_tone, salary_min, remote_only,
  no_commission_only, daily_target, daily_target_production, is_testing_phase
) values (
  'Elizabeth H. McMillan',
  'elimcmillan@myyahoo.com',
  '(910) 479-4839',
  'Fayetteville, NC',
  'conversational-direct',
  60000, true, true, 50, 100, true
) on conflict do nothing;

-- Get the profile id for subsequent inserts
do $$
declare
  pid uuid;
begin
  select id into pid from master_profile limit 1;

  -- ── PROFILE SECTIONS ─────────────────────────────────────

  -- Sales section
  insert into profile_sections (profile_id, category, summary, skills, keywords, target_roles)
  values (pid, 'sales',
    'Results-driven sales and business development professional with a track record of closing $3M+ in recurring revenue, achieving 120% of quota, and managing 200+ account pipelines using Salesforce, HubSpot, and GoHighLevel. Experienced in consultative selling, SaaS demos, lead generation without reliance on tools, and client onboarding across federal and commercial markets.',
    array[
      'Salesforce', 'HubSpot', 'GoHighLevel', 'Consultative selling',
      'Pipeline management (200+ accounts)', 'Lead generation (tool-agnostic)',
      'CRM implementation', 'Client onboarding', 'SaaS sales',
      'Paid advertising (Facebook/Instagram)', 'Content strategy',
      'Community management', 'Social media campaign management',
      'Account management', 'Quota attainment (120%)', 'Recurring revenue closure'
    ],
    array[
      'SDR', 'account executive', 'account manager', 'business development',
      'BDR', 'sales consultant', 'CRM', 'pipeline', 'quota', 'SaaS', 'remote sales'
    ],
    array[
      'SDR', 'Account Executive', 'Account Manager',
      'Business Development Representative', 'Sales Consultant'
    ]
  ) on conflict (profile_id, category) do nothing;

  -- GovCon section
  insert into profile_sections (profile_id, category, summary, skills, keywords, target_roles)
  values (pid, 'govcon',
    'Senior federal business development and compliance professional with 20+ years of experience. Secured $50M+ in awarded contracts with a 72% proposal win rate. Deep expertise in capture management, full RFP/RFI lifecycle, federal contract vehicles (SBA 8(a), GSA, IDIQ, GWACs), and regulatory compliance (2 CFR Part 200, FAR, CDBG, Davis-Bacon). Built BidWinAlert, a SaaS government contracting intelligence platform.',
    array[
      'Capture management', 'Proposal management', 'RFP/RFI lifecycle',
      'SBA 8(a)', 'GSA schedule', 'IDIQ', 'GWACs', 'Teaming partnerships',
      'Tribal procurement (ANCs)', '2 CFR Part 200', 'FAR', 'CDBG',
      'Davis-Bacon', 'URA', 'IDIS', 'EDGAR', 'SAM.gov',
      'Single audit preparation', 'Agency relationship building',
      'Win strategy', 'Pricing strategy', 'Competitive intelligence',
      'Federal technology trends', 'Agile', 'PMBoK', 'CMMI', 'ITIL',
      'BidWinAlert (SaaS founder)', 'Salesforce', 'HubSpot',
      '$50M+ contracts secured', '72% proposal win rate',
      '$3.5M federal funding secured', 'Training and consulting delivery'
    ],
    array[
      'proposal manager', 'capture manager', 'government sales', 'BD manager',
      'contracts administrator', 'compliance consultant', 'federal',
      'government contracting', 'GovCon', 'FAR', 'CDBG', 'RFP', 'IDIQ', 'GSA'
    ],
    array[
      'Proposal Manager', 'Capture Manager', 'Government Sales',
      'BD Manager', 'Contracts Administrator', 'Compliance Consultant'
    ]
  ) on conflict (profile_id, category) do nothing;

  -- Data Center section (ops/coordination only)
  insert into profile_sections (profile_id, category, summary, skills, keywords, target_roles)
  values (pid, 'datacenter',
    'Operations and coordination professional transitioning into data center and IT infrastructure roles. Background in IT management SaaS (Syxsense: endpoint security, patch management, automation), cross-functional team leadership (30+ people), cloud CRM administration, and technical client support. Pursuing BS in Information Technology (WGU) and CompTIA A+.',
    array[
      'IT operations coordination', 'Cross-functional team leadership (30+)',
      'Syxsense (endpoint security, patch management, automation)',
      'Cloud platform administration', 'CRM administration',
      'Technical client support', 'Remote troubleshooting',
      'IT project coordination', 'SaaS systems administration',
      'CompTIA A+ (in progress)', 'BS Information Technology (WGU, in progress)',
      'Operational efficiency improvement (35%)', 'Process optimization'
    ],
    array[
      'data center operations', 'IT operations', 'infrastructure coordinator',
      'technical account manager', 'project coordinator', 'operations analyst',
      'IT coordinator', 'data center coordinator', 'infrastructure support'
    ],
    array[
      'Data Center Operations Coordinator', 'IT Operations Analyst',
      'Infrastructure Support Coordinator',
      'Technical Account Manager (data center)',
      'Data Center Project Coordinator'
    ]
  ) on conflict (profile_id, category) do nothing;

  -- ── WORK HISTORY ─────────────────────────────────────────

  insert into work_history (profile_id, company, title, start_date, end_date, is_current, is_remote, bullets, categories, sort_order)
  values
  (pid, 'Federal Contracting Solutions', 'Senior Business Development Consultant',
    'June 2021', 'December 2024', false, true,
    array[
      'Led full business development lifecycle efforts across federal markets, driving capture and proposal strategies that secured over $50M in awarded contracts',
      'Delivered 72% proposal win rate by authoring and orchestrating high-value technical proposals aligned to government requirements',
      'Built and maintained direct relationships with key stakeholders in federal and civilian agencies',
      'Generated qualified leads without reliance on FBO/GovWin tools — direct agency outreach and market research',
      'Directed Salesforce and HubSpot implementation for 200+ account pipeline, improving forecasting accuracy and win readiness',
      'Advised clients on pricing strategies using competitive intelligence and historical data',
      'Directed cross-functional teams of up to 30 in federal contracting projects'
    ],
    array['sales', 'govcon'], 1),

  (pid, 'Syxsense', 'Senior Business Development Specialist',
    'January 2022', 'January 2024', false, true,
    array[
      'Expanded presence in federal IT ecosystem, increasing revenue from key accounts by 40% through consultative selling',
      'Presented live technical demos of IT management software: endpoint security, patch management, and automation features',
      'Created targeted BD campaigns aligned with technology trends (cloud, cybersecurity, automation)',
      'Led pricing research, coordinated teaming partnerships, and drove RFI/RFP readiness for priority pipeline',
      'Enhanced operational efficiency by 35% through improved system integration and streamlined customer workflows',
      'Collaborated with product teams to identify and troubleshoot system issues'
    ],
    array['sales', 'govcon', 'datacenter'], 2),

  (pid, 'GoHighLevel', 'Business Development Specialist',
    'September 2019', 'December 2023', false, true,
    array[
      'Closed over $3M in recurring revenue through direct client acquisition and strategic partnerships across federal and commercial hybrid markets',
      'Achieved 120% of sales quotas through solution-focused client engagement',
      'Oversaw end-to-end pursuit of federal opportunities across 10+ agencies',
      'Supported clients in configuring cloud-based CRM and marketing automation systems',
      'Trained end-users remotely, resolving configuration and workflow issues',
      'Designed BD plans enabling on-time and compliant proposal delivery'
    ],
    array['sales', 'govcon'], 3),

  (pid, 'Precise Consulting Services', 'Principal Consultant',
    '2006', 'Present', true, true,
    array[
      'Secured $3.5M+ in federal funding and advised on $4.85M+ in total housing development activity',
      'Administered CDBG grants across full program lifecycle: procurement, environmental review (24 CFR Part 58), Davis-Bacon, HUD/IDIS reporting, single audit (2 CFR Part 200 Subpart F), and closeout',
      'Provided 16 years of government contracting compliance advisory including 2 CFR Part 200, FAR, EDGAR, SAM.gov, and federal award administration',
      'Directly served 100+ veterans across NC, SC, and GA (2014–2022) — housing placement, group home development ($450K construction), new development housing (~$900K)',
      'Provided HUD funding navigation and grant advisory to 12 clients ($300K–$2M per engagement)',
      'Delivered training and consulting to clients including Tammie Hudson and others in government contracting, federal compliance, and community development',
      'Directed community development program serving 200+ at-risk youth and families over 8 years'
    ],
    array['govcon'], 4),

  (pid, 'BidWinAlert', 'Founder & SaaS Developer',
    '2024', 'Present', true, true,
    array[
      'Built and launched a government contracting intelligence SaaS platform from concept to production',
      'Full-stack development using Next.js, Supabase, Stripe, and Anthropic API',
      'Designed product architecture, user experience, and go-to-market strategy'
    ],
    array['govcon', 'sales'], 5),

  (pid, 'Social Media Management Company', 'Owner / Founder',
    '2018', '2022', false, true,
    array[
      'Managed content strategy, paid advertising, and community management for client accounts',
      'Ran Facebook and Instagram ad campaigns with measurable ROI',
      'Acquired and retained client accounts through consultative service delivery'
    ],
    array['sales'], 6),

  (pid, 'Found Crisis Services', 'Founder & Director',
    '2010', '2018', false, false,
    array[
      'Founded and operated crisis intervention and community support organization',
      'Served 200+ underprivileged youth and families annually over 8 years on a lean budget under $1,000/month',
      'Designed trauma-informed, strengths-based service delivery programs',
      'Coordinated community partnerships and public sector collaboration'
    ],
    array['govcon'], 7);

  -- ── CERTIFICATIONS ───────────────────────────────────────

  insert into certifications (profile_id, name, issuer, year, in_progress)
  values
  (pid, 'Project Management Professional (PMP)', 'Project Management Institute', null, false),
  (pid, 'Certified Business Development Expert (CBDE)', null, null, false),
  (pid, 'Certified ScrumMaster (CSM)', null, null, false),
  (pid, 'Google Data Analytics Certificate', 'Google', null, false),
  (pid, 'CompTIA A+', 'CompTIA', null, true);

  -- ── EDUCATION ────────────────────────────────────────────

  insert into education (profile_id, institution, degree, field, year, in_progress)
  values
  (pid, 'Western Governors University', 'Bachelor of Science', 'Information Technology', 'January 2026', true),
  (pid, 'Fayetteville Technical Community College', 'Associate-level coursework', null, null, false),
  (pid, 'Fayetteville State University', 'Bachelor''s-level coursework', 'Business Administration', null, false);

end $$;
