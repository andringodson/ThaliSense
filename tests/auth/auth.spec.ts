import AxeBuilder from '@axe-core/playwright'
import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test'

// Runs against the Firebase emulators (npm run e2e:auth). Each test starts clean.
const PROJECT = 'demo-thalisense'

test.beforeEach(async ({ request }) => {
  await request.delete(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT}/accounts`)
  await request.delete(`http://127.0.0.1:8080/emulator/v1/projects/${PROJECT}/databases/(default)/documents`)
})

async function fresh(browser: Browser) {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await page.goto('/')
  return { ctx, page }
}

const nav = (page: Page) => page.getByRole('navigation', { name: 'Main' })

/** Emails of every account in the Auth emulator. */
async function accountEmails(request: APIRequestContext): Promise<string[]> {
  const res = await request.post(`http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:query`, {
    headers: { Authorization: 'Bearer owner' },
    data: {},
  })
  const body = await res.json()
  return (body.userInfo ?? []).map((u: { email?: string }) => u.email ?? '')
}

async function openSignIn(page: Page) {
  await nav(page).getByRole('button', { name: 'Sign in' }).first().click()
  await expect(page.getByRole('dialog', { name: /sign in to thalisense/i })).toBeVisible()
}

async function signUpWithEmail(page: Page, name: string, email: string, password = 'thali-secret-1') {
  await openSignIn(page)
  await page.getByRole('button', { name: 'Create an account' }).click()
  const dlg = page.getByRole('dialog')
  await dlg.getByLabel('Name').fill(name)
  await dlg.getByLabel('Email').fill(email)
  await dlg.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(nav(page).getByRole('button', { name: `Account: ${name}` }).first()).toBeVisible()
}

/** Drive the Auth emulator's stand-in for the provider's sign-in popup. */
async function providerSignIn(page: Page, provider: 'Google' | 'Facebook' | 'Apple', email: string, name: string) {
  const popupP = page.waitForEvent('popup')
  await page.getByRole('button', { name: `Continue with ${provider}` }).click()
  const popup = await popupP
  await popup.waitForLoadState('load')
  // The emulator page wires its buttons up after load; retry until the form opens.
  await expect(async () => {
    await popup.getByRole('button', { name: /add new account/i }).click()
    await expect(popup.locator('#email-input')).toBeVisible({ timeout: 1000 })
  }).toPass({ timeout: 20_000 })
  await popup.locator('#email-input').fill(email)
  await popup.locator('#display-name-input').fill(name)
  await popup.getByRole('button', { name: /sign in with/i }).click()
}

async function syncedLabel(page: Page) {
  await nav(page).getByRole('button', { name: /^Account:/ }).first().click()
  const status = page.getByRole('dialog', { name: 'Your account' }).getByRole('status')
  await expect(status).toContainText('Backed up', { timeout: 20_000 })
  await page.getByRole('button', { name: 'Close' }).click()
}

test('sign-in is optional: the app works fully as a guest', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /try with a demo week/i }).click()
  await expect(page.getByRole('heading', { name: /priya/i })).toBeVisible()
  await openSignIn(page)
  await page.getByRole('button', { name: 'Continue without an account' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('offers Google, Facebook, Apple and email', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /try with a demo week/i }).click()
  await openSignIn(page)
  for (const p of ['Google', 'Facebook', 'Apple']) await expect(page.getByRole('button', { name: `Continue with ${p}` })).toBeVisible()
  await expect(page.getByRole('dialog').getByLabel('Email')).toBeVisible()
})

test('creates an account with email and backs the data up', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /set up my profile/i }).click()
  await signUpWithEmail(page, 'Meena', 'meena@example.com')
  await syncedLabel(page)
})

for (const provider of ['Google', 'Facebook', 'Apple'] as const) {
  test(`signs in with ${provider}`, async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /set up my profile/i }).click()
    await openSignIn(page)
    await providerSignIn(page, provider, `ravi.${provider.toLowerCase()}@example.com`, 'Ravi Kumar')
    await expect(nav(page).getByRole('button', { name: 'Account: Ravi Kumar' }).first()).toBeVisible()
    await nav(page).getByRole('button', { name: 'Account: Ravi Kumar' }).first().click()
    await expect(page.getByText(`signed in with ${provider}`)).toBeVisible()
  })
}

