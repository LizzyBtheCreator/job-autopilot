function showMsg(text, type = 'info') {
  const el = document.getElementById('msg')
  el.textContent = text
  el.className = `msg ${type}`
}

function updateProfileDisplay(profile) {
  if (!profile) return
  document.getElementById('profileName').textContent = profile.full_name || 'Elizabeth McMillan'
  document.getElementById('profileEmail').textContent = profile.email || ''
}

// Load saved profile on open
chrome.storage.local.get(['profile', 'coverLetter'], (data) => {
  if (data.profile) updateProfileDisplay(data.profile)
  if (data.coverLetter) document.getElementById('coverLetterInput').value = data.coverLetter
})

// Sync profile from local autopilot server
document.getElementById('btnSync').addEventListener('click', async () => {
  showMsg('Syncing from localhost:3001...', 'info')
  try {
    const res = await fetch('http://localhost:3001/api/profile/export')
    if (!res.ok) throw new Error(`Server returned ${res.status}`)
    const data = await res.json()
    await chrome.storage.local.set({ profile: data })
    updateProfileDisplay(data)
    showMsg('Profile synced!', 'success')
  } catch (err) {
    showMsg('Could not reach autopilot server. Make sure it is running at localhost:3001.', 'error')
  }
})

// Save cover letter when typed
document.getElementById('coverLetterInput').addEventListener('input', (e) => {
  chrome.storage.local.set({ coverLetter: e.target.value })
})

// Fill application
document.getElementById('btnFill').addEventListener('click', async () => {
  const { profile, coverLetter } = await chrome.storage.local.get(['profile', 'coverLetter'])
  if (!profile) {
    showMsg('No profile loaded. Click Sync Profile first.', 'error')
    return
  }
  showMsg('Filling application...', 'info')
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  chrome.scripting.executeScript({
    target: { tabId: tab.id, allFrames: true },
    func: fillApplication,
    args: [profile, coverLetter || ''],
  }, (results) => {
    if (chrome.runtime.lastError) {
      showMsg('Error: ' + chrome.runtime.lastError.message, 'error')
      return
    }
    const totalFilled = (results || []).reduce((sum, r) => sum + (r?.result?.count || 0), 0)
    if (totalFilled > 0) {
      showMsg(`Filled ${totalFilled} field(s)!`, 'success')
    } else {
      showMsg('No fields detected — scroll down and try again, or fill manually.', 'info')
    }
  })
})

// Clear profile
document.getElementById('btnClear').addEventListener('click', () => {
  chrome.storage.local.clear(() => {
    document.getElementById('profileName').textContent = 'No profile loaded'
    document.getElementById('profileEmail').textContent = 'Sync profile to get started'
    document.getElementById('coverLetterInput').value = ''
    showMsg('Profile cleared.', 'info')
  })
})

