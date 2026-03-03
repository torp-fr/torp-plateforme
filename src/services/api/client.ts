/**
 * Centralized API Client Wrapper
 * Provides a consistent interface for frontend API calls
 */

export async function apiGet<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`API GET failed: ${response.status}`);
  }
  const result = await response.json();
  return result.data;
}

export async function apiPost<T>(url: string, body: any): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`API POST failed: ${response.status}`);
  }
  const result = await response.json();
  return result.data;
}