test('syncs meals across two devices, including deletions', async ({ browser }) => {
  // Phone: demo week, then log lunch and sign up.
  const phone = await fresh(browser)
  await phone.page.getByRole('button', { name: /set up my profile/i }).click()
  await signUpWithEmail(phone.page, 'Asha', 'asha@example.com')
  await nav(phone.page).getByRole('button', { name: 'Today' }).click()
  await phone.page.getByRole('tab', { name: 'Lunch' }).click()
  await phone.page.getByLabel('Describe your meal').fill('2 roti and dal')
  await phone.page.keyboard.press('Enter')
  await syncedLabel(phone.page)

  // Laptop: sign in from the welcome screen and see the same lunch.
  const laptop = await fresh(browser)
  await laptop.page.getByRole('button', { name: 'Sign in' }).click()
  await laptop.page.getByRole('dialog').getByLabel('Email').fill('asha@example.com')
  await laptop.page.getByRole('dialog').getByLabel('Password', { exact: true }).fill('thali-secret-1')
  await laptop.page.getByRole('dialog').getByRole('button', { name: 'Sign in', exact: true }).click()
  const lunch = laptop.page.locator('.card', { has: laptop.page.getByRole('heading', { name: 'Lunch' }) })
  await expect(lunch).toContainText('Roti / Chapati', { timeout: 20_000 })
  await expect(lunch).toContainText('Dal Tadka')

  // Delete the dal on the laptop; the phone picks that up and it doesn't come back.
  await lunch.getByRole('button', { name: 'Remove Dal Tadka' }).click()
  await syncedLabel(laptop.page)
  await phone.page.reload()
  await nav(phone.page).getByRole('button', { name: 'Account: Asha' }).first().click()
  await phone.page.getByRole('button', { name: 'Sync now' }).click()
  await expect(phone.page.getByRole('dialog').getByRole('status')).toContainText('Backed up', { timeout: 20_000 })
  await phone.page.getByRole('button', { name: 'Close' }).click()
  const phoneLunch = phone.page.locator('.card', { has: phone.page.getByRole('heading', { name: 'Lunch' }) })
  await expect(phoneLunch).toContainText('Roti / Chapati')
  await expect(phoneLunch).not.toContainText('Dal Tadka')
  await phone.ctx.close()
  await laptop.ctx.close()
})

test('explains a wrong password and sends a reset link', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /set up my profile/i }).click()
  await signUpWithEmail(page, 'Kiran', 'kiran@example.com')
  await nav(page).getByRole('button', { name: 'Account: Kiran' }).first().click()
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await openSignIn(page)
  await page.getByRole('dialog').getByLabel('Email').fill('kiran@example.com')
  await page.getByRole('dialog').getByLabel('Password', { exact: true }).fill('not-the-password')
  await page.getByRole('dialog').getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByText(/don’t match/)).toBeVisible()
  await page.getByRole('button', { name: 'Forgot password?' }).click()
  await expect(page.getByText(/reset link is on its way/)).toBeVisible()
})

test('sign out and clear, then delete the account and its cloud data', async ({ page, request }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /try with a demo week/i }).click()
  await signUpWithEmail(page, 'Priya', 'priya@example.com')
  await syncedLabel(page)
  expect(await accountEmails(request)).toEqual(['priya@example.com'])

  await nav(page).getByRole('button', { name: 'Account: Priya' }).first().click()
  await page.getByRole('button', { name: 'Sign out and clear this device' }).click()
  await expect(page.getByRole('button', { name: /try with a demo week/i })).toBeVisible()

  // Sign back in: the data comes back from the cloud.
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.getByRole('dialog').getByLabel('Email').fill('priya@example.com')
  await page.getByRole('dialog').getByLabel('Password', { exact: true }).fill('thali-secret-1')
  await page.getByRole('dialog').getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: /priya/i })).toBeVisible({ timeout: 20_000 })

  page.once('dialog', (d) => d.accept())
  await nav(page).getByRole('button', { name: 'Account: Priya' }).first().click()
  await page.getByRole('button', { name: 'Delete account' }).click()
  await expect(page.getByRole('button', { name: /try with a demo week/i })).toBeVisible({ timeout: 20_000 })
  expect(await accountEmails(request)).toEqual([])
})

test('sign-in and account sheets have no serious accessibility issues', async ({ page }) => {
  const scan = async (label: string) => {
    // Measure after the sheet's fade-in, not halfway through it.
    await page.waitForFunction(() =>
      document.getAnimations().every((a) => a.effect?.getComputedTiming().endTime === Infinity || a.playState !== 'running'),
    )
    const { violations } = await new AxeBuilder({ page }).include('[role=dialog]').withTags(['wcag2a', 'wcag2aa']).analyze()
    expect(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${label}: ${v.id} ${v.nodes.map((n) => n.target.join(" ") + " — " + n.any.map((x) => x.message).join("; ")).join(" || ")}`)).toEqual([])
  }
  await page.goto('/')
  await page.getByRole('button', { name: /set up my profile/i }).click()
  await openSignIn(page)
  await scan('sign in')
  await page.getByRole('button', { name: 'Create an account' }).click()
  await scan('sign up')
  await page.getByRole('button', { name: 'Close' }).click()
  await signUpWithEmail(page, 'Leela', 'leela@example.com')
  await nav(page).getByRole('button', { name: 'Account: Leela' }).first().click()
  await expect(page.getByRole('dialog', { name: 'Your account' })).toBeVisible()
  await scan('account')
})
