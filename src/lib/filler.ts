import { chromium, type Page, type Locator } from 'playwright'
import { supabaseAdmin } from './supabase'

const ELIZABETH = {
  firstName: 'Elizabeth',
  lastName: 'McMillan',
  fullName: 'Elizabeth H. McMillan',
  email: 'elimcmillan@myyahoo.com',
  phone: '9104794839',
  location: 'Fayetteville, NC',
  address: '111 Hay Street',
  city: 'Fayetteville',
  state: 'North Carolina',
  stateCode: 'NC',
  zip: '28301',
  country: 'United States',
  linkedin: 'N/A',
  website: 'N/A',
  currentTitle: 'Business Development Consultant',
  currentCompany: 'Precise Consulting Services',
  salaryText: 'Negotiable',
  salaryNumeric: '80000',
  yearsExperience: '10',
  howHeard: 'Company website',
}

function detectFormType(url: string): string {
  if (url.includes('greenhouse.io')) return 'greenhouse'
  if (url.includes('lever.co')) return 'lever'
  if (url.includes('workday.com') || url.includes('myworkdayjobs')) return 'workday'
  if (url.includes('taleo.net')) return 'taleo'
  if (url.includes('icims.com')) return 'icims'
  if (url.includes('ashbyhq.com')) return 'ashby'
  if (url.includes('bamboohr.com')) return 'bamboo'
  return 'generic'
}

// Safe fill — uses Playwright's fill() which handles React controlled inputs correctly
async function safeFill(locator: Locator, value: string) {
  try {
    if (await locator.count() > 0 && await locator.first().isVisible({ timeout: 500 })) {
      await locator.first().fill(value)
    }
  } catch { /* skip */ }
}

// Safe select — tries label match, then value match
async function safeSelect(locator: Locator, options: string[]) {
  try {
    if (await locator.count() === 0 || !await locator.first().isVisible({ timeout: 500 })) return
    const sel = locator.first()
    const available = await sel.locator('option').allTextContents()
    for (const opt of options) {
      const match = available.find(a => a.trim().toLowerCase().includes(opt.toLowerCase()))
      if (match) {
        await sel.selectOption({ label: match.trim() })
        return
      }
    }
  } catch { /* skip */ }
}

// Fill by label text — Playwright's getByLabel uses the accessibility tree,
// works correctly with React controlled inputs
async function fillByLabel(page: Page, labelPattern: RegExp | string, value: string) {
  try {
    const el = page.getByLabel(labelPattern, { exact: false }).first()
    if (await el.count() > 0 && await el.isVisible({ timeout: 500 })) {
      const tag = await el.evaluate(e => e.tagName.toLowerCase()).catch(() => '')
      if (tag === 'input' || tag === 'textarea') {
        await el.fill(value)
      }
    }
  } catch { /* skip */ }
}

// Select by label text
async function selectByLabel(page: Page, labelPattern: RegExp | string, options: string[]) {
  try {
    const el = page.getByLabel(labelPattern, { exact: false }).first()
    if (await el.count() === 0 || !await el.isVisible({ timeout: 500 })) return
    const tag = await el.evaluate(e => e.tagName.toLowerCase()).catch(() => '')
    if (tag !== 'select') return
    const available = await el.locator('option').allTextContents()
    for (const opt of options) {
      const match = available.find(a => a.trim().toLowerCase().includes(opt.toLowerCase()))
      if (match) {
        await el.selectOption({ label: match.trim() })
        return
      }
    }
  } catch { /* skip */ }
}

// Click "Apply" / "Apply for this job" buttons that gate the actual form
async function clickApplyButton(page: Page) {
  const applyPatterns = [
    'Apply for this job',
    'Apply for this position',
    'Apply Now',
    'Apply now',
    'Apply Today',
    'Submit Application',
    'Start Application',
    'Begin Application',
    'Apply',
  ]

  for (const text of applyPatterns) {
    try {
      // Try button first
      const btn = page.getByRole('button', { name: new RegExp(`^${text}$`, 'i') }).first()
      if (await btn.count() > 0 && await btn.isVisible({ timeout: 800 })) {
        await btn.click()
        await page.waitForTimeout(1500)
        return
      }
      // Try link
      const link = page.getByRole('link', { name: new RegExp(`^${text}$`, 'i') }).first()
      if (await link.count() > 0 && await link.isVisible({ timeout: 800 })) {
        await link.click()
        await page.waitForTimeout(1500)
        return
      }
    } catch { /* continue */ }
  }
}

