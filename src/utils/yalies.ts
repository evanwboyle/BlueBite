export interface YaliesUser {
  id: number;
  netid: string;
  upi: number;
  email: string;
  mailbox: string;
  first_name: string;
  last_name: string;
  address: string;
  school: string;
  school_code: string;
  year: number;
  college: string;
  college_code: string;
  leave: boolean;
  visitor: boolean;
  image: string;
  birth_month: number;
  birth_day: number;
  major: string;
}

const YALIES_API_URL = 'https://api.yalies.io/v2';
const YALIES_API_KEY = import.meta.env.VITE_YALIES_KEY || '';

export const yalies = {
  /**
   * Fetch user information from Yalies API by netid
   * Returns null if user is not found or API call fails
   */
  async fetchUserByNetId(netid: string): Promise<YaliesUser | null> {
    try {
      const response = await fetch(`${YALIES_API_URL}/people`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${YALIES_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: netid,
          filters: {},
          page: 0,
          page_size: 10,
        }),
      });

      if (!response.ok) {
        console.error('Yalies API error:', response.status, response.statusText);
        return null;
      }

      const results: YaliesUser[] = await response.json();
      return results.length > 0 ? results[0] : null;
    } catch (error) {
      console.error('Failed to fetch from Yalies API:', error);
      return null;
    }
  },
};
