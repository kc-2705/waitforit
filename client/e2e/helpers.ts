import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const API = 'http://localhost:8080/api/v1';
export const DEMO = { email: 'demo@waitforit.app', password: 'demo12345' };

/** Logs in through the API and opens the app already signed in (skipping the intro animation). */
export async function signIn(page: Page, request: APIRequestContext) {
  const res = await request.post(`${API}/auth/login`, { data: DEMO });
  expect(res.ok()).toBeTruthy();
  const { token } = await res.json();
  await page.addInitScript((t) => {
    localStorage.setItem('waitforit.token', t);
    sessionStorage.setItem('waitforit.introSeen', '1');
  }, token);
  return token as string;
}

/** Waits for the opening screen to finish. */
export async function appReady(page: Page) {
  await page.locator('#splash').waitFor({ state: 'detached', timeout: 60_000 });
}
