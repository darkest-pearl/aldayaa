import { NextResponse } from 'next/server';

export function success(data = {}, init = {}) {
  return NextResponse.json({ success: true, data, error: null }, init);
}

export function failure(error = 'Request failed', status = 400, extras = {}) {
  return NextResponse.json({ success: false, data: null, error, ...extras }, { status });
}

export function handleApiError(error) {
  const status = error?.status || (error?.code === 'FORBIDDEN' ? 403 : error?.code === 'UNAUTHORIZED' ? 401 : 400);
  const message = error?.message || 'Unexpected error';
  return failure(message, status);
}