async function fillForm(page: Page, resumePath: string, coverLetterPath: string) {
  const fs = require('fs')

  // ── Name ──────────────────────────────────────────────────────────────────
  await fillByLabel(page, /first name/i, ELIZABETH.firstName)
  await fillByLabel(page, /preferred first name/i, ELIZABETH.firstName)
  await fillByLabel(page, /preferred name/i, ELIZABETH.firstName)
  await fillByLabel(page, /last name/i, ELIZABETH.lastName)
  await fillByLabel(page, /full name/i, ELIZABETH.fullName)

  // Attribute-based fallbacks for name fields
  await safeFill(page.locator('input[name="first_name"], input[id="first_name"]'), ELIZABETH.firstName)
  await safeFill(page.locator('input[name="last_name"], input[id="last_name"]'), ELIZABETH.lastName)
  await safeFill(page.locator('input[autocomplete="given-name"]'), ELIZABETH.firstName)
  await safeFill(page.locator('input[autocomplete="family-name"]'), ELIZABETH.lastName)

  // ── Contact ───────────────────────────────────────────────────────────────
  await fillByLabel(page, /email/i, ELIZABETH.email)
  await fillByLabel(page, /phone/i, ELIZABETH.phone)
  await safeFill(page.locator('input[type="email"]'), ELIZABETH.email)
  await safeFill(page.locator('input[type="tel"]'), ELIZABETH.phone)

  // ── Location ──────────────────────────────────────────────────────────────
  await fillByLabel(page, /street address/i, ELIZABETH.address)
  await fillByLabel(page, /^address/i, ELIZABETH.address)
  await fillByLabel(page, /city/i, ELIZABETH.city)
  await fillByLabel(page, /zip/i, ELIZABETH.zip)
  await fillByLabel(page, /postal/i, ELIZABETH.zip)
  await fillByLabel(page, /location/i, ELIZABETH.location)

  // State — select first, fall back to text
  await selectByLabel(page, /state/i, ['North Carolina', 'NC'])
  await safeFill(page.locator('input[name*="state" i]'), ELIZABETH.stateCode)

  // Country
  await selectByLabel(page, /country/i, ['United States', 'US', 'USA'])

  // ── Professional ──────────────────────────────────────────────────────────
  await fillByLabel(page, /linkedin/i, ELIZABETH.linkedin)
  await fillByLabel(page, /website/i, ELIZABETH.website)
  await fillByLabel(page, /portfolio/i, ELIZABETH.website)
  await fillByLabel(page, /github/i, ELIZABETH.website)
  await fillByLabel(page, /current title/i, ELIZABETH.currentTitle)
  await fillByLabel(page, /job title/i, ELIZABETH.currentTitle)
  await fillByLabel(page, /current company/i, ELIZABETH.currentCompany)
  await fillByLabel(page, /current employer/i, ELIZABETH.currentCompany)
  await fillByLabel(page, /years of experience/i, ELIZABETH.yearsExperience)

  // ── Salary ────────────────────────────────────────────────────────────────
  await fillByLabel(page, /desired salary/i, ELIZABETH.salaryText)
  await fillByLabel(page, /expected salary/i, ELIZABETH.salaryText)
  await selectByLabel(page, /desired salary/i, ['Negotiable', '80,000', '75,000'])
  await selectByLabel(page, /salary/i, ['Negotiable', '80,000', '75,000'])
  // Fallback to attribute-based
  await safeFill(page.locator('input[name*="salary" i]:not([type="number"])'), ELIZABETH.salaryText)
  await safeFill(page.locator('input[type="number"][name*="salary" i]'), ELIZABETH.salaryNumeric)

  // ── Start / availability ──────────────────────────────────────────────────
  await fillByLabel(page, /start date/i, 'Immediately')
  await selectByLabel(page, /start date/i, ['Immediately', 'Immediate', 'Flexible', '2 weeks', 'Two weeks'])
  await selectByLabel(page, /available/i, ['Immediately', 'Immediate', 'Flexible'])

  // ── How did you hear ──────────────────────────────────────────────────────
  await fillByLabel(page, /how did you hear/i, ELIZABETH.howHeard)
  await fillByLabel(page, /how did you find/i, ELIZABETH.howHeard)
  await selectByLabel(page, /how did you hear/i, ['Company website', 'Website', 'Other', 'Internet', 'Job Board'])
  await selectByLabel(page, /source/i, ['Company website', 'Website', 'Other', 'Internet'])

  // ── Compliance questions ──────────────────────────────────────────────────
  // Work authorization — Yes
  await selectByLabel(page, /legally authorized/i, ['Yes'])
  await selectByLabel(page, /authorized to work/i, ['Yes'])
  await selectByLabel(page, /work authorization/i, ['Yes'])

  // Visa sponsorship — No
  await selectByLabel(page, /require sponsorship/i, ['No'])
  await selectByLabel(page, /sponsorship for employment/i, ['No'])
  await selectByLabel(page, /visa sponsorship/i, ['No'])

  // State of residence (separate from address state)
  await selectByLabel(page, /which state do you currently reside/i, ['North Carolina', 'NC'])
  await selectByLabel(page, /state.*reside/i, ['North Carolina', 'NC'])

  // Veteran status
  await selectByLabel(page, /veteran/i, [
    'I am not a protected veteran',
    'Not a protected veteran',
    'No, I am not a veteran',
    'No',
    'I choose not to self-identify',
  ])

  // Disability
  await selectByLabel(page, /disability/i, [
    "No, I don't have a disability",
    'No, I do not have a disability',
    'I do not have a disability',
    'No disability',
    'No',
    'I choose not to self-identify',
  ])

  // US Citizen
  await selectByLabel(page, /us citizen/i, ['Yes'])
  await selectByLabel(page, /u\.s\. citizen/i, ['Yes'])

  // Age 18+
  await selectByLabel(page, /18 years/i, ['Yes'])

  // Felony
  await selectByLabel(page, /felony/i, ['No'])
  await selectByLabel(page, /convicted/i, ['No'])

  // Remote
  await selectByLabel(page, /willing to work remote/i, ['Yes'])

  // Demographic — intentionally left blank (gender, race, ethnicity, orientation, transgender)

  // ── File uploads ──────────────────────────────────────────────────────────
  try {
    const fileInputs = page.locator('input[type="file"]')
    if (await fileInputs.count() > 0) {
      await fileInputs.first().setInputFiles(resumePath)
    }
  } catch { /* skip */ }

  try {
    const clFile = page.locator('input[type="file"][name*="cover" i], input[type="file"][id*="cover" i]')
    if (await clFile.count() > 0) {
      await clFile.first().setInputFiles(resumePath)
    }
  } catch { /* skip */ }

  try {
    const clTextarea = page.locator('textarea[name*="cover" i], textarea[id*="cover" i]').first()
    if (await clTextarea.count() > 0 && await clTextarea.isVisible({ timeout: 500 })) {
      await clTextarea.fill(fs.readFileSync(coverLetterPath, 'utf-8'))
    }
  } catch { /* skip */ }
}

