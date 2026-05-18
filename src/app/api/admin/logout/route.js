export const dynamic = "force-dynamic";
import { success } from '../../../../lib/api-response';
import { clearSessionCookie } from '../../../../lib/auth';

export async function POST() {
  const response = success({});
  clearSessionCookie(response);
  return response;
}