// This function runs IN the page context
function fillApplication(profile, coverLetter) {
  let filled = 0

  function setNativeValue(el, value) {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
    const nativeTextareaSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
    if (el.tagName === 'TEXTAREA' && nativeTextareaSetter) {
      nativeTextareaSetter.call(el, value)
    } else if (nativeInputValueSetter) {
      nativeInputValueSetter.call(el, value)
    } else {
      el.value = value
    }
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    el.dispatchEvent(new Event('blur', { bubbles: true }))
    el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }))
  }

  function tryFill(el, value) {
    if (!el || !value || el.readOnly || el.disabled) return false
    el.focus()
    setNativeValue(el, value)
    filled++
    return true
  }

  function findField(...selectors) {
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel)
        if (el) return el
      } catch {}
    }
    return null
  }

  function findFieldByLabel(text) {
    const lower = text.toLowerCase()
    // Check standard labels
    const labels = document.querySelectorAll('label')
    for (const label of labels) {
      if (label.textContent.toLowerCase().includes(lower)) {
        const id = label.getAttribute('for')
        if (id) {
          const el = document.getElementById(id)
          if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) return el
        }
        const input = label.querySelector('input, textarea, select')
        if (input) return input
        const next = label.nextElementSibling
        if (next && (next.tagName === 'INPUT' || next.tagName === 'TEXTAREA' || next.tagName === 'SELECT')) return next
      }
    }
    // Check placeholders and aria-labels
    const inputs = document.querySelectorAll('input, textarea')
    for (const input of inputs) {
      const placeholder = (input.placeholder || '').toLowerCase()
      const ariaLabel = (input.getAttribute('aria-label') || '').toLowerCase()
      const name = (input.name || '').toLowerCase()
      const id = (input.id || '').toLowerCase()
      if (placeholder.includes(lower) || ariaLabel.includes(lower) || name.includes(lower) || id.includes(lower)) {
        return input
      }
    }
    return null
  }

  const p = profile
  const firstName = p.full_name?.split(' ')[0] || 'Elizabeth'
  const lastName = p.full_name?.split(' ').slice(1).join(' ') || 'McMillan'

  // ---- SMARTRECRUITERS SPECIFIC ----
  const srFirst = document.querySelector('#firstName, [data-test="input-firstName"], input[name="firstName"]')
  const srLast = document.querySelector('#lastName, [data-test="input-lastName"], input[name="lastName"]')
  const srEmail = document.querySelector('#email, [data-test="input-email"], input[name="email"]')
  const srEmailConfirm = document.querySelector('#confirmEmail, [data-test="input-confirmEmail"], input[name="confirmEmail"]')
  const srPhone = document.querySelector('#phone, [data-test="input-phoneNumber"], input[name="phone"]')
  const srCity = document.querySelector('#city, [data-test="input-city"], input[name="city"]')
  const srMessage = document.querySelector('#message, [data-test="input-message"], textarea[name="message"], textarea[id="message"]')

  if (srFirst) tryFill(srFirst, firstName)
  if (srLast) tryFill(srLast, lastName)
  if (srEmail) tryFill(srEmail, p.email)
  if (srEmailConfirm) tryFill(srEmailConfirm, p.email)
  if (srPhone) tryFill(srPhone, p.phone?.replace(/\D/g, ''))
  if (srCity) {
    const city = p.location?.split(',')[0]?.trim() || ''
    tryFill(srCity, city)
  }
  if (srMessage && coverLetter) tryFill(srMessage, coverLetter)

  // ---- FIRST NAME ----
  if (!srFirst) {
    const firstEl = findField(
      '[name="first_name"]', '[name="firstName"]', '[id="first_name"]', '[id="firstName"]',
      '[name="fname"]', '[id="fname"]', '[autocomplete="given-name"]'
    ) || findFieldByLabel('first name') || findFieldByLabel('first')
    tryFill(firstEl, firstName)
  }

  // ---- LAST NAME ----
  if (!srLast) {
    const lastEl = findField(
      '[name="last_name"]', '[name="lastName"]', '[id="last_name"]', '[id="lastName"]',
      '[name="lname"]', '[id="lname"]', '[autocomplete="family-name"]'
    ) || findFieldByLabel('last name') || findFieldByLabel('last')
    tryFill(lastEl, lastName)
  }

  // ---- FULL NAME ----
  const fullNameEl = findField('[name="full_name"]', '[name="fullName"]', '[autocomplete="name"]') || findFieldByLabel('full name')
  if (fullNameEl && !srFirst) tryFill(fullNameEl, p.full_name)

  // ---- EMAIL ----
  if (!srEmail) {
    const emailEl = findField('[name="email"]', '[id="email"]', '[type="email"]', '[autocomplete="email"]') || findFieldByLabel('email')
    tryFill(emailEl, p.email)
  }

  // ---- PHONE ----
  if (!srPhone) {
    const phoneEl = findField('[name="phone"]', '[id="phone"]', '[type="tel"]', '[name="phone_number"]', '[autocomplete="tel"]') || findFieldByLabel('phone') || findFieldByLabel('mobile')
    tryFill(phoneEl, p.phone)
  }

  // ---- ADDRESS ----
  if (p.location) {
    const parts = p.location.split(',').map(s => s.trim())
    const city = parts[0] || ''
    const stateZip = parts[1] || ''
    const state = stateZip.split(' ')[0] || ''
    const zip = stateZip.split(' ')[1] || ''
    if (!srCity) {
      const cityEl = findField('[name="city"]', '[id="city"]', '[autocomplete="address-level2"]') || findFieldByLabel('city')
      tryFill(cityEl, city)
    }
    const stateEl = findField('[name="state"]', '[id="state"]', '[autocomplete="address-level1"]') || findFieldByLabel('state')
    tryFill(stateEl, state)
    const zipEl = findField('[name="zip"]', '[name="zipCode"]', '[id="zip"]', '[autocomplete="postal-code"]') || findFieldByLabel('zip') || findFieldByLabel('postal')
    tryFill(zipEl, zip)
  }

  // ---- COVER LETTER / MESSAGE ----
  if (coverLetter && !srMessage) {
    const clEl = findField('textarea[name*="cover"]', 'textarea[id*="cover"]', '[name="cover_letter"]', '[name="coverLetter"]') ||
      findFieldByLabel('cover letter') || findFieldByLabel('message to') || findFieldByLabel('message')
    tryFill(clEl, coverLetter)
  }

  // ---- ICIMS SPECIFIC ----
  const icimsFirst = document.querySelector('[name="PersonProfileFields.FirstName"]')
  const icimsLast = document.querySelector('[name="PersonProfileFields.LastName"]')
  const icimsEmail = document.querySelector('[name="PersonProfileFields.Email"]')
  const icimsPhone = document.querySelector('[name="-1_PersonProfileFields.PhoneNumber"]')
  const icimsStreet = document.querySelector('[name="-1_PersonProfileFields.AddressStreet1"]')
  const icimsCity = document.querySelector('[name="-1_PersonProfileFields.AddressCity"]')
  const icimsZip = document.querySelector('[name="-1_PersonProfileFields.AddressZip"]')

  if (icimsFirst) tryFill(icimsFirst, firstName)
  if (icimsLast) tryFill(icimsLast, lastName)
  if (icimsEmail) tryFill(icimsEmail, p.email)
  if (icimsPhone) tryFill(icimsPhone, p.phone?.replace(/\D/g, ''))
  if (icimsStreet) tryFill(icimsStreet, '3400 Tara Court')
  if (icimsCity) {
    const city = p.location?.split(',')[0]?.trim() || ''
    tryFill(icimsCity, city)
  }
  if (icimsZip) tryFill(icimsZip, '28306')

  // ---- WORKDAY SPECIFIC ----
  const wdFirst = document.querySelector('[data-automation-id="legalNameSection_firstName"]')
  const wdLast = document.querySelector('[data-automation-id="legalNameSection_lastName"]')
  const wdEmail = document.querySelector('[data-automation-id="email"]')
  const wdPhone = document.querySelector('[data-automation-id="phone"]')
  if (wdFirst) tryFill(wdFirst, firstName)
  if (wdLast) tryFill(wdLast, lastName)
  if (wdEmail) tryFill(wdEmail, p.email)
  if (wdPhone) tryFill(wdPhone, p.phone)

  // ---- TALEO SPECIFIC ----
  // Taleo uses both direct name attrs and label-based fields
  const taleoFirst = document.querySelector('input[id*="CONFF"], input[id*="firstName"], input[name="firstName"], input[id*="first_name"]')
  const taleoLast = document.querySelector('input[id*="CONLF"], input[id*="lastName"], input[name="lastName"], input[id*="last_name"]')
  const taleoEmail = document.querySelector('input[id*="CONEMAIL"], input[id*="email"], input[name="email"]')
  const taleoPhone = document.querySelector('input[id*="CONHPH"], input[id*="phone"], input[name="phone"]')
  const taleoAddress = document.querySelector('input[id*="CONADR1"], input[name*="address"]')
  const taleoCity = document.querySelector('input[id*="CONCITY"], input[name*="city"]')
  const taleoZip = document.querySelector('input[id*="CONZIP"], input[name*="zip"]')
  if (taleoFirst && !srFirst) tryFill(taleoFirst, firstName)
  if (taleoLast && !srLast) tryFill(taleoLast, lastName)
  if (taleoEmail && !srEmail) tryFill(taleoEmail, p.email)
  if (taleoPhone && !srPhone) tryFill(taleoPhone, p.phone)
  if (taleoAddress) tryFill(taleoAddress, '3400 Tara Court')
  if (taleoCity) tryFill(taleoCity, p.location?.split(',')[0]?.trim() || '')
  if (taleoZip) tryFill(taleoZip, '28306')

  // ---- WORK AUTHORIZATION ----
  const authEl = findFieldByLabel('authorized to work') || findFieldByLabel('work authorization') || findFieldByLabel('legally authorized')
  if (authEl) {
    if (authEl.tagName === 'SELECT') {
      const opts = Array.from(authEl.options)
      const yes = opts.find(o => o.text.toLowerCase().includes('yes') || o.value === 'true' || o.value === '1')
      if (yes) { authEl.value = yes.value; authEl.dispatchEvent(new Event('change', { bubbles: true })); filled++ }
    } else if (authEl.type === 'checkbox') {
      authEl.checked = true; authEl.dispatchEvent(new Event('change', { bubbles: true })); filled++
    }
  }

  // ---- SPONSORSHIP ----
  const sponsorEl = findFieldByLabel('visa sponsorship') || findFieldByLabel('require sponsorship') || findFieldByLabel('sponsorship')
  if (sponsorEl && sponsorEl.tagName === 'SELECT') {
    const opts = Array.from(sponsorEl.options)
    const no = opts.find(o => o.text.toLowerCase().includes('no') || o.value === 'false' || o.value === '0')
    if (no) { sponsorEl.value = no.value; sponsorEl.dispatchEvent(new Event('change', { bubbles: true })); filled++ }
  }

  // ---- SALARY ----
  const salaryEl = findFieldByLabel('salary') || findFieldByLabel('compensation') || findFieldByLabel('expected pay')
  if (salaryEl && salaryEl.tagName === 'INPUT') tryFill(salaryEl, '120000')

  // ---- RADIO BUTTONS ----
  document.querySelectorAll('input[type="radio"]').forEach(radio => {
    const label = radio.closest('label') || document.querySelector(`label[for="${radio.id}"]`)
    const text = (label?.textContent || radio.value || '').toLowerCase()
    const groupLabel = radio.closest('fieldset')?.querySelector('legend')?.textContent?.toLowerCase() || ''
    if ((groupLabel.includes('authorized') || groupLabel.includes('authorization')) && (text.includes('yes') || radio.value === 'Yes' || radio.value === 'true')) {
      radio.checked = true; radio.dispatchEvent(new Event('change', { bubbles: true })); filled++
    }
    if ((groupLabel.includes('sponsor') || groupLabel.includes('visa')) && (text.includes('no') || radio.value === 'No' || radio.value === 'false')) {
      radio.checked = true; radio.dispatchEvent(new Event('change', { bubbles: true })); filled++
    }
  })

  return { success: true, count: filled, message: filled > 0 ? `Filled ${filled} fields` : 'No matching fields found' }
}