export async function fillApplication(applicationId: string): Promise<{ success: boolean; message: string }> {
  const db = supabaseAdmin()
  const fs = require('fs')
  const path = require('path')
  const os = require('os')

  const { data: app } = await db
    .from('applications')
    .select('*, job:discovered_jobs(*)')
    .eq('id', applicationId)
    .single()

  if (!app) return { success: false, message: 'Application not found' }
  const job = app.job
  if (!job?.url) return { success: false, message: 'No job URL' }

  const tmpDir = os.tmpdir()
  const resumePath = path.join(tmpDir, `resume_${applicationId}.txt`)
  const clPath = path.join(tmpDir, `cover_${applicationId}.txt`)
  fs.writeFileSync(resumePath, app.resume_text ?? '')
  fs.writeFileSync(clPath, app.cover_letter ?? '')

  const formType = detectFormType(job.url)
  const browser = await chromium.launch({ headless: false, slowMo: 150 })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    await page.goto(job.url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(2500)

    // Click through any "Apply" / "Apply for this job" button before the form appears
    await clickApplyButton(page)
    await page.waitForTimeout(1500)

    // Pass 1 — fill everything
    await fillForm(page, resumePath, clPath)

    // Pass 2 — catch fields that appear after initial interaction
    await page.waitForTimeout(1200)
    await fillForm(page, resumePath, clPath)

    // Scroll to top so user sees the full form from the beginning
    await page.evaluate(() => window.scrollTo(0, 0))

    await db.from('applications').update({
      status: 'filled',
      form_filled_at: new Date().toISOString(),
      notes: `Form type: ${formType}. Review in browser and click Submit.`,
    }).eq('id', applicationId)

    await db.from('discovered_jobs').update({ status: 'applying' }).eq('id', job.id)

    // Return immediately — browser stays open so user can review and submit.
    // After submitting, close the browser window and mark the application
    // as "submitted" manually using the Follow Up tab.
    // Delete temp files after 5 minutes — long enough for the browser to finish using them
    setTimeout(() => {
      try { fs.unlinkSync(resumePath) } catch { /* skip */ }
      try { fs.unlinkSync(clPath) } catch { /* skip */ }
    }, 300000)

    return { success: true, message: 'Form filled! Review in the browser window, then click Submit. Close the window when done and mark as Submitted in the Follow Up tab.' }
  } catch (err) {
    try { fs.unlinkSync(resumePath) } catch { /* skip */ }
    try { fs.unlinkSync(clPath) } catch { /* skip */ }
    return { success: false, message: String(err) }
  }
}
