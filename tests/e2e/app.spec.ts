import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

async function startDemo(page: Page) {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.getByRole('button', { name: /try with a demo week/i }).click()
  await expect(page.getByRole('heading', { name: /good (morning|afternoon|evening), priya/i })).toBeVisible()
}

const nav = (page: Page, name: string) => page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name })

test('logs a typed meal in Hinglish and updates the day', async ({ page }) => {
  await startDemo(page)
  await page.getByRole('tab', { name: 'Lunch' }).click()
  const input = page.getByLabel('Describe your meal')
  await input.fill('do chapathi, 1 katori dal aur dahi')
  await expect(page.locator('.parse-preview')).toContainText('Roti / Chapati')
  await expect(page.locator('.parse-preview')).toContainText('Dal Tadka')
  await expect(page.locator('.parse-preview')).toContainText('Curd / Dahi')
  await input.press('Enter')
  const lunch = page.locator('.card', { has: page.getByRole('heading', { name: 'Lunch' }) })
  await expect(lunch).toContainText('Roti / Chapati')
  await expect(lunch).toContainText('430 kcal')
})

test('runs the coach agent and shows a self-checked plan', async ({ page }) => {
  await startDemo(page)
  await nav(page, 'Coach').click()
  await page.getByRole('button', { name: /run coach/i }).first().click()
  await expect(page.getByText('8 / 8 steps')).toBeVisible({ timeout: 15_000 })
  for (const tool of ['assess_profile', 'detect_patterns', 'verify_plan', 'check_budget']) await expect(page.getByText(tool, { exact: true })).toBeVisible()
  await expect(page.locator('.insights').getByText(/% of your energy comes from carbohydrate/)).toBeVisible()
  await page.getByRole('button', { name: /see the 7-day plan/i }).click()
  await expect(page.getByRole('heading', { name: '7-day plan' })).toBeVisible()
  await expect(page.locator('.days button')).toHaveCount(7)
  await expect(page.getByRole('button', { name: /share plan/i })).toBeVisible()
  await page.getByRole('button', { name: /ate this today/i }).first().click()
  await expect(page.getByRole('button', { name: /logged to today/i })).toBeVisible()
})

test('tracks weight and recomputes risk', async ({ page }) => {
  await startDemo(page)
  await nav(page, 'Health').click()
  await expect(page.getByText(/Goal 57.2 kg/)).toBeVisible()
  await page.getByLabel('Weight today (kg)').fill('70.5')
  await page.getByLabel('Waist (cm)', { exact: true }).fill('88')
  await page.getByRole('button', { name: 'Save' }).click()
  // Waist under 90 cm drops one IDRS band for a woman: 80 → 70.
  await expect(page.getByText('70 / 100 · High')).toBeVisible()
  await expect(page.locator('.trend').first()).toContainText('70.5')
})

test('is installable and has no serious accessibility issues', async ({ page }) => {
  await startDemo(page)
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest')
  const manifest = await (await page.request.get('/manifest.webmanifest')).json()
  expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true)
  for (const tab of ['Today', 'Coach', 'Plan', 'Health']) {
    await nav(page, tab).click()
    const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    const serious = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
    expect(serious.map((v) => `${tab}: ${v.id} (${v.nodes.length})`)).toEqual([])
  }
})

test('has no horizontal overflow on any screen', async ({ page }) => {
  await startDemo(page)
  for (const tab of ['Today', 'Coach', 'Plan', 'Health']) {
    await nav(page, tab).click()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow, tab).toBeLessThanOrEqual(0)
  }
})
