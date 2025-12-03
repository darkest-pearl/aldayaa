import { success } from '../../../../lib/api-response';

const COOKIE_NAME = 'aldayaa_admin';

export async function POST() {
  const response = success({});
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  return response;
}